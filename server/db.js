// ============================================================
//  Base de dados — PostgreSQL (Neon), driver serverless.
//  Todas as funcoes sao ASSINCRONAS (retornam Promises).
//  Esquema criado por scripts/init-db.js (correr uma vez).
// ============================================================
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

if (!process.env.DATABASE_URL) {
  console.warn('[db] AVISO: DATABASE_URL nao definida — as queries vao falhar.');
}

// sql`...` -> devolve um array de linhas (tagged template, parametrizado e seguro).
export const sql = neon(process.env.DATABASE_URL || '');

// --- Conversas ---
export async function createConversation(sessionId, lang = 'pt', title = null) {
  const id = randomUUID();
  await sql`INSERT INTO conversations (id, session_id, lang, title) VALUES (${id}, ${sessionId}, ${lang}, ${title})`;
  return id;
}

export async function ensureConversation(conversationId, sessionId, lang = 'pt') {
  if (conversationId) {
    const rows = await sql`SELECT session_id FROM conversations WHERE id = ${conversationId}`;
    if (rows[0] && rows[0].session_id === sessionId) return conversationId;
  }
  return createConversation(sessionId, lang);
}

export async function getConversation(conversationId) {
  const rows = await sql`SELECT * FROM conversations WHERE id = ${conversationId}`;
  return rows[0] || null;
}

export async function listConversations(sessionId) {
  return sql`SELECT id, lang, title, created_at, updated_at
               FROM conversations WHERE session_id = ${sessionId}
              ORDER BY updated_at DESC`;
}

export async function deleteConversation(conversationId, sessionId) {
  const rows = await sql`DELETE FROM conversations
                          WHERE id = ${conversationId} AND session_id = ${sessionId}
                          RETURNING id`;
  return rows.length > 0;
}

export async function setTitleIfEmpty(conversationId, title) {
  await sql`UPDATE conversations SET title = ${title.slice(0, 80)}
             WHERE id = ${conversationId} AND (title IS NULL OR title = '')`;
}

export async function setSummary(conversationId, summary, summarizedUntil) {
  await sql`UPDATE conversations SET summary = ${summary}, summarized_until = ${summarizedUntil}
             WHERE id = ${conversationId}`;
}

// --- Mensagens ---
export async function addMessage(conversationId, role, content, tokens = null) {
  await sql`INSERT INTO messages (conversation_id, role, content, tokens)
             VALUES (${conversationId}, ${role}, ${content}, ${tokens})`;
  await sql`UPDATE conversations SET updated_at = now() WHERE id = ${conversationId}`;
}

export async function getAllMessages(conversationId) {
  return sql`SELECT role, content, tokens, created_at FROM messages
              WHERE conversation_id = ${conversationId} ORDER BY id ASC`;
}

/** Mensagens ainda nao resumidas (id > afterId), ordem cronologica. Inclui o id. */
export async function getMessagesAfter(conversationId, afterId = 0) {
  return sql`SELECT id, role, content FROM messages
              WHERE conversation_id = ${conversationId} AND id > ${afterId}
              ORDER BY id ASC`;
}

/** Apaga a ultima mensagem se for do assistente (usado ao regenerar). */
export async function deleteLastAssistantMessage(conversationId) {
  const rows = await sql`SELECT id, role FROM messages
                          WHERE conversation_id = ${conversationId}
                          ORDER BY id DESC LIMIT 1`;
  const last = rows[0];
  if (last && last.role === 'assistant') {
    await sql`DELETE FROM messages WHERE id = ${last.id}`;
    return true;
  }
  return false;
}

// --- Cache de FAQ ---
export async function getCachedAnswer(lang, questionNorm, maxAgeDays = 30) {
  const rows =
    maxAgeDays > 0
      ? await sql`SELECT answer FROM qa_cache
                   WHERE lang = ${lang} AND question = ${questionNorm}
                     AND created_at > now() - (${maxAgeDays} * interval '1 day')`
      : await sql`SELECT answer FROM qa_cache WHERE lang = ${lang} AND question = ${questionNorm}`;
  if (!rows[0]) return null;
  await sql`UPDATE qa_cache SET hits = hits + 1 WHERE lang = ${lang} AND question = ${questionNorm}`;
  return rows[0].answer;
}

export async function putCachedAnswer(lang, questionNorm, answer) {
  await sql`INSERT INTO qa_cache (lang, question, answer) VALUES (${lang}, ${questionNorm}, ${answer})
             ON CONFLICT (lang, question) DO UPDATE SET answer = EXCLUDED.answer, created_at = now()`;
}

// --- RAG ---
export async function replaceRagChunks(chunks) {
  await sql`DELETE FROM rag_chunks`;
  for (const c of chunks) {
    await sql`INSERT INTO rag_chunks (source, ord, text, embedding)
               VALUES (${c.source}, ${c.ord}, ${c.text}, ${JSON.stringify(c.embedding)})`;
  }
}

export async function getRagChunks() {
  const rows = await sql`SELECT text, embedding FROM rag_chunks`;
  return rows.map((r) => ({
    text: r.text,
    embedding: typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding,
  }));
}
