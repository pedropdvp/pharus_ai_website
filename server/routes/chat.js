// ============================================================
//  Rotas do chatbot
//  POST   /api/chat                 -> resposta em streaming (SSE)
//  GET    /api/conversations        -> lista conversas de uma sessao
//  GET    /api/conversation/:id     -> mensagens de uma conversa
//  DELETE /api/conversation/:id     -> apaga conversa
// ============================================================
import { Router } from 'express';
import {
  ensureConversation,
  addMessage,
  getMessagesAfter,
  setSummary,
  listConversations,
  getAllMessages,
  deleteConversation,
  deleteLastAssistantMessage,
  setTitleIfEmpty,
  getConversation,
  getCachedAnswer,
  putCachedAnswer,
} from '../db.js';
import { streamChat, summarize } from '../gemini.js';
import { retrieve } from '../rag.js';

const router = Router();
const MAX_HISTORY = Number(process.env.MAX_HISTORY_MESSAGES || 12);
const MAX_MESSAGE_LEN = 4000;
// Resumo automatico: quando ha mais de N mensagens por resumir, resume as antigas
// e mantem as ultimas KEEP no historico enviado a API (corte de custos).
const SUMMARY_TRIGGER = Number(process.env.SUMMARY_TRIGGER || 16);
const SUMMARY_KEEP = Number(process.env.SUMMARY_KEEP || 8);
const CACHE_TTL_DAYS = Number(process.env.CACHE_TTL_DAYS || 30);
const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_FILE_B64 = Number(process.env.MAX_FILE_B64 || 3_800_000); // ~2.8 MB de ficheiro

// Valida um anexo opcional {name, mimeType, data(base64)}. Devolve o ficheiro ou null.
function validateFile(file) {
  if (!file || typeof file !== 'object') return null;
  const mimeType = String(file.mimeType || '');
  const data = typeof file.data === 'string' ? file.data : '';
  if (!ALLOWED_FILE_TYPES.includes(mimeType)) return null;
  if (!data || data.length > MAX_FILE_B64) return null;
  return { name: String(file.name || 'ficheiro'), mimeType, data };
}

