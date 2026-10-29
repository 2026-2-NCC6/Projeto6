// A sessão em andamento: do checklist ao resultado (PRD §7 e §9.3).
//
// Quem manda no estado dos motores é a lançadora. Esta store só (1) confere a
// trava antes de enviar um comando, (2) registra cada comando e (3) observa o
// status para fechar séries, abrir o descanso e encerrar o treino.

import { create } from 'zustand';
import { xpDaSessao } from '@/dominio/gamificacao';
import { ehLivre, velocidadeDoTreino } from '@/dominio/treinos';
import type { MotivoFimSerie, MotivoFimSessao, OrigemComando, RegistroComando, Serie, Sessao, Treino } from '@/dominio/tipos';
import type { Comando } from '@/dominio/vocabulario';
import { resumir, useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import type { EstadoLancadora, Operacao, StatusLancadora } from '@/lancadora/contrato';

export type Fase = 'pronta' | 'lancando' | 'pausada' | 'descanso' | 'parada' | 'encerrada';

type EstadoSessao = {
  id: string | null;
  treino: Treino | null;
  inicio: number;
  fase: Fase;
  series: Serie[];
  comandos: RegistroComando[];
  inicioSerie: number;
  descansoAte: number;
  conexaoPerdida: boolean;
  ultimoEstado: EstadoLancadora | null;
  armar(treino: Treino): Promise<{ ok: boolean; erro?: string }>;
  executar(c: Comando, origem: OrigemComando, transcricao?: string): Promise<{ aceito: boolean; frase: string }>;
  reiniciarAposParada(): Promise<boolean>;
  aoStatus(s: StatusLancadora): string | null; // devolve uma frase para anunciar
  encerrar(motivo: MotivoFimSessao): Promise<string | null>; // id da sessão gravada
  descartar(): void;
};

const OPERACAO: Record<Comando, Operacao> = {
  ligar: 'ligar',
  desligar: 'desligar',
  pausar: 'pausar',
  retomar: 'retomar',
  emergencia: 'emergencia',
};

// Frases do retorno falado. Nenhuma pode conter "para", "pare" ou "socorro":
// o app ouviria a si mesmo e acionaria a emergência.
const FRASE_OK: Record<Comando, string> = {
  ligar: 'Ligando',
  desligar: 'Desligado',
  pausar: 'Pausado',
  retomar: 'Retomando',
  emergencia: 'Parada segura',
};

function recusa(c: Comando, e: EstadoLancadora | undefined): string | null {
  if (c === 'emergencia') return null;
  if (!e) return 'Sem conexão com a lançadora';
  if (e === 'PARADA_SEGURA') return 'Lançadora bloqueada. Reinicie primeiro';
  if (c === 'ligar' && e !== 'ARMADO') return e === 'LANCANDO' ? 'Já está ligada' : e === 'PAUSADO' ? 'Está pausada. Diga retoma' : 'Primeiro arme a lançadora';
  if (c === 'desligar' && e !== 'LANCANDO' && e !== 'PAUSADO') return 'Já está desligada';
  if (c === 'pausar' && e !== 'LANCANDO') return 'Nada a pausar';
  if (c === 'retomar' && e !== 'PAUSADO') return 'Nada a retomar';
  return null;
}

const novoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useSessao = create<EstadoSessao>((set, get) => ({
  id: null,
  treino: null,
  inicio: 0,
  fase: 'pronta',
  series: [],
  comandos: [],
  inicioSerie: 0,
  descansoAte: 0,
  conexaoPerdida: false,
  ultimoEstado: null,

  async armar(treino) {
    const r = await useLancadora.getState().enviar('armar');
    if (r.codigo !== 200) {
      const erro = r.codigo === 0 ? 'A lançadora não respondeu.' : r.codigo === 401 ? 'Token recusado.' : 'A lançadora não aceitou armar agora.';
      return { ok: false, erro };
    }
    // Uma sessão nova, ou a mesma sessão rearmada depois de uma parada segura.
    if (!get().id || get().fase === 'encerrada') {
      set({ id: novoId(), treino, inicio: Date.now(), series: [], comandos: [], descansoAte: 0 });
    }
    set({ fase: 'pronta', conexaoPerdida: false, ultimoEstado: r.status?.estado ?? 'ARMADO' });
    return { ok: true };
  },

  async executar(c, origem, transcricao = '') {
    const lanc = useLancadora.getState();
    const estado = lanc.conexao === 'conectada' || lanc.conexao === 'perdida' ? lanc.status?.estado : undefined;
    const registrar = (aceito: boolean, motivo: string | null, latenciaMs: number | null) =>
      set({ comandos: [...get().comandos, { ts: Date.now(), origem, transcricao, comando: c, aceito, motivo, latenciaMs }] });

    // Trava no app (a lançadora confere de novo: ADR 0004).
    const { treino, series } = get();
    const concluido = c === 'ligar' && !!treino && !ehLivre(treino) && series.length >= treino.series;
    const negado = concluido ? 'Treino concluído. Veja o resultado' : recusa(c, estado);
    if (negado) {
      registrar(false, negado, null);
      return { aceito: false, frase: negado };
    }

    const velocidade = treino ? velocidadeDoTreino(treino, useApp.getState().config.velocidadePadrao) : undefined;
    const arg = c === 'ligar' ? { bolas: treino && !ehLivre(treino) ? treino.bolasPorSerie : 0, velocidade } : undefined;
    const r = await lanc.enviar(OPERACAO[c], arg);
    if (r.codigo !== 200) {
      const motivo = r.codigo === 0 ? 'Sem resposta da lançadora' : r.codigo === 401 ? 'Token recusado' : 'Comando recusado';
      registrar(false, motivo, r.latenciaMs);
      return { aceito: false, frase: motivo };
    }
    registrar(true, null, r.latenciaMs);
    if (c === 'ligar') set({ inicioSerie: Date.now(), descansoAte: 0 });
    if (r.status) get().aoStatus(r.status);
    return { aceito: true, frase: FRASE_OK[c] };
  },

  async reiniciarAposParada() {
    const r = await useLancadora.getState().enviar('reiniciar');
    if (r.codigo === 200) set({ ultimoEstado: 'REPOUSO' });
    return r.codigo === 200;
  },

  aoStatus(s) {
    const { ultimoEstado, treino, series, fase, id } = get();
    if (!id || fase === 'encerrada' || !treino) return null;
    if (s.estado === ultimoEstado) return null;
    set({ ultimoEstado: s.estado });

    const estavaDisparando = ultimoEstado === 'LANCANDO' || ultimoEstado === 'PAUSADO';
    const fecharSerie = (motivo: MotivoFimSerie) => {
      const bolas = s.bolasAlvo > 0 ? Math.min(s.bolasEstimadas, s.bolasAlvo) : s.bolasEstimadas;
      const serie: Serie = { indice: series.length + 1, bolas, inicio: get().inicioSerie, fim: Date.now(), motivo };
      set({ series: [...series, serie] });
      return serie;
    };

    switch (s.estado) {
      case 'LANCANDO':
        set({ fase: 'lancando', conexaoPerdida: false });
        return null;
      case 'PAUSADO':
        set({ fase: 'pausada', conexaoPerdida: s.motivo === 'conexao_perdida' });
        return s.motivo === 'conexao_perdida' ? 'Conexão perdida. Motores parados' : null;
      case 'PARADA_SEGURA':
        if (estavaDisparando) fecharSerie('emergencia');
        set({ fase: 'parada' });
        return null;
      case 'ARMADO': {
        if (!estavaDisparando) {
          set({ fase: 'pronta' });
          return null;
        }
        fecharSerie(s.motivo === 'serie_concluida' ? 'serie_concluida' : 'desligar');
        if (ehLivre(treino)) {
          set({ fase: 'pronta' });
          return null;
        }
        if (get().series.length >= treino.series) {
          set({ fase: 'pronta' });
          return 'Treino concluído';
        }
        set({ fase: 'descanso', descansoAte: Date.now() + treino.descansoS * 1000 });
        return 'Série concluída. Descanse';
      }
      default:
        return null;
    }
  },

  async encerrar(motivo) {
    const lanc = useLancadora.getState();
    const e = lanc.status?.estado;
    if ((e === 'LANCANDO' || e === 'PAUSADO') && lanc.status) {
      const ultimo = lanc.status;
      const r = await lanc.enviar('desligar');
      // Fecha a série em andamento antes de gravar. Sem resposta, vale o último status.
      get().aoStatus(r.status ?? { ...ultimo, estado: 'ARMADO', motivo: 'desligar' });
    }
    if (e === 'ARMADO' || e === 'LANCANDO' || e === 'PAUSADO') await lanc.enviar('desarmar');
    const { id, treino, inicio, series, comandos } = get();

    // Sem nenhuma série, não houve treino: nada é gravado.
    if (!id || !treino || series.length === 0) {
      get().descartar();
      return null;
    }
    const app = useApp.getState();
    const bolas = series.reduce((t, x) => t + x.bolas, 0);
    const sessao: Sessao = {
      id,
      treino,
      inicio,
      fim: Date.now(),
      transporte: lanc.alvo?.simulado ? 'simulada' : (lanc.alvo?.tipo ?? 'wifi'),
      series,
      comandos,
      encerradaPor: motivo,
      xp: xpDaSessao(bolas, inicio, app.sessoes.map(resumir)),
    };
    await app.registrarSessao(sessao);
    set({ fase: 'encerrada' });
    return id;
  },

  descartar() {
    set({ id: null, treino: null, series: [], comandos: [], fase: 'pronta', ultimoEstado: null, descansoAte: 0, conexaoPerdida: false });
  },
}));
