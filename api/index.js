// ============================================================
//  Funcao serverless da Vercel — serve todas as rotas /api/*
//  Reutiliza o mesmo router Express do backend (server/routes/chat.js).
//  As variaveis de ambiente (GEMINI_API_KEY, DATABASE_URL, ...) vêm das
//  Environment Variables do projeto Vercel — nao ha .env aqui.
// ============================================================
import express from 'express';
import helmet from 'helmet';
import chatRouter from '../server/routes/chat.js';
import adminRouter from '../server/routes/admin.js';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', chatRouter); // -> /api/chat, /api/conversations, /api/conversation/:id
app.use('/api', adminRouter); // -> /api/admin/stats

// Mesma origem que o site (Vercel), por isso nao e preciso CORS.
export default app;

// Node.js runtime + tempo suficiente para respostas em streaming.
export const config = { maxDuration: 30 };
