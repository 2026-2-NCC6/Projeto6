// Controle por voz da tela de sessão: palavra de ativação, janela de comando,
// retorno falado, bips e vibração (PRD §8).
//
// Com a tela apagada, o app continua ouvindo: no iOS pelo modo de áudio em
// segundo plano; no Android por um serviço em primeiro plano (notificação
// "NockHug está ouvindo"), que também segura a CPU e o Wi-Fi da lançadora. Com
// um fone Bluetooth conectado, o microfone dele é usado (no iOS o sistema faz
// isso sozinho; no Android o app liga o canal SCO). O toque sonoro na
// ativação existe para o praticante saber que pode falar o comando sem olhar
// para o celular.

import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { tocarBip } from '@/audio/sons';
import { type EntradaDeAudio, entradaDeAudio, iniciarEscutaEmSegundoPlano, pararEscutaEmSegundoPlano, usarMicrofoneDoFone } from '@/plataforma/nativo';
import { escolherInterpretacao, JANELA_DE_COMANDO_MS, type Comando, termosDeContexto } from '@/dominio/vocabulario';
import { type ModoReconhecimento, type PreferenciaReconhecimento, reconhecedor } from './reconhecedor';
import { AcompanhadorDeTrechos, PAUSA_PARA_DECIDIR_MS } from './trechos';

export type EstadoVoz = 'desligada' | 'esperando' | 'ouvindo_comando';

// A notificação do serviço de escuta (Android 13+) precisa de permissão. Sem
// ela o serviço roda do mesmo jeito, só sem o aviso na barra.
async function pedirNotificacao() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try {
    const p = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (!(await PermissionsAndroid.check(p))) await PermissionsAndroid.request(p);
  } catch {
    // sem a notificação, a escuta continua
  }
}

// Solta o que a escuta segurou no sistema: o serviço e o canal do fone.
function soltarSistema() {
  pararEscutaEmSegundoPlano();
  if (Platform.OS === 'android') usarMicrofoneDoFone(false);
}

type Opcoes = {
  palavra: string;
  retornoFalado: boolean;
  // 'auto' usa a nuvem com internet e cai para o aparelho sem ela.
  modoReconhecimento?: PreferenciaReconhecimento;
  // Continua ouvindo com o app em segundo plano / tela apagada.
  manterEmSegundoPlano?: boolean;
  // Bip curto ao reconhecer a palavra de ativação.
  sinalSonoro?: boolean;
  // Liga o medidor de volume (só o teste de microfone usa).
  monitorarNivel?: boolean;
  aoComando(comando: Comando, transcricao: string, ativada: boolean): void;
  aoIgnorado?(transcricao: string, motivo: 'sem_ativacao' | 'nao_entendi'): void;
};

