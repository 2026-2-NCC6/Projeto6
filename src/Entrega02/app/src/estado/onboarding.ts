// Rascunho do perfil enquanto o praticante percorre o onboarding. Só vira
// Perfil gravado na última etapa.

import { create } from 'zustand';
import type { Mao, Nivel, Objetivo } from '@/dominio/tipos';
import { useApp } from './app';

type Rascunho = {
  nome: string;
  sobrenome: string;
  idade: string;
  nivel: Nivel;
  mao: Mao;
  objetivos: Objetivo[];
  metaSemanal: number;
  fotoUri: string | null;
  aceiteLgpd: boolean;
  cienciaResponsavel: boolean;
  palavra: string;
  mudar(p: Partial<Omit<Rascunho, 'mudar'>>): void;
};

export const useRascunho = create<Rascunho>((set) => ({
  nome: '',
  sobrenome: '',
  idade: '',
  nivel: 'iniciante',
  mao: 'destro',
  objetivos: [],
  metaSemanal: 3,
  fotoUri: null,
  aceiteLgpd: false,
  cienciaResponsavel: false,
  palavra: 'Nock',
  mudar: (p) => set(p),
}));

// Grava o perfil e a palavra de ativação e encerra o onboarding.
export async function finalizarOnboarding() {
  const r = useRascunho.getState();
  const app = useApp.getState();
  await app.salvarPerfil({
    nome: r.nome.trim(),
    sobrenome: r.sobrenome.trim(),
    idade: Number(r.idade),
    nivel: r.nivel,
    mao: r.mao,
    objetivos: r.objetivos,
    metaSemanal: r.metaSemanal,
    fotoUri: r.fotoUri,
    cienciaResponsavel: r.cienciaResponsavel,
    aceiteLgpdEm: app.perfil?.aceiteLgpdEm ?? Date.now(),
  });
  await app.atualizarConfig({ palavraAtivacao: r.palavra.trim() || 'Nock' });
}

// Preenche o rascunho a partir do perfil gravado (edição em Configurações).
export function carregarRascunho() {
  const { perfil, config } = useApp.getState();
  if (!perfil) return;
  useRascunho.getState().mudar({
    nome: perfil.nome,
    sobrenome: perfil.sobrenome,
    idade: String(perfil.idade),
    nivel: perfil.nivel,
    mao: perfil.mao,
    objetivos: perfil.objetivos,
    metaSemanal: perfil.metaSemanal,
    fotoUri: perfil.fotoUri,
    cienciaResponsavel: perfil.cienciaResponsavel,
    aceiteLgpd: true,
    palavra: config.palavraAtivacao,
  });
}

export function validarPerfil(r: Rascunho): string | null {
  const idade = Number(r.idade);
  if (!r.nome.trim()) return 'Informe seu nome.';
  if (!Number.isInteger(idade) || idade <= 0 || idade > 110) return 'Informe uma idade válida.';
  if (idade < 13) return 'O NockHug é para maiores de 13 anos. O modo criança ainda não está disponível.';
  if (idade < 18 && !r.cienciaResponsavel) return 'Menores de 18 precisam da ciência do responsável.';
  if (!r.aceiteLgpd) return 'Aceite o uso dos dados neste aparelho para continuar.';
  return null;
}
