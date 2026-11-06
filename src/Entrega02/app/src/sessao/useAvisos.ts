// Os avisos sonoros e falados da série, para quem treina de fone sem olhar a
// tela (a contagem de partida é do usePartidaAgendada):
//
// - os 3 bips graves dos últimos segundos, antes de a lançadora parar sozinha
//   no número de bolas;
// - o sinal de pausa quando a pausa é confirmada e o de fim quando a série
//   fecha (a frase vem do status, em sessao.ts);
// - "Faltam 10 segundos de descanso".
//
// Nada disso toca ou fala durante a contagem de partida (contagemEmCurso):
// antes de os motores ligarem, só os bips dela. Os bips do fim calam assim que
// um "desliga", "pausa" ou a emergência sai para a lançadora.

import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { bipHabilitado, renovarBips, tocarBip } from '@/audio/sons';
import { avisoDeDescansoDevido, AVISO_DESCANSO_MS, AVISO_DESCANSO_SEGUNDOS } from '@/dominio/descanso';
import { AVISO_FIM_SEGUNDOS, avisoDeFimDevido, duracaoDaSerieMs, restanteDaSerieMs } from '@/dominio/fimDeSerie';
import { fraseFaltaDescanso } from '@/dominio/frases';
import { ehLivre } from '@/dominio/treinos';
import { useLancadora } from '@/lancadora/cliente';
import { msPorBolaCom, VELOCIDADE_PADRAO, type StatusLancadora } from '@/lancadora/contrato';
import { paradaEmCurso, useSessao } from './sessao';
import { contagemEmCurso } from './usePartida';

type Opcoes = { falar(texto: string, ok: boolean): void; mostrar(texto: string, ok: boolean): void };

// Mais curto que o segundo: o bip sai no máximo 100 ms depois da hora.
const TICK_MS = 100;
// Um acima do primeiro bip (3): nenhum tocou ainda nesta série.
const AVISO_FIM_INICIAL = AVISO_FIM_SEGUNDOS + 1;

export function useAvisosDaSerie(opcoes: Opcoes) {
  const ref = useRef(opcoes);
  useEffect(() => {
    ref.current = opcoes;
  });

  // Pausa e fim de série: transições da sessão, que já passaram pelo status.
  useEffect(
    () =>
      useSessao.subscribe((atual, anterior) => {
        if (contagemEmCurso()) return;
        if (atual.series.length > anterior.series.length && atual.id === anterior.id) {
          const ultima = atual.series[atual.series.length - 1];
          if (ultima.motivo === 'serie_concluida' || ultima.motivo === 'desligar') tocarBip('fim');
          return;
        }
        if (anterior.fase === 'lancando' && atual.fase === 'pausada') tocarBip('pausa');
      }),
    [],
  );

  useEffect(() => {
    // O instante em que cada status chegou: entre um e outro, o app
    // extrapola o tempo da série pelo relógio do celular.
    let leitura: { status: StatusLancadora; em: number } | null = null;
    const anotar = (s: StatusLancadora | null) => {
      leitura = s ? { status: s, em: Date.now() } : null;
    };
    anotar(useLancadora.getState().status);
    const sair = useLancadora.subscribe((atual, anterior) => {
      if (atual.status !== anterior.status) anotar(atual.status);
    });

    // Uma marca por série (inicioSerie) e por descanso (descansoIniciadoEm).
    let fim = { serie: -1, ultimoSegundo: AVISO_FIM_INICIAL };
    let descanso = { em: -1, avisou: false };

    const tick = () => {
      const s = useSessao.getState();
      const agora = Date.now();

      if (s.fase === 'descanso' && s.descansoAte && s.treino) {
        if (descanso.em !== s.descansoIniciadoEm) descanso = { em: s.descansoIniciadoEm, avisou: false };
        const resta = s.descansoAte - agora;
        // Descanso estendido depois do aviso: pode avisar de novo.
        if (descanso.avisou && resta > AVISO_DESCANSO_MS + 2000) descanso.avisou = false;
        if (avisoDeDescansoDevido(resta, s.descansoAte - s.descansoIniciadoEm, descanso.avisou) && !contagemEmCurso(agora)) {
          descanso.avisou = true;
          const frase = fraseFaltaDescanso(AVISO_DESCANSO_SEGUNDOS);
          ref.current.mostrar(frase, true);
          ref.current.falar(frase, true);
        }
        return;
      }

      const lanc = useLancadora.getState();
      const treino = s.treino;
      if (
        !leitura ||
        !treino ||
        ehLivre(treino) ||
        s.fase !== 'lancando' ||
        s.partida ||
        s.encerrando ||
        lanc.conexao !== 'conectada' ||
        paradaEmCurso() ||
        contagemEmCurso(agora)
      ) {
        return;
      }
      if (fim.serie !== s.inicioSerie) fim = { serie: s.inicioSerie, ultimoSegundo: AVISO_FIM_INICIAL };

      const st = leitura.status;
      // Firmware 2.0 não manda o duty da série: vale o que o app pediu no "liga".
      const lancador = st.lancador ?? treino.velocidade?.lancador ?? VELOCIDADE_PADRAO.lancador;
      const alimentador = st.alimentador ?? treino.velocidade?.alimentador ?? VELOCIDADE_PADRAO.alimentador;
      const msPorBola = msPorBolaCom(st, alimentador);
      const l = { estado: st.estado, bolasAlvo: st.bolasAlvo, tempoMs: st.tempoMs, lancador };
      const segundo = avisoDeFimDevido(restanteDaSerieMs(l, msPorBola, leitura.em, agora), duracaoDaSerieMs(l, msPorBola), fim.ultimoSegundo);
      if (segundo === null) return;
      const primeiro = fim.ultimoSegundo === AVISO_FIM_INICIAL;
      fim.ultimoSegundo = segundo;
      if (!bipHabilitado('aviso')) return;
      // Players novos no primeiro bip (como a contagem faz a cada partida).
      if (primeiro) renovarBips(['aviso', 'fim']);
      tocarBip('aviso');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const id = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(id);
      sair();
    };
  }, []);
}
