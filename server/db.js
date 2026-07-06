// ============================================================
//  Base de dados (SQLite via better-sqlite3)
//  Guarda conversas e mensagens por sessao de visitante.
//  Esquema pensado para migrar facilmente para PostgreSQL.
// ============================================================
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH
  ? path.resolve(__dirname, process.env.DB_PATH)
  : path.resolve(__dirname, 'pharus-chat.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    lang        TEXT NOT NULL DEFAULT 'pt',
    title       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content          TEXT NOT NULL,
    tokens           INTEGER,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id);
  CREATE INDEX IF NOT EXISTS idx_msg_conv     ON messages(conversation_id);
`);

// --- Migracao: colunas de resumo (memoria de longo prazo / corte de custos) ---
const convCols = db.prepare(`PRAGMA table_info(conversations)`).all().map((c) => c.name);
if (!convCols.includes('summary')) {
  db.exec(`ALTER TABLE conversations ADD COLUMN summary TEXT`);
}
if (!convCols.includes('summarized_until')) {
  db.exec(`ALTER TABLE conversations ADD COLUMN summarized_until INTEGER NOT NULL DEFAULT 0`);
}

// --- Cache de perguntas frequentes (corte de custos) e chunks de RAG ---
db.exec(`
  CREATE TABLE IF NOT EXISTS qa_cache (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lang       TEXT NOT NULL,
    question   TEXT NOT NULL,
    answer     TEXT NOT NULL,
    hits       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (lang, question)
  );

  CREATE TABLE IF NOT EXISTS rag_chunks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    source     TEXT NOT NULL,
    ord        INTEGER NOT NULL,
    text       TEXT NOT NULL,
    embedding  TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Prepared statements ---
const stmt = {
  insertConversation: db.prepare(
    `INSERT INTO conversations (id, session_id, lang, title) VALUES (?, ?, ?, ?)`
  ),
  getConversation: db.prepare(
    `SELECT * FROM conversations WHERE id = ?`
  ),
  touchConversation: db.prepare(
    `UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`
  ),
  setTitle: db.prepare(
    `UPDATE conversations SET title = ? WHERE id = ?`
  ),
  listBySession: db.prepare(
    `SELECT id, lang, title, created_at, updated_at
       FROM conversations
      WHERE session_id = ?
      ORDER BY updated_at DESC`
  ),
  deleteConversation: db.prepare(
    `DELETE FROM conversations WHERE id = ?`
  ),
  insertMessage: db.prepare(
    `INSERT INTO messages (conversation_id, role, content, tokens) VALUES (?, ?, ?, ?)`
  ),
  listMessages: db.prepare(
    `SELECT role, content, tokens, created_at
       FROM messages
      WHERE conversation_id = ?
      ORDER BY id ASC`
  ),
  recentMessages: db.prepare(
    `SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY id DESC
      LIMIT ?`
  ),
  messagesAfter: db.prepare(
    `SELECT id, role, content FROM messages
      WHERE conversation_id = ? AND id > ?
      ORDER BY id ASC`
  ),
  setSummary: db.prepare(
    `UPDATE conversations SET summary = ?, summarized_until = ? WHERE id = ?`
  ),
  lastMessage: db.prepare(
    `SELECT id, role FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1`
  ),
  deleteMessage: db.prepare(`DELETE FROM messages WHERE id = ?`),
  getCache: db.prepare(
    `SELECT answer, created_at FROM qa_cache WHERE lang = ? AND question = ?`
  ),
  bumpCache: db.prepare(
    `UPDATE qa_cache SET hits = hits + 1 WHERE lang = ? AND question = ?`
  ),
  putCache: db.prepare(
    `INSERT INTO qa_cache (lang, question, answer) VALUES (?, ?, ?)
     ON CONFLICT(lang, question) DO UPDATE SET answer = excluded.answer, created_at = datetime('now')`
  ),
  clearRag: db.prepare(`DELETE FROM rag_chunks`),
  insertChunk: db.prepare(
    `INSERT INTO rag_chunks (source, ord, text, embedding) VALUES (?, ?, ?, ?)`
  ),
  allChunks: db.prepare(`SELECT text, embedding FROM rag_chunks`),
};

