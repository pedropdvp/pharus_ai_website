# Pharus AI — Backend do Chatbot

Proxy seguro Node/Express entre o widget do site e a API do **Google Gemini**.
A chave do Gemini vive **só aqui** (no `.env`), nunca no navegador.

> Nota técnica: usamos o [endpoint do Gemini compatível com a OpenAI](https://ai.google.dev/gemini-api/docs/openai),
> por isso o código reutiliza o SDK `openai` apenas a apontar para a URL do Google.

## Arranque local

```bash
cd server
npm install
cp .env.example .env      # depois edite o .env e ponha a sua chave do Gemini
npm run dev               # arranca em http://localhost:3001 (reinicia ao gravar)
```

> ⚠️ **Segurança:** ponha a chave só no `.env` (nunca no código, Git ou navegador).
> O `.env` está no `.gitignore`. Gere a chave em https://aistudio.google.com/app/apikey.

Confirme o **id exato do modelo** disponível na sua conta em https://ai.google.dev e
coloque-o em `GEMINI_MODEL` no `.env` (ex.: `gemini-2.0-flash`).

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

SQLite (ficheiro `pharus-chat.db`, criado automaticamente). Tabelas `conversations`,
`messages`, `qa_cache` (cache de FAQ) e `rag_chunks` (índice do RAG). Para migrar para
PostgreSQL mais tarde, o esquema em `db.js` é compatível (trocar `better-sqlite3` por
`pg`/Prisma).

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

## Deploy no VPS Hostinger (resumo)

1. Copiar a pasta `server/` para o VPS, `npm install --omit=dev`, criar o `.env`.
2. Correr com **pm2**: `pm2 start index.js --name pharus-chat`.
3. **nginx** — no mesmo `server` block do site, encaminhar `/api` para o Node:
   ```nginx
   location /api/ {
       proxy_pass http://127.0.0.1:3001;
       proxy_http_version 1.1;
       proxy_set_header Connection '';
       proxy_buffering off;          # essencial para o streaming SSE
       chunked_transfer_encoding off;
   }
   ```
4. Pôr `ALLOWED_ORIGIN=https://pharusai.pt` no `.env` e servir tudo por HTTPS.

Como a API fica sob o mesmo domínio (`pharusai.pt/api/...`), o widget usa caminho
relativo em produção e não há problemas de CORS.
