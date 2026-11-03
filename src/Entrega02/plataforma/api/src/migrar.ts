import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { carregarEnv } from './env.js';

async function main(): Promise<void> {
  carregarEnv();
  if (!process.env.SQL_SERVER) {
    console.error('SQL_SERVER ausente. A migração só roda com Azure SQL.');
    process.exit(1);
  }
  const { executarScript } = await import('./azureSql.js');
  const arquivo = fileURLToPath(new URL('../sql/001_inicial.sql', import.meta.url));
  await executarScript(readFileSync(arquivo, 'utf8'));
  console.log('Migração 001_inicial aplicada.');
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : 'Falha ao migrar.');
  process.exit(1);
});
