export const PRESETS = {
  forte: { lancador: 153, alimentador: 77, rotulo: 'Forte' },
  medio: { lancador: 102, alimentador: 64, rotulo: 'Médio' },
  fraco: { lancador: 77, alimentador: 51, rotulo: 'Fraco' },
} as const;

export type PresetNome = keyof typeof PRESETS;

export const REGRA_XP = '1 por bola estimada, mais 20 pela sessão concluída, mais 10 se o dia mantém a sequência.';

export function linhasPrevia(treino: { bolasPorSerie: number; series: number; descansoS: number }): string[] {
  if (treino.bolasPorSerie === 0) return ['Até o praticante dizer desliga'];
  const linhas: string[] = [];
  for (let i = 1; i <= treino.series; i += 1) {
    if (i > 1) linhas.push(`Descanso ${treino.descansoS} s`);
    linhas.push(`Série ${i} de ${treino.series}, ${treino.bolasPorSerie} bolas`);
  }
  return linhas;
}

export function presetDaVelocidade(v?: { lancador: number; alimentador: number }): PresetNome | '' {
  if (!v) return '';
  for (const nome of Object.keys(PRESETS) as PresetNome[]) {
    const alvo = PRESETS[nome];
    if (v.lancador === alvo.lancador && v.alimentador === alvo.alimentador) return nome;
  }
  return '';
}
