// Treinos: os prontos do app e os criados pelo praticante, com as regras de
// edição. A velocidade agora é parte do treino (não existe mais uma velocidade
// global nas Configurações), então todo treino precisa dela para ser executado.

import type { PresetVelocidade, Treino, Velocidade } from './tipos';
import { normalizarVelocidade, pct, presetDaVelocidade, rotuloPreset, velocidadeValida } from './velocidade';

export { dutyDe, pct } from './velocidade';

// Os treinos que vêm com o app. Não têm velocidade de fábrica: a primeira
// sessão de cada um pede que o praticante escolha Forte, Médio, Fraco ou
// Personalizado, e a escolha fica gravada no aparelho.
export const TREINOS_PRONTOS: Treino[] = [
  { id: 'aquecimento', nome: 'Aquecimento', bolasPorSerie: 10, series: 3, descansoS: 30, padrao: true },
  { id: 'resistencia', nome: 'Resistência', bolasPorSerie: 20, series: 5, descansoS: 45, padrao: true },
  { id: 'livre', nome: 'Livre', bolasPorSerie: 0, series: 0, descansoS: 0, padrao: true },
];

export const LIMITES = {
  bolasPorSerie: { min: 5, max: 60, passo: 5 },
  series: { min: 1, max: 10, passo: 1 },
  descansoS: { min: 10, max: 120, passo: 5 },
} as const;

export const NOME_MAX = 40;

const inteiro = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : padrao);
const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function clampDescanso(segundos: number): number {
  return limitar(inteiro(segundos, LIMITES.descansoS.min), LIMITES.descansoS.min, LIMITES.descansoS.max);
}

export function ehLivre(t: Treino): boolean {
  return t.bolasPorSerie === 0;
}

export function nomeDoTreino(t: Treino): string {
  return t.nome.trim() || 'Treino sem nome';
}

export function comVelocidade(t: Treino, v: Velocidade, preset?: PresetVelocidade): Treino {
  return { ...t, velocidade: v, preset: preset ?? presetDaVelocidade(v) };
}

// Une os prontos (com as edições do praticante) aos treinos criados por ele.
// A ordem é estável: os três prontos primeiro, depois os criados na ordem em
// que apareceram.
export function unirTreinos(salvos: Treino[]): Treino[] {
  const porId = new Map(salvos.map((t) => [t.id, t]));
  const prontos = TREINOS_PRONTOS.map((p) => {
    const salvo = porId.get(p.id);
    return salvo ? { ...salvo, padrao: true, personalizado: true } : p;
  });
  const criados = salvos.filter((t) => !TREINOS_PRONTOS.some((p) => p.id === t.id));
  return [...prontos, ...criados];
}

export function estaPersonalizado(salvos: Treino[], id: string): boolean {
  return TREINOS_PRONTOS.some((p) => p.id === id) && salvos.some((t) => t.id === id);
}

export function restaurarTreinoPadrao(id: string): Treino | null {
  const p = TREINOS_PRONTOS.find((t) => t.id === id);
  return p ? { ...p } : null;
}

export type CampoTreino = 'nome' | 'bolas' | 'series' | 'descanso' | 'velocidade';
export type ErrosTreino = Partial<Record<CampoTreino, string>>;

export function validarTreino(t: Treino): ErrosTreino {
  const erros: ErrosTreino = {};
  const nome = t.nome.trim();
  if (!nome) erros.nome = 'Dê um nome ao treino.';
  else if (nome.length > NOME_MAX) erros.nome = `Use no máximo ${NOME_MAX} caracteres.`;

  if (!ehLivre(t)) {
    if (!Number.isInteger(t.bolasPorSerie) || t.bolasPorSerie < LIMITES.bolasPorSerie.min || t.bolasPorSerie > LIMITES.bolasPorSerie.max) {
      erros.bolas = `De ${LIMITES.bolasPorSerie.min} a ${LIMITES.bolasPorSerie.max} bolas por série.`;
    }
    if (!Number.isInteger(t.series) || t.series < LIMITES.series.min || t.series > LIMITES.series.max) {
      erros.series = `De ${LIMITES.series.min} a ${LIMITES.series.max} séries.`;
    }
    if (!Number.isInteger(t.descansoS) || t.descansoS < LIMITES.descansoS.min || t.descansoS > LIMITES.descansoS.max) {
      erros.descanso = `De ${LIMITES.descansoS.min} a ${LIMITES.descansoS.max} segundos.`;
    }
  }

  if (!t.velocidade) erros.velocidade = 'Escolha a velocidade dos motores.';
  else if (!velocidadeValida(t.velocidade)) erros.velocidade = 'Lançador de 0 a 100% e alimentador de 15 a 40%.';

  return erros;
}

