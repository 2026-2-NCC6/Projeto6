// Cliente da lançadora: guarda a conexão ativa, o último status e mantém o
// heartbeat que alimenta o watchdog do firmware.

import { create } from 'zustand';
import type { TipoTransporte } from '@/dominio/tipos';
import { TransporteBle } from './ble';
import { type Argumento, HEARTBEAT_MS, type Operacao, type Resposta, type StatusLancadora, type Transporte } from './contrato';
import { TransporteSimulado } from './simulador';
import { TransporteWifi } from './wifi';

export type EstadoConexao = 'desconectada' | 'conectando' | 'conectada' | 'perdida';

type Alvo = { tipo: TipoTransporte; token: string; bleId?: string; nome: string; simulado?: boolean };

type ClienteLancadora = {
  conexao: EstadoConexao;
  alvo: Alvo | null;
  status: StatusLancadora | null;
  erro: string | null;
  conectar(alvo: Alvo): Promise<boolean>;
  reconectar(): Promise<boolean>;
  desconectar(): Promise<void>;
  enviar(op: Operacao, arg?: Argumento): Promise<Resposta & { latenciaMs: number }>;
};

let transporte: Transporte | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let cancelar: (() => void)[] = [];

function criarTransporte(a: Alvo): Transporte {
  if (a.simulado) return new TransporteSimulado(a.token);
  if (a.tipo === 'ble') return new TransporteBle(a.token, a.bleId ?? '');
  return new TransporteWifi(a.token);
}

function limpar() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  cancelar.forEach((c) => c());
  cancelar = [];
}

export const useLancadora = create<ClienteLancadora>((set, get) => ({
  conexao: 'desconectada',
  alvo: null,
  status: null,
  erro: null,

  async conectar(alvo) {
    await get().desconectar();
    set({ conexao: 'conectando', alvo, erro: null });
    const t = criarTransporte(alvo);
    try {
      const status = await t.conectar();
      transporte = t;
      cancelar.push(t.aoMudarStatus((s) => set({ status: s })));
      cancelar.push(t.aoDesconectar(() => set({ conexao: 'perdida' })));
      heartbeat = setInterval(() => {
        void t.enviar('ping').then((r) => {
          if (r.codigo === 200 && get().conexao === 'perdida') set({ conexao: 'conectada' });
          if (r.codigo === 401) set({ erro: 'Token recusado pela lançadora.' });
        });
      }, HEARTBEAT_MS);
      set({ conexao: 'conectada', status });
      return true;
    } catch (e) {
      await t.desconectar().catch(() => undefined);
      set({ conexao: 'desconectada', erro: e instanceof Error ? e.message : 'Não foi possível conectar.' });
      return false;
    }
  },

  async reconectar() {
    const a = get().alvo;
    return a ? get().conectar(a) : false;
  },

  async desconectar() {
    limpar();
    const t = transporte;
    transporte = null;
    if (t) await t.desconectar().catch(() => undefined);
    set({ conexao: 'desconectada', status: null });
  },

  async enviar(op, arg) {
    const inicio = Date.now();
    if (!transporte) return { codigo: 0, status: null, latenciaMs: 0 };
    const r = await transporte.enviar(op, arg);
    if (r.status) set({ status: r.status });
    if (r.codigo === 401) set({ erro: 'Token recusado pela lançadora.' });
    return { ...r, latenciaMs: Date.now() - inicio };
  },
}));
