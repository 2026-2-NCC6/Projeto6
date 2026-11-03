import { randomBytes } from 'node:crypto';
import { criarApp } from './app.js';
import { carregarEnv } from './env.js';
import { Memoria } from './memoria.js';
import { EMAIL_AUTOR, EMAIL_PRATICANTE, semear } from './seed.js';

carregarEnv();

const segredoInformado = process.env.JWT_SECRET ?? '';
if (process.env.NODE_ENV === 'production' && segredoInformado.length < 32) {
  console.error('JWT_SECRET com menos de 32 caracteres impede o boot.');
  process.exit(1);
}

const jwtSecret = segredoInformado.length >= 32 ? segredoInformado : randomBytes(32).toString('hex');

async function iniciarInsights(): Promise<void> {
  const conexao = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!conexao) return;
  try {
    const modulo = await import('applicationinsights') as {
      setup?: (cs: string) => { start: () => void };
      default?: { setup: (cs: string) => { start: () => void } };
    };
    const setup = modulo.setup ?? modulo.default?.setup;
    if (!setup) return;
    setup(conexao).start();
  } catch {
    // Sem a variável, ou se o SDK falhar, a API segue com o log JSON.
  }
}

async function main(): Promise<void> {
  await iniciarInsights();
  const siteOrigem = process.env.SITE_ORIGEM || 'http://127.0.0.1:5173';
  if (process.env.SQL_SERVER) {
    const { criarAzureSql, verificarConexao } = await import('./azureSql.js');
    const banco = criarAzureSql();
    const app = criarApp({
      armazenamento: banco,
      jwtSecret,
      siteOrigem,
      producao: process.env.NODE_ENV === 'production',
      verificarBanco: verificarConexao,
    });
    ouvir(app);
    return;
  }

  const memoria = new Memoria();
  const senhaAutor = process.env.SEED_AUTOR_SENHA ?? '';
  const senhaPraticante = process.env.SEED_PRATICANTE_SENHA ?? '';
  if (senhaAutor && senhaPraticante) {
    await semear(memoria, { autor: senhaAutor, praticante: senhaPraticante });
    console.log(`Semente em memória: ${EMAIL_AUTOR} e ${EMAIL_PRATICANTE}.`);
  }
  const app = criarApp({
    armazenamento: memoria,
    jwtSecret,
    siteOrigem,
    producao: process.env.NODE_ENV === 'production',
    verificarBanco: async () => {},
  });
  ouvir(app);
}

function ouvir(app: ReturnType<typeof criarApp>): void {
  const porta = Number(process.env.PORT || 3099);
  app.listen(porta, '0.0.0.0', () => {
    console.log(JSON.stringify({ msg: 'api ouvindo', porta }));
  });
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : 'Falha ao iniciar.');
  process.exit(1);
});
