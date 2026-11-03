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
  | 'resetada'
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
  resultado: 'ok' | 'nao_autorizado' | 'estado_invalido' | 'invalido' | 'limite' | null;
  fw: string;
  // Diagnóstico do firmware 2.2+: a última operação e o motivo da recusa
  // (por exemplo, "estado:PAUSADO" ou "limite"). Ausentes em firmware antigo.
  op?: string | null;
  erro?: string | null;
  // Firmware 2.4+: contadores só em RAM. Ausentes no firmware anterior,
  // então lerStatus continua aceitando o JSON antigo.
  negados?: number;
  negadosJanela?: number;
  ultimoNegadoVia?: 'wifi' | 'ble' | null;
  ultimoNegadoMs?: number | null;
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
  | 'resetar' // firmware 2.3+: qualquer estado (menos parada segura) → REPOUSO
  | 'calibrar';

// O duty da Entrega 01, que o firmware usa quando o app não pede outro (ou
// quando o status antigo não traz alimentadorCalib). Não é um preset do app:
// o alimentador a 25/255 fica abaixo do piso de 15% que os treinos exigem.
export const VELOCIDADE_PADRAO: Velocidade = { lancador: 100, alimentador: 25 };

// Argumento por operação: ligar recebe bolas (0 = livre) ou duração, mais a
// velocidade; calibrar recebe ms por bola.
export type Argumento =
  | { bolas: number; velocidade?: Velocidade }
  | { duracaoMs: number; velocidade?: Velocidade }
  | { msPorBola: number; alimentador?: number }
  | undefined;

export type Resposta = {
  codigo: 200 | 400 | 401 | 409 | 429 | 0;
  status: StatusLancadora | null;
  // Quando a resposta não veio: tempo esgotado, rede fora ou JSON estranho.
  // 'cancelado': o app desistiu do comando antes de ele sair da fila.
  falha?: 'timeout' | 'rede' | 'resposta_invalida' | 'cancelado';
  latenciaMs?: number;
};

export interface Transporte {
  readonly tipo: TipoTransporte;
  conectar(): Promise<StatusLancadora>;
  desconectar(): Promise<void>;
  // urgente fura as filas do app e do transporte (emergência).
  enviar(op: Operacao, arg?: Argumento, urgente?: boolean): Promise<Resposta>;
  // Status empurrado pela lançadora (BLE) ou buscado por polling (Wi-Fi).
  aoMudarStatus(cb: (s: StatusLancadora) => void): () => void;
  aoDesconectar(cb: () => void): () => void;
}

export const WIFI_HOST = 'http://192.168.4.1';
export const WIFI_SSID = 'Quadra-Local';

export const BLE_SERVICE = '4e4f434b-4855-4700-8000-00000000a001';
export const BLE_CMD = '4e4f434b-4855-4700-8000-00000000a002';
export const BLE_STATUS = '4e4f434b-4855-4700-8000-00000000a003';

export const TIMEOUT_MS = 1500;
// Um comando pode esperar mais que o status: a lançadora processa a fila do
// servidor e ainda responde. O ping continua curto para alimentar o watchdog.
export const TIMEOUT_COMANDO_MS = 2000;
export const HEARTBEAT_MS = 750; // o watchdog do firmware desliga em 4 s

const ESTADOS_CONHECIDOS = new Set(['REPOUSO', 'ARMADO', 'LANCANDO', 'PAUSADO', 'PARADA_SEGURA']);

export function lerStatus(texto: string): StatusLancadora | null {
  try {
    const j = JSON.parse(texto);
    if (!j || typeof j.estado !== 'string' || !ESTADOS_CONHECIDOS.has(j.estado)) return null;
    // Um status truncado/corrompido não pode virar série com NaN.
    for (const campo of ['bolasAlvo', 'bolasEstimadas', 'tempoMs', 'msPorBola', 'seq']) {
      if (!Number.isFinite(j[campo])) return null;
    }
    return j as StatusLancadora;
  } catch {
    return null;
  }
}

export function argumentoComoTexto(arg: Argumento): string {
  if (!arg) return '';
  if ('msPorBola' in arg) return arg.alimentador != null ? `${arg.msPorBola},a:${arg.alimentador}` : String(arg.msPorBola);
  const alvo = 'bolas' in arg ? String(arg.bolas) : `t:${arg.duracaoMs}`;
  return arg.velocidade ? `${alvo},l:${arg.velocidade.lancador},a:${arg.velocidade.alimentador}` : alvo;
}

// Tempo por bola com o alimentador num duty diferente do da calibração: a
// mesma conta do firmware (msPorBolaAtual), para o app estimar a duração.
export function msPorBolaCom(status: Pick<StatusLancadora, 'msPorBola' | 'alimentadorCalib'>, alimentador: number): number {
  const calib = status.alimentadorCalib ?? VELOCIDADE_PADRAO.alimentador;
  // O firmware tem o mesmo piso; evita divisão por zero com um status estranho.
  return Math.max(300, Math.floor((status.msPorBola * calib) / Math.max(1, alimentador)));
}
