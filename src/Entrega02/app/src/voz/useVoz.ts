// Controle por voz da tela de sessão: palavra de ativação, janela de comando,
// retorno falado e vibração (PRD §8).

import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Comando, interpretar, JANELA_DE_COMANDO_MS, termosDeContexto } from '@/dominio/vocabulario';
import { type ModoReconhecimento, reconhecedor } from './reconhecedor';
import { AcompanhadorDeTrechos, PAUSA_PARA_DECIDIR_MS } from './trechos';

export type EstadoVoz = 'desligada' | 'esperando' | 'ouvindo_comando';

type Opcoes = {
  palavra: string;
  retornoFalado: boolean;
  aoComando(comando: Comando, transcricao: string): void;
  aoIgnorado?(transcricao: string, motivo: 'sem_ativacao' | 'nao_entendi'): void;
};

export function useVoz({ palavra, retornoFalado, aoComando, aoIgnorado }: Opcoes) {
  const [estado, setEstado] = useState<EstadoVoz>('desligada');
  const [ultimaFala, setUltimaFala] = useState('');
  const [modo, setModo] = useState<ModoReconhecimento>('nuvem');
  const [erro, setErro] = useState<string | null>(null);

  const janelaAte = useRef(0);
  const falando = useRef(false);
  const trechos = useRef(new AcompanhadorDeTrechos());
  const timerDecisao = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerJanela = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Os callbacks mudam a cada render; a escuta usa sempre os mais recentes.
  const ref = useRef({ palavra, aoComando, aoIgnorado });
  useEffect(() => {
    ref.current = { palavra, aoComando, aoIgnorado };
  });

  const fecharJanela = useCallback(() => {
    janelaAte.current = 0;
    setEstado((e) => (e === 'desligada' ? e : 'esperando'));
  }, []);

  // Decide sobre um trecho já estável (pausa na fala ou resultado final).
  const decidir = useCallback(
    (trecho: string) => {
      trechos.current.consumir();
      // Enquanto o app fala, o resto é ignorado para ele não ouvir a si mesmo.
      if (falando.current) return;
      const janelaAberta = Date.now() <= janelaAte.current;
      const r = interpretar(trecho, ref.current.palavra, janelaAberta);
      if (r.tipo === 'ativacao') {
        janelaAte.current = Date.now() + JANELA_DE_COMANDO_MS;
        setEstado('ouvindo_comando');
        void Haptics.selectionAsync();
        if (timerJanela.current) clearTimeout(timerJanela.current);
        timerJanela.current = setTimeout(fecharJanela, JANELA_DE_COMANDO_MS);
      } else if (r.tipo === 'comando') {
        fecharJanela();
        ref.current.aoComando(r.comando, trecho);
      } else {
        ref.current.aoIgnorado?.(trecho, r.motivo);
      }
    },
    [fecharJanela],
  );

  const tratarTexto = useCallback(
    (texto: string, final: boolean) => {
      // Só o trecho novo: a transcrição contínua acumula todas as falas.
      const trecho = trechos.current.atualizar(texto);
      if (!trecho) return;
      setUltimaFala(trecho);
      if (timerDecisao.current) clearTimeout(timerDecisao.current);

      // A emergência sai já no resultado parcial: é o caminho mais curto até
      // os motores pararem.
      const r = interpretar(trecho, ref.current.palavra, Date.now() <= janelaAte.current);
      if (r.tipo === 'comando' && r.comando === 'emergencia') {
        trechos.current.consumir();
        ref.current.aoComando('emergencia', trecho);
        return;
      }
      if (final) {
        decidir(trecho);
        trechos.current.reiniciar();
        return;
      }
      timerDecisao.current = setTimeout(() => decidir(trecho), PAUSA_PARA_DECIDIR_MS);
    },
    [decidir],
  );

  const ligar = useCallback(async () => {
    setErro(null);
    const ok = await reconhecedor.pedirPermissao();
    if (!ok) {
      setErro('Sem permissão de microfone ou reconhecimento de fala.');
      return;
    }
    reconhecedor.iniciar(termosDeContexto(ref.current.palavra), {
      aoTexto: tratarTexto,
      aoErro: (msg, fatal) => {
        setErro(msg);
        if (fatal) setEstado('desligada');
      },
      aoMudarModo: setModo,
      aoFimDaEscuta: () => trechos.current.reiniciar(),
    });
    setEstado('esperando');
  }, [tratarTexto]);

  const desligar = useCallback(() => {
    reconhecedor.parar();
    if (timerDecisao.current) clearTimeout(timerDecisao.current);
    trechos.current.reiniciar();
    janelaAte.current = 0;
    setEstado('desligada');
  }, []);

  const falar = useCallback(
    (texto: string, sucesso: boolean) => {
      void Haptics.notificationAsync(sucesso ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      if (!retornoFalado) return;
      falando.current = true;
      Speech.stop();
      const fim = () => {
        setTimeout(() => (falando.current = false), 300);
      };
      Speech.speak(texto, { language: 'pt-BR', rate: 1.05, onDone: fim, onStopped: fim, onError: fim });
    },
    [retornoFalado],
  );

  useEffect(
    () => () => {
      reconhecedor.parar();
      Speech.stop();
      if (timerJanela.current) clearTimeout(timerJanela.current);
      if (timerDecisao.current) clearTimeout(timerDecisao.current);
    },
    [],
  );

  return { estado, ultimaFala, modo, erro, ligar, desligar, falar };
}
