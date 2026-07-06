# Pharus AI — Backend do Chatbot

Proxy seguro Node/Express entre o widget do site e a API do **Google Gemini** (SDK
nativo `@google/genai`). A chave do Gemini vive **só no servidor** (`.env` / variáveis
de ambiente), nunca no navegador. Base de dados: **PostgreSQL (Neon)**.

## Arranque local (com Neon)

O backend usa Postgres (Neon), por isso precisa de um `DATABASE_URL` mesmo em local.

```bash
# 1) Base de dados gratuita: crie um projeto em https://neon.tech e copie a connection string
# 2) Instalar dependencias (raiz + server)
npm install && (cd server && npm install)
# 3) Configurar segredos
cp server/.env.example server/.env
#    edite server/.env: GEMINI_API_KEY=...   e   DATABASE_URL=postgres://...
# 4) Criar as tabelas e indexar a base de conhecimento (uma vez)
npm run init:db
npm run build:rag
# 5) Arrancar backend + site juntos
npm start                 # site em http://localhost:5173  (backend em :3001)
```

> ⚠️ **Segurança:** ponha os segredos só no `.env` (nunca no código, no `.env.example`,
> no Git ou no navegador). O `.env` está no `.gitignore`.
> Chave Gemini: https://aistudio.google.com/app/apikey · Modelo recomendado: `gemini-2.5-flash`.

## Testar

```bash
# Healthcheck
curl http://localhost:3001/api/health

# Chat (streaming SSE)
curl -N -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"teste-1","message":"Olá, o que fazem?","lang":"pt"}'

# Memória: repita com o mesmo sessionId + o conversationId devolvido no evento "meta"
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/chat` | `{sessionId, conversationId?, message, lang}` → resposta em streaming (SSE: eventos `meta`, `token`, `done`, `error`). |
| GET | `/api/conversations?sessionId=` | Lista conversas da sessão. |
| GET | `/api/conversation/:id?sessionId=` | Mensagens de uma conversa. |
| DELETE | `/api/conversation/:id?sessionId=` | Apaga uma conversa. |
| GET | `/api/health` | Estado do servidor. |

## Base de dados

**PostgreSQL (Neon)**, via driver serverless `@neondatabase/serverless`. Tabelas
`conversations`, `messages`, `qa_cache` (cache de FAQ) e `rag_chunks` (índice do RAG),
criadas por `npm run init:db` (`server/scripts/init-db.js`). Todas as funções em
`db.js` são assíncronas.

## Cache de perguntas frequentes (corte de custos)

A primeira pergunta de cada conversa (sem histórico) é normalizada e guardada em
`qa_cache`. Se outro visitante fizer a mesma pergunta, a resposta é servida da cache
**sem chamar a API** — resposta imediata e sem custo. Configurável por `CACHE_TTL_DAYS`
(dias de validade; `0` = nunca expira). Respostas contextuais (a meio de uma conversa)
nunca são cacheadas.

## RAG — respostas fiéis aos serviços da Pharus

A pasta `knowledge/` contém a base de conhecimento (ficheiros `.md`). O comando abaixo
lê esses ficheiros, gera embeddings com o Gemini e grava o índice em `rag_chunks`:

```bash
npm run build:rag      # precisa da GEMINI_API_KEY no .env
```

Em cada pergunta, o servidor procura os excertos mais relevantes e injeta-os no prompt,
instruindo o modelo a responder **só com base neste conhecimento** (e a encaminhar para a
equipa quando a informação não existir). Para atualizar o conhecimento: edite os ficheiros
em `knowledge/` e volte a correr `npm run build:rag` (depois reinicie o servidor).

Variáveis (opcionais, com defaults): `GEMINI_EMBED_MODEL` (default `gemini-embedding-001` —
o modelo de embeddings disponível nas chaves do Google AI Studio), `RAG_TOP_K` (4),
`RAG_MIN_SCORE` (0.5).

## Deploy (Vercel + Neon)

Arquitetura serverless: o site (Vite → `dist/`) e a função `/api/*` (`api/index.js`,
que reutiliza o router Express) correm na **Vercel**; a base de dados é o **Neon**.
Como tudo fica no mesmo domínio, o widget usa caminho relativo (`/api/...`) — sem CORS.

Passos:
1. **Neon** (https://neon.tech): criar projeto → copiar a `DATABASE_URL`.
2. **Vercel** (https://vercel.com): *Add New → Project* → importar o repositório
   `pedropdvp/pharus_ai_website`. A Vercel deteta o `vercel.json`
   (build `vite build`, output `dist/`, função `api/index.js`).
3. **Environment Variables** no projeto Vercel (Settings → Environment Variables):
   - `GEMINI_API_KEY` = a chave do Google AI Studio
   - `GEMINI_MODEL` = `gemini-2.5-flash`
   - `GEMINI_EMBED_MODEL` = `gemini-embedding-001`
   - `DATABASE_URL` = a connection string do Neon
   - (opcionais) `MAX_HISTORY_MESSAGES`, `SUMMARY_TRIGGER`, `SUMMARY_KEEP`,
     `CACHE_TTL_DAYS`, `RAG_TOP_K`, `RAG_MIN_SCORE`
4. **Inicializar a BD e indexar o RAG** (uma vez, a partir do PC, com o mesmo
   `DATABASE_URL` no `server/.env`): `npm run init:db && npm run build:rag`.
5. **Deploy** (a Vercel faz automaticamente a cada push para `main`).
6. **Domínio**: em Vercel → Settings → Domains, adicionar `pharusai.pt` e apontar o
   DNS do domínio conforme as instruções da Vercel (registo A/CNAME).

Notas:
- O streaming (SSE) funciona nas funções Node da Vercel (`maxDuration` definido no `vercel.json`).
- O rate-limiting em memória não é eficaz em serverless (cada invocação é isolada); se
  precisar de limites, usar um serviço externo (ex.: Upstash) — fica para depois.
