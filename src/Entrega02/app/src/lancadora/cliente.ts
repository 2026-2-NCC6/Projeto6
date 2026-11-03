// Cliente da lançadora: guarda a conexão ativa, o último status e mantém o
// heartbeat que alimenta o watchdog do firmware.
//
// Todos os comandos passam por uma fila única. O servidor do ESP32 atende uma
// requisição por vez, e dois comandos disparados juntos (voz + botão, por
// exemplo) chegariam fora de ordem: um "desliga" poderia ser respondido antes
// do "liga" que o precedeu.
//
// O ping do heartbeat entra na mesma fila, e não é pulado: o firmware para os
// motores em 4 s sem sinal. Ele pode esperar um comando, mas não pode sumir.

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
  // Tempo de ida e volta do último comando aceito; aparece no diagnóstico.
  ultimaLatenciaMs: number | null;
  conectar(alvo: Alvo): Promise<boolean>;
  reconectar(): Promise<boolean>;
  desconectar(): Promise<void>;
  // aindaValido é conferido quando o comando chega à vez dele na fila: um
  // "ligar" cancelado enquanto esperava um ping não sai.
  enviar(op: Operacao, arg?: Argumento, aindaValido?: () => boolean): Promise<Resposta & { latenciaMs: number }>;
  // Emergência: não entra na fila e não espera um comando em curso.
  enviarUrgente(op: Operacao, arg?: Argumento): Promise<Resposta & { latenciaMs: number }>;
};

let transporte: Transporte | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let cancelar: (() => void)[] = [];
let fila: Promise<unknown> = Promise.resolve();
// Cada conectar() pega uma geração; um conectar antigo que resolva depois não
// pode instalar um segundo heartbeat/transporte.
let geracao = 0;

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

function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = fila.then(tarefa, tarefa);
  fila = proxima.then(
    () => undefined,
    () => undefined,
  );
  return proxima;
}

export const useLancadora = create<ClienteLancadora>((set, get) => ({
  conexao: 'desconectada',
  alvo: null,
  status: null,
  erro: null,
  ultimaLatenciaMs: null,

  async conectar(alvo) {
    await get().desconectar();
    const minha = ++geracao;
    set({ conexao: 'conectando', alvo, erro: null, ultimaLatenciaMs: null });
    const t = criarTransporte(alvo);
    try {
      const status = await t.conectar();
      if (minha !== geracao) {
        await t.desconectar().catch(() => undefined);
        return false;
      }
      transporte = t;
      cancelar.push(t.aoMudarStatus((s) => set({ status: s })));
      cancelar.push(t.aoDesconectar(() => set({ conexao: 'perdida' })));
      heartbeat = setInterval(() => {
        // Sem pular: o ping pode esperar a fila, mas não pode desaparecer.
        void get()
          .enviar('ping')
          .then((r) => {
            if (r.codigo === 200 && get().conexao === 'perdida') set({ conexao: 'conectada' });
            if (r.codigo === 401) set({ erro: 'Token recusado pela lançadora.' });
          })
          .catch(() => undefined);
      }, HEARTBEAT_MS);
      set({ conexao: 'conectada', status });
      return true;
    } catch (e) {
      await t.desconectar().catch(() => undefined);
      if (minha !== geracao) return false;
      set({ conexao: 'desconectada', erro: e instanceof Error ? e.message : 'Não foi possível conectar.' });
      return false;
    }
  },

  async reconectar() {
    const a = get().alvo;
    return a ? get().conectar(a) : false;
  },

  async desconectar() {
    geracao++;
    limpar();
    const t = transporte;
    transporte = null;
    if (t) await t.desconectar().catch(() => undefined);
    set({ conexao: 'desconectada', status: null, ultimaLatenciaMs: null });
  },

  enviar(op, arg, aindaValido) {
    return emFila(async () => {
      const inicio = Date.now();
      if (aindaValido && !aindaValido()) {
        return { codigo: 0 as const, status: get().status, falha: 'cancelado' as const, latenciaMs: 0 };
      }
      if (!transporte) {
        return { codigo: 0 as const, status: null, falha: 'rede' as const, latenciaMs: 0 };
      }
      const r = await transporte.enviar(op, arg);
      const latenciaMs = Date.now() - inicio;
      const resposta = { ...r, latenciaMs };
      if (r.status) set({ status: r.status });
      if (r.codigo === 200) {
        // O ping de sucesso não prova que o token do usuário voltou a valer:
        // só um comando real limpa o erro de token.
        set(op === 'ping' ? { ultimaLatenciaMs: latenciaMs } : { erro: null, ultimaLatenciaMs: latenciaMs });
      } else {
        set({ ultimaLatenciaMs: latenciaMs });
        if (r.codigo === 401) set({ erro: 'Token recusado pela lançadora.' });
      }
      return resposta;
    });
  },

  async enviarUrgente(op, arg) {
    const t = transporte;
    const inicio = Date.now();
    if (!t) return { codigo: 0 as const, status: null, falha: 'rede' as const, latenciaMs: 0 };
    try {
      const r = await t.enviar(op, arg, true);
      const latenciaMs = Date.now() - inicio;
      if (r.status) set({ status: r.status });
      if (r.codigo === 200) set({ erro: null, ultimaLatenciaMs: latenciaMs });
      else set({ ultimaLatenciaMs: latenciaMs });
      return { ...r, latenciaMs };
    } catch {
      return { codigo: 0 as const, status: null, falha: 'rede' as const, latenciaMs: Date.now() - inicio };
    }
  },
}));
