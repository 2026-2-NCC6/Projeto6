// Partida dos motores: toda vez que os motores vão ligar (o "liga" falado, o
// botão, o "retoma" depois da pausa ou a retomada no fim do descanso), o app
// conta 5 s com um bip por segundo antes de mandar o comando. É o tempo de o
// praticante se posicionar e, se quiser, cancelar com "Nock, desliga".

import { AVISO_MS } from './descanso';
import type { OrigemComando } from './tipos';
import type { Comando } from './vocabulario';

export type ComandoPartida = 'ligar' | 'retomar';

// 'pedido': o praticante pediu (voz ou botão). 'descanso': a retomada
// automática agendada para o fim do descanso.
export type OrigemPartida = 'pedido' | 'descanso';

export type Partida = {
  id: number;
  em: number; // instante em que o comando sai para a lançadora
  comando: ComandoPartida;
  origem: OrigemPartida;
};

export const CONTAGEM_MS = AVISO_MS;
export const CONTAGEM_SEGUNDOS = CONTAGEM_MS / 1000;

export function ehPartida(c: Comando): c is ComandoPartida {
  return c === 'ligar' || c === 'retomar';
}

// O que interrompe uma contagem: "desliga", "pausa" ou "Nock, para". O "Para!"
// sem a palavra de ativação e o botão vermelho são emergência de verdade e vão
// à lançadora (que também cancela a contagem).
export function cancelaPartida(c: Comando, origem: OrigemComando, ativada: boolean): boolean {
  if (origem === 'auto') return false;
  if (c === 'desligar' || c === 'pausar') return true;
  return c === 'emergencia' && origem === 'voz' && ativada;
}

// Segundo da contagem que está correndo (5 a 1), ou null fora dela.
export function segundoDaContagem(restanteMs: number): number | null {
  if (!Number.isFinite(restanteMs) || restanteMs <= 0 || restanteMs > CONTAGEM_MS) return null;
  return Math.ceil(restanteMs / 1000);
}

// O bip deste instante, se ainda não tocou: um por segundo, do 5 ao 1. Se o
// relógio pulou (app suspenso), toca só o segundo atual, nunca uma rajada.
export function bipDevido(restanteMs: number, ultimoSegundo: number): number | null {
  const s = segundoDaContagem(restanteMs);
  return s !== null && s < ultimoSegundo ? s : null;
}

// Um "liga" no meio do descanso pula o resto dele, mas a contagem de 5 s
// continua valendo. Se a retomada automática já sai antes disso, ela vence.
export function instanteDaPartida(agora: number, partidaAtual: Pick<Partida, 'em'> | null): number {
  const pedido = agora + CONTAGEM_MS;
  return partidaAtual ? Math.min(partidaAtual.em, pedido) : pedido;
}
