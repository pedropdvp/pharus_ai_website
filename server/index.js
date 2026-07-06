// ============================================================
//  Servidor Express — Chatbot Pharus AI
//  Proxy seguro para a OpenAI. A chave vive so aqui (nunca no browser).
// ============================================================
import './env.js'; // carrega server/.env ANTES de tudo o resto (tem de ser o 1.º import)
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import chatRouter from './routes/chat.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);

// Confia no proxy (nginx) para obter o IP real no rate-limit
app.set('trust proxy', 1);

// --- Seguranca ---
app.use(helmet());

// CORS restrito a origem autorizada (multiplas separadas por virgula)
const allowed = (process.env.ALLOWED_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      // pedidos same-origin / ferramentas (sem Origin) sao permitidos
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error('Origem nao autorizada'));
    },
  })
);

// Limite de tamanho do corpo
app.use(express.json({ limit: '32kb' }));

// Rate limiting (por IP)
app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados pedidos. Aguarde um momento e tente novamente.' },
  })
);

// --- Healthcheck ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- Rotas do chat ---
app.use('/api', chatRouter);

// --- Error handler central ---
app.use((err, _req, res, _next) => {
  console.error('[server] erro:', err?.message || err);
  if (res.headersSent) return;
  const status = err?.message === 'Origem nao autorizada' ? 403 : 500;
  res.status(status).json({ error: 'Erro no servidor.' });
});

app.listen(PORT, () => {
  console.log(`[server] Pharus AI chatbot a correr em http://localhost:${PORT}`);
  console.log(`[server] Origens CORS permitidas: ${allowed.join(', ')}`);
});