/** Cria uma nova conversa e devolve o seu id. */
export function createConversation(sessionId, lang = 'pt', title = null) {
  const id = randomUUID();
  stmt.insertConversation.run(id, sessionId, lang, title);
  return id;
}

/** Garante que a conversa existe e pertence a sessao; senao cria uma nova. */
export function ensureConversation(conversationId, sessionId, lang = 'pt') {
  if (conversationId) {
    const conv = stmt.getConversation.get(conversationId);
    if (conv && conv.session_id === sessionId) return conversationId;
  }
  return createConversation(sessionId, lang);
}

export function addMessage(conversationId, role, content, tokens = null) {
  stmt.insertMessage.run(conversationId, role, content, tokens);
  stmt.touchConversation.run(conversationId);
}

/** Devolve as ultimas N mensagens (ordem cronologica) para dar contexto a API. */
export function getRecentMessages(conversationId, limit = 12) {
  const rows = stmt.recentMessages.all(conversationId, limit);
  return rows.reverse(); // recentMessages vem em ordem decrescente
}

/** Mensagens ainda nao resumidas (id > afterId), em ordem cronologica. Inclui o id. */
export function getMessagesAfter(conversationId, afterId = 0) {
  return stmt.messagesAfter.all(conversationId, afterId);
}

/** Guarda o resumo da conversa e ate que mensagem (id) ele cobre. */
export function setSummary(conversationId, summary, summarizedUntil) {
  stmt.setSummary.run(summary, summarizedUntil, conversationId);
}

/** Apaga a ultima mensagem se for do assistente (usado ao regenerar). Devolve true se apagou. */
export function deleteLastAssistantMessage(conversationId) {
  const last = stmt.lastMessage.get(conversationId);
  if (last && last.role === 'assistant') {
    stmt.deleteMessage.run(last.id);
    return true;
  }
  return false;
}

// --- Cache de FAQ ---
/** Devolve a resposta em cache (se existir e nao expirada) e incrementa hits. */
export function getCachedAnswer(lang, questionNorm, maxAgeDays = 30) {
  const row = stmt.getCache.get(lang, questionNorm);
  if (!row) return null;
  if (maxAgeDays > 0) {
    const ageMs = Date.now() - new Date(row.created_at + 'Z').getTime();
    if (ageMs > maxAgeDays * 86400000) return null;
  }
  stmt.bumpCache.run(lang, questionNorm);
  return row.answer;
}

export function putCachedAnswer(lang, questionNorm, answer) {
  stmt.putCache.run(lang, questionNorm, answer);
}

// --- RAG ---
export function replaceRagChunks(chunks) {
  const tx = db.transaction((items) => {
    stmt.clearRag.run();
    for (const c of items) stmt.insertChunk.run(c.source, c.ord, c.text, JSON.stringify(c.embedding));
  });
  tx(chunks);
}

/** Devolve todos os chunks com o embedding ja parseado para Array<number>. */
export function getRagChunks() {
  return stmt.allChunks.all().map((r) => ({ text: r.text, embedding: JSON.parse(r.embedding) }));
}

export function getAllMessages(conversationId) {
  return stmt.listMessages.all(conversationId);
}

export function listConversations(sessionId) {
  return stmt.listBySession.all(sessionId);
}

export function deleteConversation(conversationId, sessionId) {
  const conv = stmt.getConversation.get(conversationId);
  if (!conv || conv.session_id !== sessionId) return false;
  stmt.deleteConversation.run(conversationId);
  return true;
}

export function setTitleIfEmpty(conversationId, title) {
  const conv = stmt.getConversation.get(conversationId);
  if (conv && !conv.title) stmt.setTitle.run(title.slice(0, 80), conversationId);
}

export function getConversation(conversationId) {
  return stmt.getConversation.get(conversationId);
}

export default db;