export function useVoz({
  palavra,
  retornoFalado,
  modoReconhecimento = 'auto',
  manterEmSegundoPlano = false,
  sinalSonoro = true,
  monitorarNivel = false,
  aoComando,
  aoIgnorado,
}: Opcoes) {
  const [estado, setEstado] = useState<EstadoVoz>('desligada');
  const [ultimaFala, setUltimaFala] = useState('');
  const [modo, setModo] = useState<ModoReconhecimento>(modoReconhecimento === 'aparelho' ? 'aparelho' : 'nuvem');
  const [erro, setErro] = useState<string | null>(null);
  const [nivel, setNivel] = useState(0);
  const [entrada, setEntrada] = useState<EntradaDeAudio>({ tipo: 'celular', nome: null });

  const manter = useRef(manterEmSegundoPlano);
  useEffect(() => {
    manter.current = manterEmSegundoPlano;
  }, [manterEmSegundoPlano]);
  const janelaAte = useRef(0);
  const falando = useRef(false);
  const sinalizando = useRef(false);
  const desejada = useRef(false);
  const trechos = useRef(new AcompanhadorDeTrechos());
  const timerDecisao = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerJanela = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerSinal = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geracaoFala = useRef(0);
  const decidirRef = useRef<((trecho: string, alternativas: string[]) => void) | null>(null);
  // Os callbacks mudam a cada render; a escuta usa sempre os mais recentes.
  const ref = useRef({ palavra, aoComando, aoIgnorado, sinalSonoro });
  useEffect(() => {
    ref.current = { palavra, aoComando, aoIgnorado, sinalSonoro };
  });

  const sinal = useCallback(() => {
    if (!ref.current.sinalSonoro) return;
    sinalizando.current = true;
    tocarBip('toque');
    if (timerSinal.current) clearTimeout(timerSinal.current);
    timerSinal.current = setTimeout(() => {
      sinalizando.current = false;
    }, 260);
  }, []);

  const fecharJanela = useCallback(() => {
    janelaAte.current = 0;
    setEstado((e) => (e === 'desligada' ? e : 'esperando'));
  }, []);

  // Decide sobre um trecho já estável (pausa na fala ou resultado final).
  const decidir = useCallback(
    (trecho: string, alternativas: string[]) => {
      // Enquanto o app fala ou toca um bip, não consome o trecho: decide de
      // novo depois. Um "desliga" dito durante o aviso de 5 s não pode sumir.
      if (falando.current || sinalizando.current) {
        if (timerDecisao.current) clearTimeout(timerDecisao.current);
        timerDecisao.current = setTimeout(() => decidirRef.current?.(trecho, alternativas), 250);
        return;
      }
      trechos.current.consumir();
      const escolha = escolherInterpretacao([trecho, ...alternativas], ref.current.palavra, Date.now() <= janelaAte.current);
      const r = escolha.resultado;
      if (r.tipo === 'ativacao') {
        janelaAte.current = Date.now() + JANELA_DE_COMANDO_MS;
        setEstado('ouvindo_comando');
        void Haptics.selectionAsync();
        sinal();
        if (timerJanela.current) clearTimeout(timerJanela.current);
        timerJanela.current = setTimeout(fecharJanela, JANELA_DE_COMANDO_MS);
      } else if (r.tipo === 'comando') {
        fecharJanela();
        ref.current.aoComando(r.comando, escolha.texto, r.ativada);
      } else {
        ref.current.aoIgnorado?.(trecho, r.motivo);
      }
    },
    [fecharJanela, sinal],
  );
  useEffect(() => {
    decidirRef.current = decidir;
  }, [decidir]);

  const tratarTexto = useCallback(
    (texto: string, final: boolean, alternativas: string[]) => {
      // Só o trecho novo: a transcrição contínua acumula todas as falas.
      const trecho = trechos.current.atualizar(texto);
      if (!trecho) return;
      // As alternativas são medidas contra o mesmo ponto consumido da principal.
      const alts = alternativas
        .slice(1)
        .map((a) => trechos.current.trechoDe(a))
        .filter(Boolean);
      setUltimaFala(trecho);
      if (timerDecisao.current) clearTimeout(timerDecisao.current);

      // A emergência sai já no resultado parcial: é o caminho mais curto até
      // os motores pararem. Uma parada em qualquer hipótese vale.
      const r = escolherInterpretacao([trecho, ...alts], ref.current.palavra, Date.now() <= janelaAte.current);
      if (r.resultado.tipo === 'comando' && r.resultado.comando === 'emergencia') {
        // Não dispara em cima da própria voz do app; decide quando ela acabar.
        if (falando.current || sinalizando.current) {
          if (timerDecisao.current) clearTimeout(timerDecisao.current);
          timerDecisao.current = setTimeout(() => decidirRef.current?.(trecho, alts), 250);
          return;
        }
        trechos.current.consumir();
        ref.current.aoComando('emergencia', r.texto, r.resultado.ativada);
        return;
      }
      if (final) {
        decidir(trecho, alts);
        trechos.current.reiniciar();
        return;
      }
      timerDecisao.current = setTimeout(() => decidir(trecho, alts), PAUSA_PARA_DECIDIR_MS);
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
    desejada.current = true;
    setModo(modoReconhecimento === 'aparelho' ? 'aparelho' : 'nuvem');
    // Fone Bluetooth: no Android o microfone dele só vale com o canal SCO.
    if (Platform.OS === 'android') usarMicrofoneDoFone(true);
    if (manter.current) {
      await pedirNotificacao();
      if (!desejada.current) return; // desligou enquanto pedia a permissão
      iniciarEscutaEmSegundoPlano('NockHug está ouvindo', `Diga “${ref.current.palavra}” e o comando. Toque para voltar à sessão.`);
    }
    reconhecedor.iniciar(
      termosDeContexto(ref.current.palavra),
      {
        aoTexto: tratarTexto,
        aoErro: (msg, fatal) => {
          setErro(msg);
          if (fatal) {
            desejada.current = false;
            soltarSistema();
            setEstado('desligada');
          }
        },
        aoMudarModo: setModo,
        aoFimDaEscuta: () => {
          trechos.current.reiniciar();
          janelaAte.current = 0;
          setEstado((e) => (e === 'desligada' ? e : 'esperando'));
        },
        ...(monitorarNivel ? { aoVolume: (v: number) => setNivel(Math.max(0, Math.min(1, (v + 2) / 12))) } : {}),
      },
      { modo: modoReconhecimento, monitorarVolume: monitorarNivel },
    );
    if (reconhecedor.estaAtivo()) setEstado('esperando');
  }, [modoReconhecimento, monitorarNivel, tratarTexto]);

  const desligar = useCallback(() => {
    desejada.current = false;
    geracaoFala.current++;
    falando.current = false;
    reconhecedor.parar();
    soltarSistema();
    if (timerDecisao.current) clearTimeout(timerDecisao.current);
    if (timerSinal.current) clearTimeout(timerSinal.current);
    trechos.current.reiniciar();
    janelaAte.current = 0;
    sinalizando.current = false;
    setNivel(0);
    setEstado('desligada');
  }, []);

  const falar = useCallback(
    (texto: string, sucesso: boolean) => {
      void Haptics.notificationAsync(sucesso ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      if (!retornoFalado) return;
      const g = ++geracaoFala.current;
      falando.current = true;
      Speech.stop();
      // Só a fala atual pode liberar o microfone; o onStopped de uma fala
      // antiga não pode liberar no meio da nova. 800 ms de folga depois.
      const fim = () => {
        if (geracaoFala.current !== g) return;
        setTimeout(() => {
          if (geracaoFala.current === g) falando.current = false;
        }, 800);
      };
      Speech.speak(texto, { language: 'pt-BR', rate: 1.05, onDone: fim, onStopped: fim, onError: fim });
    },
    [retornoFalado],
  );

  // Escuta com a tela bloqueada: sai do app e volta sem perder o microfone.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estadoApp) => {
      if (estadoApp === 'active') {
        if (desejada.current) reconhecedor.garantirEscuta();
        return;
      }
      if (estadoApp === 'background' && desejada.current && !manter.current) desligar();
    });
    return () => sub.remove();
  }, [desligar]);

  // De onde a voz está vindo (fone ou celular): muda quando o fone conecta ou
  // desconecta no meio da sessão.
  useEffect(() => {
    if (estado === 'desligada') return;
    const ler = () => setEntrada((atual) => {
      const nova = entradaDeAudio();
      return nova.tipo === atual.tipo && nova.nome === atual.nome ? atual : nova;
    });
    const primeira = setTimeout(ler, 700);
    const t = setInterval(ler, 4000);
    return () => {
      clearTimeout(primeira);
      clearInterval(t);
    };
  }, [estado]);

  useEffect(
    () => () => {
      geracaoFala.current++;
      falando.current = false;
      reconhecedor.parar();
      soltarSistema();
      Speech.stop();
      if (timerJanela.current) clearTimeout(timerJanela.current);
      if (timerDecisao.current) clearTimeout(timerDecisao.current);
      if (timerSinal.current) clearTimeout(timerSinal.current);
    },
    [],
  );

  return { estado, ultimaFala, modo, erro, nivel, entrada, ligar, desligar, falar };
}
