// A sessão em andamento: do checklist ao resultado (PRD §7 e §9.3).
//
// Quem manda no estado dos motores é a lançadora. Esta store só (1) confere a
// trava antes de enviar um comando, (2) registra cada comando e (3) observa o
// status para fechar séries, abrir o descanso e encerrar o treino.
//
// Partida: nenhum motor liga sem aviso. "Liga" e "retoma" (voz ou botão) e a
// retomada no fim do descanso viram uma `partida` agendada para daqui a 5 s;
// o relógio que toca os bips e dispara o comando é o usePartidaAgendada. Até
// lá, "Nock, desliga", "Nock, pausa" ou "Nock, para" cancelam.

import { create } from 'zustand';
import { novoAlvoDescanso, podeRetomarAutomaticamente } from '@/dominio/descanso';
import { xpDaSessao } from '@/dominio/gamificacao';
import { cancelaPartida, CONTAGEM_MS, ehPartida, instanteDaPartida, type Partida } from '@/dominio/partida';
import { clampDescanso, comVelocidade, ehLivre } from '@/dominio/treinos';
import type { MotivoFimSerie, MotivoFimSessao, OrigemComando, RegistroComando, Serie, Sessao, Treino, Velocidade } from '@/dominio/tipos';
import type { Comando } from '@/dominio/vocabulario';
import { resumir, useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import type { EstadoLancadora, Operacao, StatusLancadora } from '@/lancadora/contrato';
import { classificarFalha, comandoAplicado, precisaReparar, type FalhaLancadora } from '@/lancadora/falhas';
import { repararLancadora } from '@/lancadora/manutencao';

export type Fase = 'pronta' | 'lancando' | 'pausada' | 'descanso' | 'parada' | 'encerrada';

// Por que o descanso não vai retomar sozinho. A tela usa isso para explicar em
// vez de mostrar um botão sem motivo.
export type MotivoSemRetomada = 'configuracao' | 'desligou' | 'cancelada' | 'falha' | 'concluido';

// silencioso: a confirmação é sonora de outro jeito (os bips da contagem), sem
// retorno falado por cima.
export type ResultadoComando = { aceito: boolean; frase: string; falha?: FalhaLancadora; silencioso?: boolean };
export type ResultadoArmar = { ok: boolean; erro?: string; falha?: FalhaLancadora };

type EstadoSessao = {
  id: string | null;
  treino: Treino | null;
  inicio: number;
  fase: Fase;
  series: Serie[];
  comandos: RegistroComando[];
  inicioSerie: number;
  descansoAte: number;
  descansoIniciadoEm: number;
  // A retomada automática do descanso em curso está de pé (há uma partida de
  // origem 'descanso' agendada).
  autoRetomar: boolean;
  motivoSemRetomada: MotivoSemRetomada | null;
  // A próxima vez que os motores ligam, com a contagem de 5 s.
  partida: Partida | null;
  conexaoPerdida: boolean;
  ultimoEstado: EstadoLancadora | null;
  ultimaFalha: FalhaLancadora | null;
  // Enquanto o encerramento está em curso, o status não abre um descanso.
  encerrando: boolean;
  // O praticante cancelou a partida enquanto o comando já estava a caminho:
  // se a lançadora ligar mesmo assim, o app desliga em seguida.
  partidaCancelada: boolean;
  // O fim da série veio de um "desliga" do praticante: não retomar sozinho.
  paradaManual: boolean;
  armar(treino: Treino): Promise<ResultadoArmar>;
  executar(c: Comando, origem: OrigemComando, transcricao?: string, ativada?: boolean): Promise<ResultadoComando>;
  dispararPartida(id: number): Promise<ResultadoComando>;
  ajustarDescanso(deltaSegundos: number): void;
  cancelarPartida(): string | null;
  fimDoDescanso(): string | null;
  falharPartida(falha: FalhaLancadora | null): void;
  definirVelocidadeSessao(v: Velocidade): void;
  registrarFalha(f: FalhaLancadora | null): void;
  limparFalha(): void;
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

// Frases do retorno falado. O app ouve a própria voz, então nenhuma pode
// conter "para", "pare" ou "socorro" (emergência sem prefixo). As que contêm
// outro comando só valeriam depois da palavra de ativação, que o app nunca diz.
const FRASE_OK: Record<Comando, string> = {
  ligar: 'Ligando',
  desligar: 'Desligado',
  pausar: 'Pausado',
  retomar: 'Retomando',
  emergencia: 'Parada segura',
};

const FRASE_CONTAGEM = 'Motores em 5 segundos';
export const FRASE_CANCELADA = 'Partida cancelada';

function recusa(c: Comando, e: EstadoLancadora | undefined): string | null {
  if (c === 'emergencia') return null;
  if (!e) return 'Sem conexão com a lançadora';
  if (e === 'PARADA_SEGURA') return 'Lançadora bloqueada. Reinicie primeiro';
  if (c === 'ligar' && e !== 'ARMADO') return e === 'LANCANDO' ? 'Já está ligada' : e === 'PAUSADO' ? 'Está pausada' : 'Primeiro arme a lançadora';
  if (c === 'desligar' && e !== 'LANCANDO' && e !== 'PAUSADO') return 'Já está desligada';
  if (c === 'pausar' && e !== 'LANCANDO') return 'Não há nada em andamento';
  if (c === 'retomar' && e !== 'PAUSADO') return 'Não há nada em andamento';
  return null;
}

const novoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Um comando por vez. Sem isso, a partida automática e um comando falado no
// mesmo instante mandariam dois comandos e a lançadora recusaria o segundo.
let comandoEmVoo = false;
// A partida que já saiu para a lançadora e ainda não voltou.
let partidaEmVoo = false;
let proximaPartida = 0;
// A série aberta pelo "liga" que foi desfeito logo em seguida (cancelamento
// durante a partida) não conta como série do treino.
let ignorarProximaSerie = false;

// Estado "sem partida e sem descanso automático", usado em todo lugar que
// precisa garantir que nenhum motor vai ligar sozinho.
const SEM_PARTIDA = { partida: null, autoRetomar: false } as const;

export const useSessao = create<EstadoSessao>((set, get) => ({
  id: null,
  treino: null,
  inicio: 0,
  fase: 'pronta',
  series: [],
  comandos: [],
  inicioSerie: 0,
  descansoAte: 0,
  descansoIniciadoEm: 0,
  autoRetomar: false,
  motivoSemRetomada: null,
  partida: null,
  conexaoPerdida: false,
  ultimoEstado: null,
  ultimaFalha: null,
  encerrando: false,
  partidaCancelada: false,
  paradaManual: false,

  async armar(treino) {
    if (!treino.velocidade) {
      return { ok: false, erro: 'Escolha a velocidade dos motores antes de armar.' };
    }
    set({ ultimaFalha: null, ...SEM_PARTIDA });

    let r = await useLancadora.getState().enviar('armar');
    // Pode repetir uma vez quando a resposta se perdeu. O firmware limita a
    // mesma op a 1 s: se o primeiro armar foi aceito, o segundo volta 429 com
    // a máquina já ARMADO, e isso é sucesso. 429 em REPOUSO continua falha
    // (aguardar 1 s), sem um segundo retry.
    if (r.codigo === 0) {
      await espera(250);
      r = await useLancadora.getState().enviar('armar');
      if (r.codigo === 429 && r.status?.estado === 'ARMADO') r = { ...r, codigo: 200 };
    }

    if (r.codigo !== 200) {
      let falha = classificarFalha('armar', r, useLancadora.getState().status);
      // Máquina presa numa série anterior (ligada ou pausada pelo watchdog):
      // desliga, desarma e tenta de novo, sem pedir nada ao praticante.
      if (precisaReparar(falha)) {
        const reparo = await repararLancadora();
        if (reparo.ok) {
          r = await useLancadora.getState().enviar('armar');
          falha = r.codigo === 200 ? null : classificarFalha('armar', r, useLancadora.getState().status);
        } else if (reparo.falha) {
          falha = reparo.falha;
        }
      }
      if (r.codigo !== 200) {
        falha ??= classificarFalha('armar', r, useLancadora.getState().status);
        set({ ultimaFalha: falha });
        return { ok: false, erro: falha?.titulo ?? 'A lançadora não armou.', falha: falha ?? undefined };
      }
    }

    // Uma sessão nova, ou a mesma sessão rearmada depois de uma parada segura.
    if (!get().id || get().fase === 'encerrada') {
      set({ id: novoId(), treino, inicio: Date.now(), series: [], comandos: [] });
    } else {
      set({ treino });
    }
    set({
      fase: 'pronta',
      conexaoPerdida: false,
      ultimoEstado: r.status?.estado ?? 'ARMADO',
      ultimaFalha: null,
      ...SEM_PARTIDA,
      descansoAte: 0,
      descansoIniciadoEm: 0,
      motivoSemRetomada: null,
      encerrando: false,
      partidaCancelada: false,
      paradaManual: false,
    });
    return { ok: true };
  },

  async executar(c, origem, transcricao = '', ativada = true) {
    const lanc = useLancadora.getState();
    const estado = lanc.conexao === 'conectada' || lanc.conexao === 'perdida' ? lanc.status?.estado : undefined;
    const registrar = (aceito: boolean, motivo: string | null, latenciaMs: number | null, comando: Comando = c) =>
      set({ comandos: [...get().comandos, { ts: Date.now(), origem, transcricao, comando, aceito, motivo, latenciaMs }] });

    const { treino, series, fase, partida } = get();

    // Uma contagem (ou a retomada do descanso) em curso é cancelada por
    // "desliga", "pausa" ou "Nock, para" antes de qualquer outra coisa: os
    // motores ainda estão parados, então nada precisa ir à lançadora. Vale
    // também com a partida já a caminho (partidaEmVoo).
    if (cancelaPartida(c, origem, ativada) && (partida || partidaEmVoo || fase === 'descanso')) {
      const frase = get().cancelarPartida();
      // "Nock, para" aqui cancelou a partida, não houve emergência: o registro
      // usa desligar para a tela de parada segura não confundir.
      registrar(true, 'partida cancelada', null, c === 'emergencia' ? 'desligar' : c);
      // Pausada com um "retoma" agendado: o "desliga" também encerra a série.
      if (!(c === 'desligar' && estado === 'PAUSADO')) {
        return { aceito: true, frase: frase ?? 'Nada para cancelar' };
      }
    }

    // A emergência não espera a fila nem um comando em curso: é o caminho mais
    // curto até os motores pararem.
    if (c === 'emergencia') {
      set({ ...SEM_PARTIDA, partidaCancelada: true });
      let r = await useLancadora.getState().enviarUrgente('emergencia');
      if (r.codigo === 200 && r.status?.estado !== 'PARADA_SEGURA') {
        // Sem o status no corpo (ou com um corpo estranho), confirma lendo.
        const s = await useLancadora.getState().enviar('status');
        if (s.status) r = { ...r, status: s.status };
      }
      if (r.codigo === 200 && r.status?.estado === 'PARADA_SEGURA') {
        registrar(true, null, r.latenciaMs);
        set({ ultimaFalha: null });
        get().aoStatus(r.status);
        return { aceito: true, frase: FRASE_OK.emergencia };
      }
      const base = classificarFalha('emergencia', r, useLancadora.getState().status);
      const falha = base
        ? {
            ...base,
            titulo: 'Não confirmei a parada',
            corpo: 'O comando de emergência saiu, mas a lançadora não confirmou a parada segura. Toque em Parar tudo de novo; se não responder, corte a energia da máquina.',
            acao: 'tentar' as const,
          }
        : null;
      registrar(false, falha?.titulo ?? 'Emergência não confirmada', r.latenciaMs);
      if (falha) set({ ultimaFalha: falha });
      return { aceito: false, frase: falha?.titulo ?? 'Emergência não confirmada', falha: falha ?? undefined };
    }

    if (comandoEmVoo) return { aceito: false, frase: 'Aguarde o comando anterior' };

    // Trava no app (a lançadora confere de novo: ADR 0004).
    const concluido = c === 'ligar' && !!treino && !ehLivre(treino) && series.length >= treino.series;
    const negado = concluido ? 'Treino concluído. Veja o resultado' : recusa(c, estado);
    if (negado) {
      registrar(false, negado, null);
      return { aceito: false, frase: negado };
    }
    if (c === 'ligar' && !treino?.velocidade) {
      const frase = 'Defina a velocidade do treino';
      registrar(false, frase, null);
      return { aceito: false, frase };
    }

    // "Liga" e "retoma" do praticante não vão direto: viram a contagem de 5 s.
    // Só a própria contagem (origem 'auto') manda o comando à lançadora.
    if (ehPartida(c) && origem !== 'auto') {
      const agora = Date.now();
      // Uma contagem que já está tocando não recomeça (nem perde o aviso).
      if (partidaEmVoo || partida?.origem === 'pedido' || (partida && partida.em - agora <= CONTAGEM_MS)) {
        return { aceito: false, frase: 'A contagem já começou' };
      }
      // No descanso, só a partida automática do próprio descanso pode
      // antecipar; sem ela, o "liga" pula o resto do descanso.
      const em = instanteDaPartida(agora, partida);
      registrar(true, 'contagem de 5 s', null);
      set({
        partida: { id: ++proximaPartida, em, comando: c, origem: 'pedido' },
        autoRetomar: false,
        partidaCancelada: false,
        ...(fase === 'descanso' ? { fase: 'pronta' as const, descansoAte: 0, descansoIniciadoEm: 0, motivoSemRetomada: null } : {}),
      });
      return { aceito: true, frase: FRASE_CONTAGEM, silencioso: true };
    }

    const arg = c === 'ligar' ? { bolas: treino && !ehLivre(treino) ? treino.bolasPorSerie : 0, velocidade: treino?.velocidade } : undefined;
    // "Desliga" é intenção de parar: o descanso que vier depois não retoma
    // sozinho, mesmo que a resposta se perca e o status diga "série concluída".
    if (c === 'desligar') set({ paradaManual: true });
    comandoEmVoo = true;
    try {
      const aindaValido = origem === 'auto' && ehPartida(c) ? () => !get().partidaCancelada && !get().encerrando : undefined;
      let r = await lanc.enviar(OPERACAO[c], arg, aindaValido);
      if (r.falha === 'cancelado') {
        registrar(false, FRASE_CANCELADA, null);
        return { aceito: false, frase: FRASE_CANCELADA };
      }

      // Um 200 sem status não confirma nada: lê de novo ou falha. Nunca
      // marcamos LANCANDO só porque o HTTP respondeu.
      if (r.codigo === 200 && !r.status) {
        const s = await useLancadora.getState().enviar('status');
        r = s.status ? { ...r, status: s.status } : { ...r, codigo: 0, falha: 'timeout' };
      }

      // Se o comando estourou o tempo, ele pode ter chegado mesmo assim. O
      // status é a fonte da verdade para todos os comandos.
      if (r.codigo === 0) {
        const status = await useLancadora.getState().enviar('status');
        if (status.status && comandoAplicado(OPERACAO[c], { ...r, status: status.status })) {
          r = { ...r, codigo: 200, status: status.status };
        }
      }

      if (r.codigo !== 200) {
        const falha = classificarFalha(OPERACAO[c], r, useLancadora.getState().status);
        const motivo = falha?.titulo ?? 'Comando recusado';
        registrar(false, motivo, r.latenciaMs ?? null);
        if (falha) set({ ultimaFalha: falha });
        return { aceito: false, frase: motivo, falha: falha ?? undefined };
      }

      registrar(true, null, r.latenciaMs ?? null);
      set({ ultimaFalha: null });
      if (c === 'ligar') {
        set({ inicioSerie: Date.now(), descansoAte: 0, descansoIniciadoEm: 0, ...SEM_PARTIDA, motivoSemRetomada: null, paradaManual: false, fase: 'lancando' });
      }
      if (r.status) get().aoStatus(r.status);
      return { aceito: true, frase: FRASE_OK[c] };
    } finally {
      comandoEmVoo = false;
    }
  },

  // Chamado pelo relógio da contagem quando ela chega a zero.
  async dispararPartida(id) {
    const p = get().partida;
    if (!p || p.id !== id) return { aceito: false, frase: FRASE_CANCELADA };
    // A tela sai da contagem já; um cancelamento daqui em diante cai em
    // partidaCancelada e é desfeito quando a resposta voltar.
    set({ ...SEM_PARTIDA, partidaCancelada: false, ...(get().fase === 'descanso' ? { descansoAte: 0, descansoIniciadoEm: 0 } : {}) });
    partidaEmVoo = true;
    let r: ResultadoComando;
    try {
      r = await get().executar(p.comando, 'auto', p.origem === 'descanso' ? 'retomada automática' : 'contagem de 5 s', true);
    } finally {
      partidaEmVoo = false;
    }
    if (r.aceito && (get().partidaCancelada || get().encerrando)) {
      // O cancelamento chegou com o comando já na lançadora: desfaz na hora.
      // Um "liga" vira "desliga" (e a série de meio segundo não conta); um
      // "retoma" volta à pausa, preservando a série que estava pausada.
      if (p.comando === 'ligar') ignorarProximaSerie = true;
      const desfazer: Comando = p.comando === 'ligar' ? 'desligar' : 'pausar';
      const d = await get().executar(desfazer, 'auto', 'cancelamento durante a partida', true);
      set({ partidaCancelada: false });
      if (d.aceito) return { aceito: true, frase: FRASE_CANCELADA };
      ignorarProximaSerie = false;
      // Sem confirmação de que parou: a emergência é a segunda tentativa.
      const e = await get().executar('emergencia', 'botao', 'cancelamento sem confirmação', false);
      return e.aceito ? { aceito: true, frase: FRASE_CANCELADA } : e;
    }
    set({ partidaCancelada: false });
    return r;
  },

  // Vale para a sessão inteira, não só durante o descanso: o próximo descanso
  // já usa o tempo novo. O treino salvo não muda.
  ajustarDescanso(deltaSegundos) {
    const { treino, fase, descansoAte, autoRetomar, partida } = get();
    if (!treino || ehLivre(treino) || fase === 'encerrada' || fase === 'parada') return;
    const novoTotal = clampDescanso(treino.descansoS + deltaSegundos);
    const deltaMs = (novoTotal - treino.descansoS) * 1000;
    if (deltaMs === 0) return;
    if (fase !== 'descanso' || !descansoAte) {
      set({ treino: { ...treino, descansoS: novoTotal } });
      return;
    }
    const alvo = novoAlvoDescanso(descansoAte, deltaMs, Date.now(), autoRetomar);
    set({
      treino: { ...treino, descansoS: novoTotal },
      descansoAte: alvo,
      ...(partida?.origem === 'descanso' ? { partida: { ...partida, em: alvo } } : {}),
    });
  },

  cancelarPartida() {
    const { fase, partida } = get();
    const havia = !!partida || partidaEmVoo;
    if (!havia && fase !== 'descanso') return null;
    // Marca mesmo sem partida: um comando em voo precisa saber que a intenção
    // virou cancelar.
    set({ ...SEM_PARTIDA, partidaCancelada: true, ...(fase === 'descanso' ? { motivoSemRetomada: 'cancelada' as const } : {}) });
    return havia ? FRASE_CANCELADA : 'A retomada já estava desligada';
  },

  fimDoDescanso() {
    const { fase } = get();
    if (fase !== 'descanso') return null;
    set({ fase: 'pronta', descansoAte: 0, descansoIniciadoEm: 0, ...SEM_PARTIDA, motivoSemRetomada: get().motivoSemRetomada ?? 'concluido' });
    return 'Descanso encerrado';
  },

  falharPartida(falha) {
    const { fase } = get();
    set({
      ...SEM_PARTIDA,
      ultimaFalha: falha,
      ...(fase === 'descanso' ? { fase: 'pronta' as const, descansoAte: 0, descansoIniciadoEm: 0, motivoSemRetomada: 'falha' as const } : {}),
    });
  },

  definirVelocidadeSessao(v) {
    const { treino } = get();
    if (!treino) return;
    set({ treino: comVelocidade(treino, v) });
  },

  registrarFalha(f) {
    set({ ultimaFalha: f });
  },

  limparFalha() {
    set({ ultimaFalha: null });
  },

  async reiniciarAposParada() {
    const r = await useLancadora.getState().enviar('reiniciar');
    if (r.codigo === 200) {
      set({ ultimoEstado: 'REPOUSO', fase: 'pronta', ...SEM_PARTIDA, ultimaFalha: null });
      return true;
    }
    const falha = classificarFalha('reiniciar', r, useLancadora.getState().status);
    if (falha) set({ ultimaFalha: falha });
    return false;
  },

  aoStatus(s) {
    const { ultimoEstado, treino, series, fase, id, partida } = get();
    if (!id || fase === 'encerrada' || !treino) return null;
    if (s.estado === ultimoEstado) return null;
    // A lançadora mudou de estado por conta própria (watchdog, outra tela,
    // parada): uma contagem agendada para o estado anterior não vale mais.
    set({ ultimoEstado: s.estado, ...SEM_PARTIDA });
    const contagemPerdida = !!partida && partida.origem === 'pedido' && s.estado !== 'LANCANDO';

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
        return s.motivo === 'conexao_perdida' ? 'Conexão perdida. Motores parados' : contagemPerdida ? FRASE_CANCELADA : null;
      case 'PARADA_SEGURA':
        if (estavaDisparando) fecharSerie('emergencia');
        set({ fase: 'parada', motivoSemRetomada: null });
        return null;
      case 'ARMADO': {
        if (!estavaDisparando) {
          set({ fase: 'pronta' });
          return contagemPerdida ? FRASE_CANCELADA : null;
        }
        if (ignorarProximaSerie) {
          ignorarProximaSerie = false;
          set({ fase: 'pronta', motivoSemRetomada: 'cancelada', paradaManual: false, inicioSerie: 0 });
          return null;
        }
        const motivo: MotivoFimSerie = s.motivo === 'serie_concluida' ? 'serie_concluida' : 'desligar';
        fecharSerie(motivo);
        if (get().encerrando) {
          // O praticante está encerrando: nada de descanso nem retomada.
          set({ fase: 'pronta', motivoSemRetomada: null, paradaManual: false, inicioSerie: 0 });
          return null;
        }
        if (ehLivre(treino)) {
          set({ fase: 'pronta', motivoSemRetomada: null, paradaManual: false });
          return null;
        }
        if (get().series.length >= treino.series) {
          set({ fase: 'pronta', motivoSemRetomada: 'concluido', paradaManual: false });
          return 'Treino concluído';
        }
        const manual = get().paradaManual;
        const auto = !manual && podeRetomarAutomaticamente(motivo, useApp.getState().config.retomarSozinho);
        const agora = Date.now();
        const ate = agora + treino.descansoS * 1000;
        set({
          fase: 'descanso',
          descansoAte: ate,
          descansoIniciadoEm: agora,
          autoRetomar: auto,
          partida: auto ? { id: ++proximaPartida, em: ate, comando: 'ligar', origem: 'descanso' } : null,
          motivoSemRetomada: auto ? null : manual || motivo === 'desligar' ? 'desligou' : 'configuracao',
          inicioSerie: 0,
          paradaManual: false,
          partidaCancelada: false,
        });
        return auto ? 'Série concluída. Descanse: eu retomo no fim' : 'Série concluída. Descanse';
      }
      case 'REPOUSO': {
        if (estavaDisparando) fecharSerie('conexao_perdida');
        set({ fase: 'pronta', motivoSemRetomada: null, paradaManual: false });
        return estavaDisparando ? 'A lançadora voltou ao repouso. Rearme antes de seguir' : contagemPerdida ? FRASE_CANCELADA : null;
      }
      default:
        return null;
    }
  },

  async encerrar(motivo) {
    if (get().encerrando) return null;
    // Encerrar sempre vence a partida: nenhum motor pode ligar enquanto o
    // resultado é gravado. Se a parada não for confirmada, a sessão NÃO é
    // encerrada.
    set({ encerrando: true, ...SEM_PARTIDA, motivoSemRetomada: 'cancelada', partidaCancelada: true });
    try {
      const lanc = useLancadora.getState();
      // Um "ligar" a caminho pode chegar depois do encerramento: espera ele
      // voltar (até 4 s) e lê o estado verdadeiro antes de decidir.
      const limite = Date.now() + 4000;
      while ((partidaEmVoo || comandoEmVoo) && Date.now() < limite) await espera(100);
      const atual = await lanc.enviar('status');
      if (atual.status) get().aoStatus(atual.status);
      const fase = get().fase;
      let estado = atual.status?.estado ?? useLancadora.getState().status?.estado;
      const podeEstarGirando = estado === 'LANCANDO' || estado === 'PAUSADO' || (estado === undefined && (fase === 'lancando' || fase === 'pausada'));

      if (podeEstarGirando) {
        const r = await lanc.enviar('desligar');
        if (r.status) {
          get().aoStatus(r.status);
          estado = r.status.estado;
        } else {
          const s = await lanc.enviar('status');
          if (s.status) {
            get().aoStatus(s.status);
            estado = s.status.estado;
          }
        }
      }

      // Se o desligar não confirmou, a emergência é a segunda tentativa.
      if (estado === 'LANCANDO' || estado === 'PAUSADO' || (estado === undefined && podeEstarGirando)) {
        const e = await lanc.enviarUrgente('emergencia');
        if (e.status) {
          get().aoStatus(e.status);
          estado = e.status.estado;
        }
      }

      const parado = estado === 'ARMADO' || estado === 'REPOUSO' || estado === 'PARADA_SEGURA' || (estado === undefined && !podeEstarGirando);
      if (!parado) {
        const falha: FalhaLancadora = {
          codigo: 0,
          titulo: 'Não confirmei a parada',
          corpo: 'O comando de parada não voltou. A sessão não foi encerrada e os motores podem estar girando. Toque no botão vermelho; se não responder, corte a energia da máquina.',
          tecnico: 'encerrar · sem status confirmado',
          acao: 'tentar',
        };
        set({ ultimaFalha: falha });
        return null;
      }

      if (estado === 'ARMADO') await lanc.enviar('desarmar');
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
      try {
        await app.registrarSessao(sessao);
      } catch {
        set({
          ultimaFalha: {
            codigo: 0,
            titulo: 'Não consegui gravar a sessão',
            corpo: 'Os motores estão parados, mas o resultado não foi salvo neste celular. Tente encerrar de novo.',
            tecnico: 'registrarSessao · falha no SQLite',
            acao: 'tentar',
          },
        });
        return null;
      }
      set({
        fase: 'encerrada',
        ...SEM_PARTIDA,
        descansoAte: 0,
        descansoIniciadoEm: 0,
        motivoSemRetomada: null,
        encerrando: false,
        partidaCancelada: false,
        paradaManual: false,
      });
      return id;
    } finally {
      if (get().encerrando) set({ encerrando: false });
    }
  },

  descartar() {
    ignorarProximaSerie = false;
    set({
      id: null,
      treino: null,
      series: [],
      comandos: [],
      fase: 'pronta',
      ultimoEstado: null,
      descansoAte: 0,
      descansoIniciadoEm: 0,
      ...SEM_PARTIDA,
      motivoSemRetomada: null,
      conexaoPerdida: false,
      ultimaFalha: null,
      encerrando: false,
      partidaCancelada: false,
      paradaManual: false,
    });
  },
}));