export function treinoValido(t: Treino): boolean {
  return Object.keys(validarTreino(t)).length === 0;
}

// Traz um treino salvo (de qualquer versão) para as regras de hoje. Nunca
// lança: um registro corrompido vira um treino editável, não uma tela quebrada.
export function sanitizarTreino(bruto: unknown): Treino | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const t = bruto as Partial<Treino> & { pronto?: boolean };
  const id = typeof t.id === 'string' && t.id.trim() ? t.id.trim() : null;
  if (!id) return null;

  const padraoId = TREINOS_PRONTOS.find((p) => p.id === id);
  const padrao = !!padraoId || t.padrao === true || t.pronto === true;
  const bolas = limitar(inteiro(t.bolasPorSerie, padraoId?.bolasPorSerie ?? 15), 0, LIMITES.bolasPorSerie.max);
  const livre = bolas === 0;
  const series = livre ? 0 : limitar(inteiro(t.series, padraoId?.series ?? 4), LIMITES.series.min, LIMITES.series.max);
  const descansoS = livre ? 0 : clampDescanso(inteiro(t.descansoS, padraoId?.descansoS ?? 40));
  const nome = (typeof t.nome === 'string' && t.nome.trim() ? t.nome.trim() : padraoId?.nome ?? 'Treino').slice(0, NOME_MAX);
  const velocidade = normalizarVelocidade(t.velocidade) ?? undefined;
  const origem = t.origem === 'plataforma' ? 'plataforma' as const : undefined;
  const versaoPublicada = typeof t.versaoPublicada === 'number' && Number.isInteger(t.versaoPublicada) && t.versaoPublicada >= 0
    ? t.versaoPublicada
    : undefined;

  return {
    id,
    nome,
    bolasPorSerie: livre ? 0 : Math.max(LIMITES.bolasPorSerie.min, bolas),
    series,
    descansoS,
    padrao,
    ...(padrao && t.personalizado === true ? { personalizado: true } : {}),
    ...(velocidade ? { velocidade, preset: presetDaVelocidade(velocidade) } : {}),
    ...(origem ? { origem } : {}),
    ...(versaoPublicada !== undefined ? { versaoPublicada } : {}),
  };
}

export function descreverTreino(t: Treino): string {
  const base = ehLivre(t) ? 'Até você dizer “desliga”' : `${t.series} × ${t.bolasPorSerie} bolas · descanso ${t.descansoS} s`;
  if (!t.velocidade) return `${base} · velocidade a definir`;
  const v = t.velocidade;
  return `${base} · ${rotuloPreset(presetDaVelocidade(v))} ${pct(v.lancador)}% / ${pct(v.alimentador)}%`;
}

// msPorBola já ajustado à velocidade do alimentador do treino (msPorBolaCom).
export function duracaoEstimadaMin(t: Treino, msPorBola: number): number {
  if (ehLivre(t)) return 0;
  const disparo = t.series * t.bolasPorSerie * msPorBola;
  const descanso = Math.max(0, t.series - 1) * t.descansoS * 1000;
  return Math.max(1, Math.round((disparo + descanso) / 60000));
}

// Um passo inteiro dentro dos limites (o formulário usa para bolas, séries e descanso).
export function passoNumero(atual: number, delta: number, l: { min: number; max: number }): number {
  return limitar(Math.round(atual + delta), l.min, l.max);
}

export function novoIdTreino(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
