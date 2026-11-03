// Regras do descanso entre séries: quando retomar sozinho, quando avisar e o
// que fazer quando o app perde o momento exato (tela bloqueada, app suspenso).

import type { MotivoFimSerie } from './tipos';

// Os motores ligam 5 s depois do aviso sonoro.
export const AVISO_SEGUNDOS = 5;
export const AVISO_MS = AVISO_SEGUNDOS * 1000;

// Se o app só acordou muito depois do fim do descanso, não liga os motores
// sozinho: retomar atrasado seria uma surpresa perigosa em quadra.
export const TOLERANCIA_RETOMADA_MS = 2500;

export type DecisaoFim = 'aguardar' | 'retomar' | 'expirado' | 'manual';
export type SituacaoDescanso = 'contando' | 'avisando' | 'cancelado' | 'pronto';

// Só a série que terminou pelas próprias bolas retoma sozinha. Se o praticante
// disse "desliga", ele quis parar: o próximo "liga" continua sendo dele.
export function podeRetomarAutomaticamente(motivo: MotivoFimSerie, configurado: boolean): boolean {
  return configurado && motivo === 'serie_concluida';
}

export function decidirFimDoDescanso(restanteMs: number, autoRetomar: boolean, toleranciaMs = TOLERANCIA_RETOMADA_MS): DecisaoFim {
  if (restanteMs > 0) return 'aguardar';
  if (!autoRetomar) return 'manual';
  return -restanteMs <= toleranciaMs ? 'retomar' : 'expirado';
}

export function situacaoDescanso(restanteMs: number, autoRetomar: boolean): SituacaoDescanso {
  if (restanteMs <= 0) return 'pronto';
  if (!autoRetomar) return 'cancelado';
  return restanteMs <= AVISO_MS ? 'avisando' : 'contando';
}

// Novo alvo do descanso em curso depois de mudar o tempo configurado. Com a
// retomada automática ligada, o alvo nunca cai a menos de 5 s do agora: o
// aviso sonoro continua valendo.
export function novoAlvoDescanso(alvoAtual: number, deslocamentoMs: number, agora: number, autoRetomar: boolean): number {
  const piso = agora + (autoRetomar ? AVISO_MS : 500);
  return Math.max(piso, alvoAtual + deslocamentoMs);
}

// O aviso de 5 s precisa ter tocado com antecedência; um app que voltou de
// uma suspensão já no fim não pode ligar os motores sem aviso.
export function avisoComAntecedencia(avisoEm: number, agora: number, antecedenciaMs = AVISO_MS - 1000): boolean {
  return avisoEm > 0 && agora - avisoEm >= antecedenciaMs;
}

// Segundos restantes arredondados para cima; 0 quando acabou.
export function segundosRestantes(alvo: number, agora: number): number {
  return Math.max(0, Math.ceil((alvo - agora) / 1000));
}
