// ============================================================
//  Arranque unico: corre o backend (server/) e o site (Vite) juntos.
//  Uso: npm start   (ou: node scripts/dev.js)
//  Chama-se node diretamente (nao os .bin do npm) porque o caminho do
//  projeto tem "&" ("WEB & APPS"), o que parte os atalhos .bin no Windows.
// ============================================================
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const server = path.join(root, 'server', 'index.js');

const procs = [
  { name: 'api ', color: '\x1b[32m', args: [server] },                 // backend (verde)
  { name: 'site', color: '\x1b[36m', args: [vite, '--host'] },         // site Vite (ciano)
];

const children = [];
for (const p of procs) {
  const child = spawn(process.execPath, p.args, { cwd: root });
  children.push(child);
  const tag = `${p.color}[${p.name}]\x1b[0m `;
  const pipe = (stream, out) => stream.on('data', (b) => {
    b.toString().split(/\r?\n/).forEach((line, i, arr) => {
      if (line || i < arr.length - 1) out.write(tag + line + '\n');
    });
  });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(tag + `terminou (codigo ${code})\n`);
    shutdown();
  });
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) { try { c.kill(); } catch {} }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('\x1b[1mPharus AI\x1b[0m — a arrancar backend + site...');
console.log('Abra o site em: \x1b[36mhttp://localhost:5173\x1b[0m   (Ctrl+C para parar)\n');
