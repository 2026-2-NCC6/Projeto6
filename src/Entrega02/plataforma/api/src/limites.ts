// Números copiados de app/src/dominio/velocidade.ts e treinos.ts.
// A API não importa o app Expo.

export const LIMITES = {
  bolasPorSerie: { min: 5, max: 60, passo: 5 },
  series: { min: 1, max: 10, passo: 1 },
  descansoS: { min: 10, max: 120, passo: 5 },
} as const;

export const NOME_MAX = 40;
export const LIMITE_CORPO = 256 * 1024;
export const LIMITE_SERIES = 30;
export const LIMITE_COMANDOS = 500;
export const XP_MAX = 100_000;

export const CATEGORIAS = ['aquecimento', 'resistencia', 'livre', 'personalizado'] as const;
export const OBJETIVOS = ['golpes', 'condicionamento', 'lazer', 'competir'] as const;
export const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;
export const PRESETS = ['forte', 'medio', 'fraco', 'personalizado'] as const;
export const IDS_RESERVADOS = ['aquecimento', 'resistencia', 'livre'] as const;

export type Preset = (typeof PRESETS)[number];
export type Categoria = (typeof CATEGORIAS)[number];
export type Objetivo = (typeof OBJETIVOS)[number];
export type Nivel = (typeof NIVEIS)[number];

const PRESET_PCT = {
  forte: { lancador: 60, alimentador: 30 },
  medio: { lancador: 40, alimentador: 25 },
  fraco: { lancador: 30, alimentador: 20 },
} as const;

export type Velocidade = { lancador: number; alimentador: number };

export function dutyDe(porcento: number): number {
  const limitado = Math.max(0, Math.min(100, porcento));
  return Math.round((limitado * 255) / 100);
}

export function pct(duty: number): number {
  return Math.round((duty * 100) / 255);
}

export function velocidadeDoPreset(preset: keyof typeof PRESET_PCT): Velocidade {
  const p = PRESET_PCT[preset];
  return { lancador: dutyDe(p.lancador), alimentador: dutyDe(p.alimentador) };
}

export function presetDaVelocidade(v: Velocidade): Preset {
  const atual = { lancador: pct(v.lancador), alimentador: pct(v.alimentador) };
  for (const nome of ['forte', 'medio', 'fraco'] as const) {
    const alvo = PRESET_PCT[nome];
    if (atual.lancador === alvo.lancador && atual.alimentador === alvo.alimentador) return nome;
  }
  return 'personalizado';
}

export function velocidadeValida(v: unknown): v is Velocidade {
  if (!v || typeof v !== 'object') return false;
  const { lancador, alimentador } = v as Partial<Velocidade>;
  if (typeof lancador !== 'number' || typeof alimentador !== 'number') return false;
  if (!Number.isInteger(lancador) || !Number.isInteger(alimentador)) return false;
  if (lancador < 0 || lancador > 255 || alimentador < 0 || alimentador > 255) return false;
  const l = pct(lancador);
  const a = pct(alimentador);
  return l >= 0 && l <= 100 && a >= 15 && a <= 40;
}

export function duracaoEstimadaMin(t: { bolasPorSerie: number; series: number; descansoS: number }, msPorBola = 3000): number {
  if (t.bolasPorSerie === 0) return 0;
  const disparo = t.series * t.bolasPorSerie * msPorBola;
  const descanso = Math.max(0, t.series - 1) * t.descansoS * 1000;
  return Math.max(1, Math.round((disparo + descanso) / 60_000));
}

export function segredoAceito(secret: string, nodeEnv: string | undefined): boolean {
  if (nodeEnv === 'production') return secret.length >= 32;
  return true;
}
