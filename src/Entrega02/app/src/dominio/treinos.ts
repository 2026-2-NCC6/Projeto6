import type { Treino, Velocidade } from './tipos';

export const TREINOS_PRONTOS: Treino[] = [
  { id: 'aquecimento', nome: 'Aquecimento', bolasPorSerie: 10, series: 3, descansoS: 30, pronto: true },
  { id: 'resistencia', nome: 'Resistência', bolasPorSerie: 20, series: 5, descansoS: 45, pronto: true },
  { id: 'livre', nome: 'Livre', bolasPorSerie: 0, series: 0, descansoS: 0, pronto: true },
];

export const LIMITES = {
  bolasPorSerie: { min: 5, max: 60, passo: 5 },
  series: { min: 1, max: 10, passo: 1 },
  descansoS: { min: 10, max: 120, passo: 5 },
  // Em % do PWM máximo (255).
  lancadorPct: { min: 20, max: 100, passo: 5 },
  alimentadorPct: { min: 5, max: 50, passo: 5 },
};

export const pct = (duty: number) => Math.round((duty * 100) / 255);
export const dutyDe = (porcento: number) => Math.round((porcento * 255) / 100);

// Passo de 5 % que encaixa nos múltiplos de 5: 39 % (o padrão) vai a 40 % ou 35 %.
export function passoPct(atual: number, direcao: 1 | -1, l: { min: number; max: number; passo: number }): number {
  const base = direcao > 0 ? Math.floor(atual / l.passo) * l.passo + l.passo : Math.ceil(atual / l.passo) * l.passo - l.passo;
  return Math.max(l.min, Math.min(l.max, base));
}

export function velocidadeDoTreino(t: Treino, padrao: Velocidade): Velocidade {
  return t.velocidade ?? padrao;
}

export function ehLivre(t: Treino): boolean {
  return t.bolasPorSerie === 0;
}

export function descreverTreino(t: Treino): string {
  if (ehLivre(t)) return 'Dispara até você dizer “desliga”';
  const base = `${t.series} × ${t.bolasPorSerie} bolas · descanso ${t.descansoS} s`;
  return t.velocidade ? `${base} · lançador ${pct(t.velocidade.lancador)}%` : base;
}

// msPorBola já ajustado à velocidade do alimentador do treino (msPorBolaCom).
export function duracaoEstimadaMin(t: Treino, msPorBola: number): number {
  if (ehLivre(t)) return 0;
  const disparo = t.series * t.bolasPorSerie * msPorBola;
  const descanso = Math.max(0, t.series - 1) * t.descansoS * 1000;
  return Math.max(1, Math.round((disparo + descanso) / 60000));
}
