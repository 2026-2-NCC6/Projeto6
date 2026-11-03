import { existsSync, readFileSync } from 'node:fs';

export function carregarEnv(caminho = '.env'): void {
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    const texto = linha.trim();
    if (!texto || texto.startsWith('#')) continue;
    const i = texto.indexOf('=');
    if (i < 1) continue;
    const chave = texto.slice(0, i).trim();
    let valor = texto.slice(i + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}
