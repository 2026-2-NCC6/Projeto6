import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');
const filhos = [];

function subir(comando, args, opts) {
  const child = spawn(comando, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  let texto = '';
  child.stdout.on('data', (parte) => { texto += parte; });
  child.stderr.on('data', (parte) => { texto += parte; });
  filhos.push(child);
  return { child, texto: () => texto };
}

function encerrar(child) {
  if (!child?.pid || child.killed) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try { child.kill('SIGTERM'); } catch { /* já encerrou */ }
  }
}

async function esperar(url) {
  const limite = Date.now() + 30_000;
  while (Date.now() < limite) {
    try {
      const resposta = await fetch(url);
      if (resposta.ok) return;
    } catch { /* ainda subindo */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`não respondeu: ${url}`);
}

const ambienteApi = { ...process.env, PORT: '3099', JWT_SECRET: 'a'.repeat(48), SEED_AUTOR_SENHA: 'demo1234', SEED_PRATICANTE_SENHA: 'demo1234', SITE_ORIGEM: 'http://127.0.0.1:5173', NODE_ENV: 'development' };
delete ambienteApi.SQL_SERVER;

const api = subir('npx', ['tsx', 'src/index.ts'], { cwd: path.join(raiz, 'api'), env: ambienteApi });
const site = subir('npx', ['vite', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  cwd: path.join(raiz, 'site'),
  env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:3099' },
});

let codigo = 1;
try {
  await esperar('http://127.0.0.1:3099/v1/saude');
  await esperar('http://127.0.0.1:5173');
  const teste = spawn('npx', ['playwright', 'test'], { cwd: aqui, stdio: 'inherit', env: process.env });
  codigo = await new Promise((resolve) => teste.on('exit', (saida) => resolve(saida ?? 1)));
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  console.error(api.texto());
  console.error(site.texto());
  codigo = 1;
} finally {
  for (const filho of filhos) encerrar(filho);
}
process.exit(codigo);
