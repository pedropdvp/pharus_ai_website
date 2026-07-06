// ============================================================
//  Indexacao do RAG
//  Le server/knowledge/*.md, parte em chunks, gera embeddings (Gemini)
//  e grava na tabela rag_chunks. Correr: npm run build:rag
// ============================================================
import '../env.js'; // carrega server/.env ANTES de rag.js/gemini.js (tem de ser o 1.º import)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embed, EMBED_MODEL } from '../rag.js';
import { replaceRagChunks } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, '..', 'knowledge');
const MAX_CHARS = 1200; // tamanho alvo por chunk

if (!process.env.GEMINI_API_KEY) {
  console.error('\n[build-rag] ERRO: GEMINI_API_KEY nao definida.');
  console.error('Crie o ficheiro server/.env (cp .env.example .env) e coloque a chave.\n');
  process.exit(1);
}

/** Parte um documento em chunks por paragrafos, respeitando um tamanho maximo. */
function chunkText(text) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > MAX_CHARS && buf) {
      chunks.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

async function main() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error('[build-rag] pasta nao encontrada:', KNOWLEDGE_DIR);
    process.exit(1);
  }
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => /\.(md|txt)$/i.test(f)).sort();
  if (!files.length) {
    console.error('[build-rag] nenhum ficheiro .md/.txt em', KNOWLEDGE_DIR);
    process.exit(1);
  }

  console.log(`[build-rag] modelo de embeddings: ${EMBED_MODEL}`);
  const items = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8');
    const chunks = chunkText(raw);
    console.log(`  ${file}: ${chunks.length} chunk(s)`);
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embed(chunks[i]);
      items.push({ source: file, ord: i, text: chunks[i], embedding });
    }
  }

  await replaceRagChunks(items);
  console.log(`\n[build-rag] concluido: ${items.length} chunk(s) indexado(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[build-rag] falhou:', e?.message || e);
  process.exit(1);
});
