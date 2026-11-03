import { hashSenha } from './auth.js';
import type { ComSemente } from './armazenamento.js';
import { carregarEnv } from './env.js';

export const EMAIL_AUTOR = 'autor@nockhug.local';
export const EMAIL_PRATICANTE = 'praticante@nockhug.local';

export function senhaAceita(senha: string): boolean {
  return senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha);
}

export async function semear(alvo: ComSemente, senhas: { autor: string; praticante: string }): Promise<void> {
  if (!senhaAceita(senhas.autor) || !senhaAceita(senhas.praticante)) {
    throw new Error('A senha semente precisa de 8 caracteres, uma letra e um dígito.');
  }
  const agora = new Date().toISOString();
  await alvo.garantirUsuario({
    id: 'u-autor',
    email: EMAIL_AUTOR,
    senhaHash: await hashSenha(senhas.autor),
    nome: 'Autor Demo',
    papel: 'autor',
    criadoEm: agora,
  });
  await alvo.garantirUsuario({
    id: 'u-praticante',
    email: EMAIL_PRATICANTE,
    senhaHash: await hashSenha(senhas.praticante),
    nome: 'Praticante Demo',
    papel: 'praticante',
    criadoEm: agora,
  });
}

async function main(): Promise<void> {
  carregarEnv();
  if (!process.env.SQL_SERVER) {
    console.error('SQL_SERVER ausente. O seed persistente só roda com Azure SQL.');
    process.exit(1);
  }
  const { criarAzureSql } = await import('./azureSql.js');
  const banco = criarAzureSql();
  await semear(banco, {
    autor: process.env.SEED_AUTOR_SENHA ?? '',
    praticante: process.env.SEED_PRATICANTE_SENHA ?? '',
  });
  console.log('Usuários semente conferidos.');
}

const entrada = process.argv[1] ?? '';
if (entrada.endsWith('seed.ts') || entrada.endsWith('seed.js')) {
  main().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : 'Falha ao semear.');
    process.exit(1);
  });
}
