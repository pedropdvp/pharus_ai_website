// ============================================================
//  Cria o esquema no PostgreSQL (Neon). Correr UMA vez: npm run init:db
// ============================================================
import '../env.js'; // carrega server/.env (DATABASE_URL) antes de db.js
import { sql } from '../db.js';

if (!process.env.DATABASE_URL) {
  console.error('\n[init-db] ERRO: DATABASE_URL nao definida no server/.env.');
  console.error('Crie uma base de dados gratuita em https://neon.tech e cole a connection string.\n');
  process.exit(1);
}

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id               TEXT PRIMARY KEY,
      session_id       TEXT NOT NULL,
      lang             TEXT NOT NULL DEFAULT 'pt',
      title            TEXT,
      summary          TEXT,
      summarized_until BIGINT NOT NULL DEFAULT 0,
      favorite         BOOLEAN NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // Migracao para BD ja existente (adiciona a coluna se faltar).
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false`;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      content         TEXT NOT NULL,
      tokens          INTEGER,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_msg_conv     ON messages(conversation_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS qa_cache (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      lang       TEXT NOT NULL,
      question   TEXT NOT NULL,
      answer     TEXT NOT NULL,
      hits       INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (lang, question)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      source     TEXT NOT NULL,
      ord        INTEGER NOT NULL,
      text       TEXT NOT NULL,
      embedding  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  console.log('[init-db] esquema criado/verificado com sucesso.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[init-db] falhou:', e?.message || e);
  process.exit(1);
});
