// ============================================================
//  RAG — Retrieval Augmented Generation
//  Embeddings via Gemini + pesquisa por similaridade (cosseno).
//  O indice vive na tabela rag_chunks (ver scripts/build-rag.js).
// ============================================================
import { ai } from './gemini.js';
import { getRagChunks } from './db.js';

export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
const TOP_K = Number(process.env.RAG_TOP_K || 4);
const MIN_SCORE = Number(process.env.RAG_MIN_SCORE || 0.5);

/** Gera o embedding (Array<number>) de um texto. */
export async function embed(text) {
  const resp = await ai.models.embedContent({ model: EMBED_MODEL, contents: text });
  const values = resp.embeddings?.[0]?.values || resp.embedding?.values;
  if (!values) throw new Error('embedContent nao devolveu valores');
  return values;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Cache em memoria dos chunks (carregados uma vez por instancia).
let _chunks = null;
async function loadChunks() {
  if (_chunks === null) _chunks = await getRagChunks();
  return _chunks;
}
/** Forca recarregar o indice (usado apos reindexacao). */
export function resetRagCache() { _chunks = null; }

/**
 * Devolve o contexto relevante para uma pergunta (string) ou null se nao houver indice
 * ou nenhum chunk suficientemente relevante. Best-effort: nunca deita a rota abaixo.
 */
export async function retrieve(query) {
  const chunks = await loadChunks();
  if (!chunks.length) return null;
  let qv;
  try {
    qv = await embed(query);
  } catch (e) {
    console.error('[rag] falha ao gerar embedding da pergunta:', e?.message || e);
    return null;
  }
  const scored = chunks
    .map((c) => ({ text: c.text, score: cosine(qv, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .filter((c) => c.score >= MIN_SCORE)
    .slice(0, TOP_K);

  if (!scored.length) return null;
  return scored.map((c) => c.text).join('\n\n---\n\n');
}
