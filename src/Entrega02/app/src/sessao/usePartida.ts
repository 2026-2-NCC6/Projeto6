// O relógio da partida: um bip por segundo nos 5 s antes de os motores ligarem
// e o comando no zero. Serve à contagem pedida ("Nock, liga", botão, "retoma")
// e à retomada automática no fim do descanso, que é a mesma coisa agendada
// para mais tarde.
//
// O relógio é de parede (Date.now a cada 200 ms) e não um setTimeout único: se
// o app foi suspenso e voltou depois do zero, ele percebe o atraso e não liga
// os motores por surpresa. Sem os 5 s de aviso, a partida falha e pede o
// comando de novo.

import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import { bipsDisponiveis, renovarBips, tocarBip } from '@/audio/sons';
import { avisoComAntecedencia, decidirFimDoDescanso } from '@/dominio/descanso';
import { bipDevido, CONTAGEM_MS } from '@/dominio/partida';
import type { FalhaLancadora } from '@/lancadora/falhas';
import { FRASE_CANCELADA, useSessao } from './sessao';

type Opcoes = {
  falar(texto: string, ok: boolean): void;
  mostrar(texto: string, ok: boolean): void;
  aoFalhar(falha: FalhaLancadora | null): void;
};

const TICK_MS = 200;

// Há uma contagem tocando (ou prestes a tocar): o retorno falado espera, para
// não cobrir os bips. Cancelamentos e falhas apagam a partida antes de falar,
// então continuam sendo anunciados.
export function contagemEmCurso(agora = Date.now()): boolean {
  const p = useSessao.getState().partida;
  return !!p && p.em - agora <= CONTAGEM_MS + 1000;
}

export function usePartidaAgendada(opcoes: Opcoes) {
  const ref = useRef(opcoes);
  useEffect(() => {
    ref.current = opcoes;
  });

  useEffect(() => {
    let marca = { id: -1, ultimoSegundo: 6, primeiroBipEm: 0, finalizou: false };

    const avisar = (frase: string, ok: boolean) => {
      ref.current.mostrar(frase, ok);
      ref.current.falar(frase, ok);
    };

    const disparar = async (id: number) => {
      const r = await useSessao.getState().dispararPartida(id);
      if (r.frase === FRASE_CANCELADA) {
        if (r.aceito) avisar(r.frase, true);
        return;
      }
      if (r.aceito) {
        AccessibilityInfo.announceForAccessibility('Motores ligados');
        avisar(r.frase, true);
        return;
      }
      useSessao.getState().falharPartida(r.falha ?? null);
      ref.current.aoFalhar(r.falha ?? null);
      avisar(r.frase, false);
    };

    const tick = () => {
      const s = useSessao.getState();
      const agora = Date.now();

      // Descanso sem retomada automática: no fim, a fase fecha e o próximo
      // "liga" é do praticante.
      if (s.fase === 'descanso' && !s.partida && s.descansoAte && agora >= s.descansoAte) {
        const frase = s.fimDoDescanso();
        if (frase) avisar(frase, true);
        return;
      }

      const p = s.partida;
      if (!p) {
        marca.id = -1;
        return;
      }
      if (marca.id !== p.id) marca = { id: p.id, ultimoSegundo: 6, primeiroBipEm: 0, finalizou: false };
      if (marca.finalizou) return;

      const resta = p.em - agora;
      // O descanso foi estendido para além da janela: a contagem recomeça.
      if (resta > CONTAGEM_MS) {
        marca.ultimoSegundo = 6;
        marca.primeiroBipEm = 0;
        return;
      }

      const segundo = bipDevido(resta, marca.ultimoSegundo);
      if (segundo !== null) {
        marca.ultimoSegundo = segundo;
        if (!marca.primeiroBipEm) {
          marca.primeiroBipEm = agora;
          // Players novos a cada contagem (um player quebrado numa troca de
          // rota de áudio tocaria mudo) e nenhuma fala por cima dos bips.
          renovarBips();
          Speech.stop();
          // Sem comandos na frase: o microfone pode ouvir o leitor de tela
          // (um "Nock, desliga" dito por ele cancelaria a própria contagem).
          AccessibilityInfo.announceForAccessibility('Motores ligam em 5 segundos. O botão Cancelar está na tela.');
          // Sem o módulo de áudio, a voz faz o papel dos bips.
          // Fala direto: o retorno falado da sessão fica mudo durante a
          // contagem, e este aviso é o próprio aviso da contagem.
          if (!bipsDisponiveis()) Speech.speak('Atenção, cinco segundos', { language: 'pt-BR' });
        }
        tocarBip('contagem');
        void Haptics.impactAsync(segundo <= 2 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
      }
      if (resta > 0) return;

      marca.finalizou = true;
      const decisao = decidirFimDoDescanso(resta, true);
      if (decisao === 'retomar' && avisoComAntecedencia(marca.primeiroBipEm, agora)) {
        tocarBip('inicio');
        void disparar(p.id);
        return;
      }
      // O app ficou suspenso e perdeu o aviso (ou o próprio zero): não liga.
      useSessao.getState().falharPartida(null);
      avisar(
        decisao === 'expirado'
          ? 'A contagem terminou com o app em segundo plano. Use o controle da tela.'
          : 'O aviso de 5 segundos não tocou a tempo. Use o controle da tela.',
        false,
      );
    };

    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, []);
}
