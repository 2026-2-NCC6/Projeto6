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
import type { PreferenciaMicrofone } from '@/dominio/tipos';
import {
  type EntradaDeAudio,
  entradaDeAudio,
  iniciarEscutaEmSegundoPlano,
  pararEscutaEmSegundoPlano,
  preferirMicrofoneDoCelular,
  usarMicrofoneDoFone,
} from '@/plataforma/nativo';
import {
  type Comando,
  ehParada,
  type Escolha,
  escolherInterpretacao,
  filtrarRevisao,
  JANELA_DE_COMANDO_MS,
  termosDeContexto,
} from '@/dominio/vocabulario';
import { type ModoReconhecimento, type PreferenciaReconhecimento, reconhecedor } from './reconhecedor';
import { AcompanhadorDeTrechos, PAUSA_PARA_DECIDIR_MS } from './trechos';

export type EstadoVoz = 'desligada' | 'esperando' | 'ouvindo_comando';

// Um trecho de fala à espera de decisão.
type Pendente = {
  trecho: string;
  alts: string[];
  // Palavras já tratadas que este trecho reescreveu (revisão do parcial).
  substituido: string | null;
  segmento: number;
};

// De quanto em quanto tempo uma decisão adiada confere se o app parou de falar.
const ESPERA_DA_VOZ_MS = 250;

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
  else preferirMicrofoneDoCelular(false);
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
  // Microfone do fone Bluetooth (se houver um conectado) ou sempre o do celular.
  microfone?: PreferenciaMicrofone;
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
  microfone = 'fone',
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
  const timerAdiados = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geracaoFala = useRef(0);
  // O trecho mais recente do segmento aberto, ainda sem decisão.
  const pendente = useRef<Pendente | null>(null);
  // Trechos de segmentos já encerrados (final ou fim da escuta) que esperam a
  // voz do app acabar. Nada novo chega com eles, então nenhum parcial seguinte
  // pode substituí-los: precisam de fila própria para não sumirem.
  const adiados = useRef<Pendente[]>([]);
  const decidirPendenteRef = useRef<() => void>(() => undefined);
  const processarAdiadosRef = useRef<() => void>(() => undefined);
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

  // A interpretação do trecho. Um trecho que reescreveu palavras já tratadas
  // só pode parar a máquina (vocabulario.filtrarRevisao).
  const escolher = useCallback((p: Pendente): Escolha => {
    const e = escolherInterpretacao([p.trecho, ...p.alts], ref.current.palavra, Date.now() <= janelaAte.current);
    return p.substituido === null ? e : filtrarRevisao(e, p.substituido, ref.current.palavra);
  }, []);

  // Executa a decisão e marca o trecho como tratado.
  const aplicar = useCallback(
    (p: Pendente, escolha: Escolha) => {
      // Só consome o próprio segmento: uma decisão atrasada não pode marcar
      // como tratada a fala que já chegou na escuta seguinte.
      if (trechos.current.segmento === p.segmento) trechos.current.consumir();
      if (pendente.current?.segmento === p.segmento) pendente.current = null;
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
        ref.current.aoIgnorado?.(p.trecho, r.motivo);
      }
    },
    [fecharJanela, sinal],
  );

  // Decide sobre um trecho: na pausa da fala, no resultado final, no fim da
  // escuta ou já no parcial, se for parada.
  const decidir = useCallback(
    (p: Pendente) => {
      const escolha = escolher(p);
      const r = escolha.resultado;
      // Parada com a palavra de ativação (ou dentro da janela) não espera
      // nada: nem a voz do app, nem o bip. Nenhuma frase do app tem "Nock" +
      // parada (frases.ts), e parar sem precisar é seguro.
      const urgente = r.tipo === 'comando' && ehParada(escolha) && r.ativada;
      if (urgente || !(falando.current || sinalizando.current)) {
        aplicar(p, escolha);
        return;
      }
      // O resto não decide em cima da própria voz do app, mas também não some:
      // espera ela acabar. O "Para!" sem ativação cai aqui ("parada segura"
      // dita pelo app pode ser ouvida como "para da segura").
      if (trechos.current.aberto(p.segmento)) {
        // Segmento aberto: o próximo parcial traz este trecho de novo.
        pendente.current = p;
        if (timerDecisao.current) clearTimeout(timerDecisao.current);
        timerDecisao.current = setTimeout(() => decidirPendenteRef.current(), ESPERA_DA_VOZ_MS);
        return;
      }
      if (pendente.current === p) pendente.current = null;
      adiados.current.push(p);
      if (!timerAdiados.current) timerAdiados.current = setTimeout(() => processarAdiadosRef.current(), ESPERA_DA_VOZ_MS);
    },
    [aplicar, escolher],
  );

  useEffect(() => {
    decidirPendenteRef.current = () => {
      const p = pendente.current;
      if (p) decidir(p);
    };
    processarAdiadosRef.current = () => {
      timerAdiados.current = null;
      if (adiados.current.length === 0) return;
      if (falando.current || sinalizando.current) {
        timerAdiados.current = setTimeout(() => processarAdiadosRef.current(), ESPERA_DA_VOZ_MS);
        return;
      }
      const fila = adiados.current;
      adiados.current = [];
      for (const p of fila) aplicar(p, escolher(p));
    };
  }, [aplicar, decidir, escolher]);

  const tratarTexto = useCallback(
    (texto: string, final: boolean, alternativas: string[]) => {
      // Só o trecho novo: a transcrição contínua acumula todas as falas. O
      // final fecha o segmento dentro do acompanhador, mesmo sem trecho novo;
      // senão o começo da frase seguinte era engolido como "já tratado".
      const t = trechos.current;
      const trecho = t.atualizar(texto, final);
      if (!trecho) return;
      const p: Pendente = {
        trecho,
        // As alternativas são medidas a partir do mesmo ponto da principal.
        alts: alternativas
          .slice(1)
          .map((a) => t.trechoDe(a))
          .filter(Boolean),
        substituido: t.revisao(),
        segmento: t.segmento,
      };
      setUltimaFala(trecho);
      if (timerDecisao.current) clearTimeout(timerDecisao.current);
      pendente.current = p;

      // Parada (emergência, desliga, pausa) sai já no resultado parcial: é o
      // caminho mais curto até os motores pararem. Com o motor ligado, o ruído
      // mantém o parcial mudando e a pausa de 700 ms pode nunca chegar.
      if (final || ehParada(escolher(p))) {
        decidir(p);
        return;
      }
      timerDecisao.current = setTimeout(() => decidirPendenteRef.current(), PAUSA_PARA_DECIDIR_MS);
    },
    [decidir, escolher],
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
    // Fone Bluetooth: no Android o microfone dele só vale com o canal SCO, que
    // o app liga só se o praticante escolheu o fone. Sem o SCO, o Android usa o
    // microfone do celular. O fone é Bluetooth clássico e a lançadora é BLE:
    // um não derruba o outro.
    if (Platform.OS === 'android') usarMicrofoneDoFone(microfone === 'fone');
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
          // A escuta acabou (no Android, às vezes depois de cada frase). O
          // trecho ainda sem decisão é decidido agora: a escuta seguinte começa
          // do zero e não o traria de volta. A janela de comando NÃO fecha aqui:
          // o "desliga" dito depois do bip da ativação chega na escuta seguinte.
          if (timerDecisao.current) clearTimeout(timerDecisao.current);
          const p = pendente.current;
          pendente.current = null;
          trechos.current.reiniciar();
          if (p) decidir(p);
        },
        ...(monitorarNivel ? { aoVolume: (v: number) => setNivel(Math.max(0, Math.min(1, (v + 2) / 12))) } : {}),
      },
      { modo: modoReconhecimento, monitorarVolume: monitorarNivel },
    );
    // No iOS a sessão de áudio nasce com o reconhecedor; a entrada preferida
    // só pode ser trocada depois dele.
    if (Platform.OS === 'ios') preferirMicrofoneDoCelular(microfone === 'celular');
    if (reconhecedor.estaAtivo()) setEstado('esperando');
  }, [decidir, microfone, modoReconhecimento, monitorarNivel, tratarTexto]);

  const desligar = useCallback(() => {
    desejada.current = false;
    geracaoFala.current++;
    falando.current = false;
    reconhecedor.parar();
    soltarSistema();
    if (timerDecisao.current) clearTimeout(timerDecisao.current);
    if (timerSinal.current) clearTimeout(timerSinal.current);
    if (timerAdiados.current) clearTimeout(timerAdiados.current);
    timerAdiados.current = null;
    pendente.current = null;
    adiados.current = [];
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
      if (timerAdiados.current) clearTimeout(timerAdiados.current);
    },
    [],
  );

  return { estado, ultimaFala, modo, erro, nivel, entrada, ligar, desligar, falar };
}
