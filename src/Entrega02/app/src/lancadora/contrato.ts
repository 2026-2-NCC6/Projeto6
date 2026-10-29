// Contrato app ↔ lançadora (PRD §10). Espelha o firmware v2
// (Projeto6/src/Entrega02/main.ino): mesmas operações, mesmo JSON de status,
// nos dois transportes.

import type { TipoTransporte, Velocidade } from '@/dominio/tipos';

export type { Velocidade };

export type EstadoLancadora = 'REPOUSO' | 'ARMADO' | 'LANCANDO' | 'PAUSADO' | 'PARADA_SEGURA';

export type MotivoLancadora =
  | 'checklist'
  | 'desarmada'
  | 'ligar'
  | 'desligar'
  | 'pausar'
  | 'retomar'
  | 'emergencia'
  | 'reiniciada'
  | 'serie_concluida'
  | 'tempo_concluido'
  | 'conexao_perdida';

export type StatusLancadora = {
  estado: EstadoLancadora;
  motivo: MotivoLancadora | null;
  bolasAlvo: number;
  bolasEstimadas: number;
  tempoMs: number;
  msPorBola: number;
  calibrado: boolean;
  // Duty (0–255) da série atual e do alimentador na calibração. Ausentes no firmware 2.0.
  lancador?: number;
  alimentador?: number;
  alimentadorCalib?: number;
  transporte: TipoTransporte | null;
  seq: number;
  resultado: 'ok' | 'nao_autorizado' | 'estado_invalido' | 'invalido' | null;
  fw: string;
};

export type Operacao =
  | 'status'
  | 'ping'
  | 'armar'
  | 'desarmar'
  | 'ligar'
  | 'desligar'
  | 'pausar'
  | 'retomar'
  | 'emergencia'
  | 'reiniciar'
  | 'calibrar';

// O duty da Entrega 01, que o firmware usa quando o app não pede outro.
export const VELOCIDADE_PADRAO: Velocidade = { lancador: 100, alimentador: 25 };

// Argumento por operação: ligar recebe bolas (0 = livre) ou duração, mais a
// velocidade; calibrar recebe ms por bola.
export type Argumento =
  | { bolas: number; velocidade?: Velocidade }
  | { duracaoMs: number; velocidade?: Velocidade }
  | { msPorBola: number }
  | undefined;

export type Resposta = { codigo: 200 | 400 | 401 | 409 | 0; status: StatusLancadora | null };

export interface Transporte {
  readonly tipo: TipoTransporte;
  conectar(): Promise<StatusLancadora>;
  desconectar(): Promise<void>;
  enviar(op: Operacao, arg?: Argumento): Promise<Resposta>;
  // Status empurrado pela lançadora (BLE) ou buscado por polling (Wi-Fi).
  aoMudarStatus(cb: (s: StatusLancadora) => void): () => void;
  aoDesconectar(cb: () => void): () => void;
}

export const WIFI_HOST = 'http://192.168.4.1';
export const WIFI_SSID = 'ESP32_Voz_Direta';

export const BLE_SERVICE = '4e4f434b-4855-4700-8000-00000000a001';
export const BLE_CMD = '4e4f434b-4855-4700-8000-00000000a002';
export const BLE_STATUS = '4e4f434b-4855-4700-8000-00000000a003';

export const TIMEOUT_MS = 1500;
export const HEARTBEAT_MS = 1000; // o watchdog do firmware desliga em 3 s

export function lerStatus(texto: string): StatusLancadora | null {
  try {
    const j = JSON.parse(texto);
    if (typeof j?.estado !== 'string') return null;
    return j as StatusLancadora;
  } catch {
    return null;
  }
}

export function argumentoComoTexto(arg: Argumento): string {
  if (!arg) return '';
  if ('msPorBola' in arg) return String(arg.msPorBola);
  const alvo = 'bolas' in arg ? String(arg.bolas) : `t:${arg.duracaoMs}`;
  return arg.velocidade ? `${alvo},l:${arg.velocidade.lancador},a:${arg.velocidade.alimentador}` : alvo;
}

// Tempo por bola com o alimentador num duty diferente do da calibração: a
// mesma conta do firmware (msPorBolaAtual), para o app estimar a duração.
export function msPorBolaCom(status: Pick<StatusLancadora, 'msPorBola' | 'alimentadorCalib'>, alimentador: number): number {
  const calib = status.alimentadorCalib ?? VELOCIDADE_PADRAO.alimentador;
  return Math.max(300, Math.floor((status.msPorBola * calib) / alimentador));
}
