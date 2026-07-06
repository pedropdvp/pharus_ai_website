// Carrega o server/.env por caminho absoluto (ao lado deste ficheiro), para o backend
// funcionar seja qual for a pasta de arranque (raiz do projeto ou server/).
// Importar ESTE modulo ANTES de qualquer modulo que leia process.env (ex.: gemini.js).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });
