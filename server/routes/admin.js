// ============================================================
//  Rotas de administracao (protegidas por ADMIN_TOKEN)
//  GET /api/admin/stats  -> metricas de uso, tokens e custo estimado
// ============================================================
import { Router } from 'express';
import { sql } from '../db.js';

const router = Router();

// Preco estimado por 1 milhao de tokens (blended input+output), em EUR. Ajustavel por env.
const PRICE_EUR_PER_MTOK = Number(process.env.GEMINI_PRICE_EUR_PER_MTOK || 0.5);

// Middleware simples de autenticacao por token (header x-admin-token ou ?token=).
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return res.status(503).json({ error: 'Painel admin nao configurado (defina ADMIN_TOKEN).' });
  const got = req.get('x-admin-token') || req.query.token || '';
  if (got !== expected) return res.status(401).json({ error: 'Nao autorizado.' });
  next();
}

router.get('/admin/stats', requireAdmin, async (_req, res) => {
  try {
    const [totals] = await sql`
      SELECT
        (SELECT count(*) FROM conversations)                             AS conversations,
        (SELECT count(*) FROM messages)                                  AS messages,
        (SELECT count(*) FROM messages WHERE role = 'user')              AS user_messages,
        (SELECT count(*) FROM messages WHERE role = 'assistant')         AS assistant_messages,
        (SELECT COALESCE(SUM(tokens), 0) FROM messages)                  AS total_tokens,
        (SELECT count(*) FROM conversations WHERE created_at > now() - interval '7 days')  AS conversations_7d,
        (SELECT COALESCE(SUM(hits), 0) FROM qa_cache)                    AS cache_hits,
        (SELECT count(*) FROM rag_chunks)                                AS rag_chunks`;

    const byLang = await sql`SELECT lang, count(*)::int AS n FROM conversations GROUP BY lang ORDER BY n DESC`;
    const topQuestions = await sql`
      SELECT question, hits, lang FROM qa_cache ORDER BY hits DESC, created_at DESC LIMIT 10`;
    const perDay = await sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS n
        FROM messages WHERE created_at > now() - interval '14 days'
       GROUP BY day ORDER BY day`;

    const totalTokens = Number(totals.total_tokens) || 0;
    const estCostEur = (totalTokens / 1_000_000) * PRICE_EUR_PER_MTOK;

    res.json({
      totals: {
        conversations: Number(totals.conversations),
        messages: Number(totals.messages),
        userMessages: Number(totals.user_messages),
        assistantMessages: Number(totals.assistant_messages),
        totalTokens,
        conversations7d: Number(totals.conversations_7d),
        cacheHits: Number(totals.cache_hits),
        ragChunks: Number(totals.rag_chunks),
      },
      cost: { estimatedEur: Number(estCostEur.toFixed(4)), pricePerMTokEur: PRICE_EUR_PER_MTOK },
      byLang,
      topQuestions,
      perDay,
    });
  } catch (err) {
    console.error('[admin] erro:', err?.message || err);
    res.status(500).json({ error: 'Erro ao obter estatisticas.' });
  }
});

export default router;
