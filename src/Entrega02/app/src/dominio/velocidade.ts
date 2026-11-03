// Velocidade dos motores: presets Forte/Médio/Fraco e o modo Personalizado.
//
// O firmware trabalha com duty de 0 a 255; o praticante escolhe em porcentagem.
// Os limites são regras de produto: o alimentador abaixo de 15% não vence a
// resistência da base, e acima de 40% as bolas entram rápido demais no cano. O
// lançador aceita de 0% (só alimenta, sem arremessar) a 100%.

import type { PresetVelocidade, Velocidade } from './tipos';

export type PresetAtivo = Exclude<PresetVelocidade, 'personalizado'>;
export type Motor = 'lancador' | 'alimentador';

export const LIMITES_MOTOR = {
  lancador: { min: 0, max: 100, passo: 5 },
  alimentador: { min: 15, max: 40, passo: 5 },
} as const;

export const PRESETS: Record<PresetAtivo, { rotulo: string; lancador: number; alimentador: number; descricao: string }> = {
  forte: { rotulo: 'Forte', lancador: 60, alimentador: 30, descricao: 'Bola rápida, pouco tempo entre elas' },
  medio: { rotulo: 'Médio', lancador: 40, alimentador: 25, descricao: 'Ritmo de treino, o mais comum' },
  fraco: { rotulo: 'Fraco', lancador: 30, alimentador: 20, descricao: 'Bola macia, mais tempo para reagir' },
};

export const PRESETS_EM_ORDEM: PresetAtivo[] = ['forte', 'medio', 'fraco'];

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// 255 é 100%; 0 é 0%.
export function pct(duty: number): number {
  return Math.round((duty * 100) / 255);
}

export function dutyDe(porcento: number): number {
  return Math.round(limitar(porcento, 0, 100) * 255 / 100);
}

export function limitarPercentual(motor: Motor, valor: number): number {
  const l = LIMITES_MOTOR[motor];
  return limitar(Math.round(valor), l.min, l.max);
}

// Um passo inteiro de 5% que nunca sai dos limites do motor.
export function passoPercentual(motor: Motor, atual: number, direcao: 1 | -1): number {
  const l = LIMITES_MOTOR[motor];
  return limitarPercentual(motor, atual + direcao * l.passo);
}

export function velocidadeEmPct(v: Velocidade): { lancador: number; alimentador: number } {
  return { lancador: pct(v.lancador), alimentador: pct(v.alimentador) };
}

export function velocidadeDoPreset(preset: PresetAtivo): Velocidade {
  const p = PRESETS[preset];
  return { lancador: dutyDe(p.lancador), alimentador: dutyDe(p.alimentador) };
}

// O preset só é reconhecido se os dois motores estiverem exatamente nele.
export function presetDaVelocidade(v: Velocidade): PresetVelocidade {
  const p = velocidadeEmPct(v);
  for (const preset of PRESETS_EM_ORDEM) {
    const alvo = PRESETS[preset];
    if (p.lancador === alvo.lancador && p.alimentador === alvo.alimentador) return preset;
  }
  return 'personalizado';
}

export function rotuloPreset(preset: PresetVelocidade): string {
  return preset === 'personalizado' ? 'Personalizado' : PRESETS[preset].rotulo;
}

export function rotuloDaVelocidade(v: Velocidade): string {
  return rotuloPreset(presetDaVelocidade(v));
}

export function descreverVelocidade(v: Velocidade): string {
  const p = velocidadeEmPct(v);
  return `${rotuloDaVelocidade(v)} · ${p.lancador}% / ${p.alimentador}%`;
}

export function resumoMotores(v: Velocidade): string {
  const p = velocidadeEmPct(v);
  return `Lançador ${p.lancador}% · Alimentador ${p.alimentador}%`;
}

export function velocidadeIgual(a: Velocidade | undefined, b: Velocidade | undefined): boolean {
  return !!a && !!b && a.lancador === b.lancador && a.alimentador === b.alimentador;
}

export function velocidadeValida(v: Velocidade | undefined | null): v is Velocidade {
  if (!v || !finito(v.lancador) || !finito(v.alimentador)) return false;
  if (v.lancador < 0 || v.lancador > 255 || v.alimentador < 0 || v.alimentador > 255) return false;
  const p = velocidadeEmPct(v);
  return p.lancador >= LIMITES_MOTOR.lancador.min && p.lancador <= LIMITES_MOTOR.lancador.max
    && p.alimentador >= LIMITES_MOTOR.alimentador.min && p.alimentador <= LIMITES_MOTOR.alimentador.max;
}

// Ajusta um motor em 5% a partir do valor atual, respeitando o limite.
export function ajustarMotor(v: Velocidade, motor: Motor, direcao: 1 | -1): Velocidade {
  const atual = velocidadeEmPct(v)[motor];
  return { ...v, [motor]: dutyDe(passoPercentual(motor, atual, direcao)) };
}

// Valor vindo do banco, de uma versão antiga ou de um campo de texto: fica
// dentro dos limites ou é descartado (o treino volta a pedir a definição).
// O duty é limitado direto, sem passar por porcentagem, para não arredondar
// um valor que já estava bom.
export function normalizarVelocidade(v: unknown): Velocidade | null {
  if (!v || typeof v !== 'object') return null;
  const { lancador, alimentador } = v as Partial<Velocidade>;
  if (!finito(lancador) || !finito(alimentador)) return null;
  const lane = Math.max(dutyDe(LIMITES_MOTOR.lancador.min), Math.min(dutyDe(LIMITES_MOTOR.lancador.max), Math.round(lancador)));
  const alim = Math.max(dutyDe(LIMITES_MOTOR.alimentador.min), Math.min(dutyDe(LIMITES_MOTOR.alimentador.max), Math.round(alimentador)));
  return { lancador: lane, alimentador: alim };
}
