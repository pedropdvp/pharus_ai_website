// ============================================================
//  Perguntas sugeridas ("por defeito") do widget — editaveis no painel admin.
//  Guardadas na tabela settings (key 'suggestions') como JSON {pt,en,fr}.
// ============================================================
import { getSetting, setSetting } from './db.js';

const LANGS = ['pt', 'en', 'fr'];

// Defaults focados nos servicos reais da Pharus AI (agencia de IA).
export const DEFAULT_SUGGESTIONS = {
  pt: [
    'Quanto custa um Agente de IA?',
    'Que processos posso automatizar na minha empresa?',
    'Fazem apps web e mobile à medida?',
    'Como funciona a subscrição (AI-as-a-Service)?',
    'Fazem formação em IA para equipas?',
  ],
  en: [
    'How much does an AI Agent cost?',
    'What processes can I automate in my company?',
    'Do you build custom web and mobile apps?',
    'How does the subscription (AI-as-a-Service) work?',
    'Do you provide AI training for teams?',
  ],
  fr: [
    'Combien coûte un Agent IA ?',
    'Quels processus puis-je automatiser dans mon entreprise ?',
    'Créez-vous des applications web et mobiles sur mesure ?',
    'Comment fonctionne l’abonnement (AI-as-a-Service) ?',
    'Proposez-vous des formations en IA pour les équipes ?',
  ],
};

function sanitizeList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 8);
}

/** Devolve {pt,en,fr} — o que estiver guardado, com fallback para os defaults. */
export async function getSuggestions() {
  let stored = null;
  try {
    const raw = await getSetting('suggestions');
    if (raw) stored = JSON.parse(raw);
  } catch (e) { /* usa defaults */ }
  const out = {};
  for (const l of LANGS) {
    const list = stored && Array.isArray(stored[l]) ? sanitizeList(stored[l]) : null;
    out[l] = list && list.length ? list : DEFAULT_SUGGESTIONS[l];
  }
  return out;
}

/** Guarda o objeto {pt,en,fr}. Devolve o objeto normalizado guardado. */
export async function saveSuggestions(obj) {
  const clean = {};
  for (const l of LANGS) clean[l] = sanitizeList(obj && obj[l]);
  await setSetting('suggestions', JSON.stringify(clean));
  return clean;
}