// Normaliza a pergunta para a cache: minusculas, sem acentos, sem pontuacao, espacos colapsados.
function normalizeQuestion(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Emite uma resposta ja pronta (cache) como stream SSE, em pequenos pedacos.
function streamCached(res, text) {
  const parts = text.match(/[\s\S]{1,60}/g) || [text];
  for (const p of parts) res.write(`event: token\ndata: ${JSON.stringify(p)}\n\n`);
}

// --- Validacao simples de entrada ---
function validateChatBody(body) {
  const errors = [];
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const lang = ['pt', 'en', 'fr'].includes(body.lang) ? body.lang : 'pt';
  const conversationId =
    typeof body.conversationId === 'string' && body.conversationId ? body.conversationId : null;
  const regenerate = body.regenerate === true;
  const file = validateFile(body.file);

  if (!sessionId) errors.push('sessionId em falta');
  if (!message && !file) errors.push('message em falta'); // com anexo, a mensagem pode ir vazia
  if (message.length > MAX_MESSAGE_LEN) errors.push('message demasiado longa');

  return { errors, sessionId, message, lang, conversationId, regenerate, file };
}

// --- POST /api/chat (SSE streaming) ---
router.post('/chat', async (req, res) => {
  const { errors, sessionId, message, lang, conversationId, regenerate, file } = validateChatBody(req.body || {});
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  // Texto guardado na BD (o ficheiro em si NAO e guardado — so vai ao modelo neste turno).
  const storedMessage = file ? (message ? message + ` [anexo: ${file.name}]` : `[anexo: ${file.name}]`) : message;

  const convId = await ensureConversation(conversationId, sessionId, lang);

  // Regenerar: apaga a ultima resposta do assistente para que a nova a substitua.
  // A pergunta do utilizador ja esta guardada, por isso NAO a gravamos de novo.
  if (regenerate) await deleteLastAssistantMessage(convId);

  const conv = await getConversation(convId);
  const summary = conv?.summary || null;
  const summarizedUntil = conv?.summarized_until || 0;

  // Historico ainda nao resumido; enviamos so as ultimas MAX_HISTORY mensagens.
  // A memoria mais antiga entra via `summary` no system prompt.
  let notSummarized = await getMessagesAfter(convId, summarizedUntil);

  if (!regenerate) {
    // Grava a pergunta do utilizador (fluxo normal)
    await addMessage(convId, 'user', storedMessage);
    await setTitleIfEmpty(convId, storedMessage);
  } else if (notSummarized.length && notSummarized[notSummarized.length - 1].role === 'user') {
    // A ultima mensagem ja e a pergunta a reenviar — retira-a do historico para nao duplicar
    notSummarized = notSummarized.slice(0, -1);
  }

  const history = notSummarized.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));

  // Pergunta "fresca": primeira mensagem de uma conversa, sem historico, resumo nem anexo.
  // So estas sao elegiveis para cache (respostas contextuais/anexos nao se reutilizam).
  const isFresh = !regenerate && history.length === 0 && !summary && !file;
  const qnorm = isFresh ? normalizeQuestion(message) : null;

  // Cabecalhos SSE
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // desativa buffering do nginx
  res.flushHeaders?.();

  // Informa o cliente do id da conversa (para persistir no localStorage)
  res.write(`event: meta\ndata: ${JSON.stringify({ conversationId: convId })}\n\n`);

  let full = '';
  let totalTokens = 0;
  let clientClosed = false;
  req.on('close', () => { clientClosed = true; });

  // --- Cache de FAQ: resposta imediata sem chamar a API ---
  if (isFresh) {
    const cached = await getCachedAnswer(lang, qnorm, CACHE_TTL_DAYS);
    if (cached) {
      await addMessage(convId, 'assistant', cached, 0);
      if (!clientClosed) {
        streamCached(res, cached);
        res.write(`event: done\ndata: ${JSON.stringify({ conversationId: convId, tokens: 0, cached: true })}\n\n`);
        res.end();
      }
      return;
    }
  }

  try {
    // RAG: procura contexto relevante na base de conhecimento (best-effort).
    let ragContext = null;
    try { ragContext = await retrieve(message); } catch (e) { /* ignora, segue sem RAG */ }

    const stream = await streamChat({ lang, summary, ragContext, history, message, file });

    for await (const chunk of stream) {
      if (clientClosed) break;
      const delta = chunk.text || '';
      if (delta) {
        full += delta;
        res.write(`event: token\ndata: ${JSON.stringify(delta)}\n\n`);
      }
      // O ultimo chunk traz o total de tokens usados (prompt + resposta)
      if (chunk.usageMetadata?.totalTokenCount) totalTokens = chunk.usageMetadata.totalTokenCount;
    }

    // Grava a resposta completa (mesmo que o cliente feche, guardamos o que ha)
    if (full.trim()) {
      await addMessage(convId, 'assistant', full, totalTokens || null);
      // Guarda na cache se foi uma pergunta fresca e a resposta ficou completa.
      if (isFresh && !clientClosed) await putCachedAnswer(lang, qnorm, full);
    }

    if (!clientClosed) {
      res.write(`event: done\ndata: ${JSON.stringify({ conversationId: convId, tokens: totalTokens })}\n\n`);
      res.end();
    }

    // Sumarizacao em segundo plano (nao bloqueia a resposta ja enviada)
    maybeSummarize(convId, lang).catch((e) =>
      console.error('[chat] falha na sumarizacao:', e?.message || e)
    );
  } catch (err) {
    console.error('[chat] erro Gemini:', err?.status || '', err?.message || err);
    const friendly = friendlyError(err, lang);
    if (!clientClosed) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: friendly })}\n\n`);
      res.end();
    }
  }
});

/**
 * Se a conversa acumulou muitas mensagens por resumir, resume as mais antigas
 * (mantendo as ultimas SUMMARY_KEEP no historico) e guarda o resumo. Assim as
 * proximas chamadas enviam menos tokens a API -> menor custo.
 */
async function maybeSummarize(convId, lang) {
  const conv = await getConversation(convId);
  if (!conv) return;
  const pending = await getMessagesAfter(convId, conv.summarized_until || 0);
  if (pending.length <= SUMMARY_TRIGGER) return;

  const toSummarize = pending.slice(0, pending.length - SUMMARY_KEEP);
  if (!toSummarize.length) return;
  const lastId = toSummarize[toSummarize.length - 1].id;

  const newSummary = await summarize(toSummarize, conv.summary, lang);
  if (newSummary) await setSummary(convId, newSummary, lastId);
}

// --- GET /api/conversations?sessionId=... ---
router.get('/conversations', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'sessionId em falta' });
  res.json({ conversations: await listConversations(sessionId) });
});

// --- GET /api/conversation/:id?sessionId=... ---
router.get('/conversation/:id', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  const conv = await getConversation(req.params.id);
  if (!conv || conv.session_id !== sessionId) {
    return res.status(404).json({ error: 'conversa nao encontrada' });
  }
  res.json({ conversation: conv, messages: await getAllMessages(req.params.id) });
});

// --- DELETE /api/conversation/:id ---
router.delete('/conversation/:id', async (req, res) => {
  const sessionId = String(req.query.sessionId || req.body?.sessionId || '').trim();
  const ok = await deleteConversation(req.params.id, sessionId);
  if (!ok) return res.status(404).json({ error: 'conversa nao encontrada' });
  res.json({ ok: true });
});

// --- Mensagens de erro amigaveis (sem expor detalhes internos) ---
function friendlyError(err, lang) {
  const status = err?.status;
  const msgs = {
    pt: {
      quota: 'De momento nao consigo responder (limite do servico atingido). Por favor tente mais tarde ou fale com a equipa pelo WhatsApp.',
      auth: 'Ha um problema de configuracao do servico. Por favor contacte a equipa.',
      generic: 'Ocorreu um erro ao gerar a resposta. Tente novamente dentro de instantes.',
    },
    en: {
      quota: 'I cannot reply right now (service limit reached). Please try again later or contact the team on WhatsApp.',
      auth: 'There is a service configuration issue. Please contact the team.',
      generic: 'An error occurred while generating the reply. Please try again shortly.',
    },
    fr: {
      quota: 'Je ne peux pas repondre pour le moment (limite du service atteinte). Reessayez plus tard ou contactez l\'equipe sur WhatsApp.',
      auth: 'Un probleme de configuration du service est survenu. Veuillez contacter l\'equipe.',
      generic: 'Une erreur est survenue lors de la generation de la reponse. Veuillez reessayer.',
    },
  };
  const t = msgs[lang] || msgs.pt;
  const detail = String(err?.message || '');
  // Gemini (via endpoint compativel-OpenAI): quota -> 429; chave/modelo invalidos -> 400/401/403.
  if (status === 429 || /quota|rate limit/i.test(detail)) return t.quota;
  if (status === 400 || status === 401 || status === 403 || /api[_ ]?key/i.test(detail)) return t.auth;
  return t.generic;
}

export default router;
