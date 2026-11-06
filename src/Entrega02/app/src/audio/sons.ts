// Sons do NockHug: a contagem de 5 bips antes de os motores ligarem, o bip de
// partida, o toque que confirma que a palavra de ativação foi ouvida e os
// sinais da série (os 3 bips graves dos últimos segundos, a pausa e o fim).
// Agudo e subindo é partida; grave e descendo é parada.
//
// A contagem e o bip de partida são aviso de segurança e tocam sempre. O
// interruptor de Sinais sonoros das Configurações cala só os outros.
//
// O player fica fora do React (createAudioPlayer) para o som ser curto e
// imediato.
//
// O player do Android (ExoPlayer) não se recupera sozinho de um erro de
// reprodução: quando a rota de áudio muda no meio (fone Bluetooth ligando o
// canal SCO, escuta desligada e religada ao parar, rearmar ou voltar à
// sessão), ele fica parado em "idle" e todo play seguinte é mudo, até o app
// ser reaberto. Era por isso que a contagem às vezes não tocava. Agora cada
// contagem começa com players novos (renovarBips) e um player que quebrou no
// meio é recriado na hora de tocar. A sessão de áudio é configurada uma única vez, na abertura do app:
// o reconhecedor de fala troca a categoria para playAndRecord quando começa a
// ouvir, e chamar setAudioModeAsync depois disso derrubaria o microfone.

import type { AudioPlayer } from 'expo-audio';

export type TipoBip = 'contagem' | 'inicio' | 'toque' | 'aviso' | 'pausa' | 'fim';

type ModuloAudio = typeof import('expo-audio');

const FONTES: Record<TipoBip, number> = {
  contagem: require('../../assets/sons/bip-curto.wav') as number,
  inicio: require('../../assets/sons/bip-inicio.wav') as number,
  toque: require('../../assets/sons/bip-toque.wav') as number,
  // Últimos segundos da série: um por segundo, do 3 ao 1.
  aviso: require('../../assets/sons/bip-aviso.wav') as number,
  pausa: require('../../assets/sons/bip-pausa.wav') as number,
  fim: require('../../assets/sons/bip-fim.wav') as number,
};

const TIPOS = Object.keys(FONTES) as TipoBip[];
function porTipo<T>(v: () => T): Record<TipoBip, T> {
  return Object.fromEntries(TIPOS.map((t) => [t, v()])) as Record<TipoBip, T>;
}

// Os que tocam mesmo com os sinais sonoros desligados.
const SEMPRE: ReadonlySet<TipoBip> = new Set(['contagem', 'inicio']);

// Quanto a fila de cada tipo espera depois do play (a duração do arquivo).
const DURACAO_MS: Record<TipoBip, number> = { contagem: 180, inicio: 480, toque: 180, aviso: 160, pausa: 290, fim: 500 };

let modulo: ModuloAudio | null = null;
try {
  // require (e não import) para o app continuar abrindo num build antigo, sem
  // o módulo nativo do expo-audio: os bips ficam desligados e o resto funciona.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- o app precisa abrir num build antigo, sem o módulo nativo; o import estático derrubaria a abertura.
  modulo = require('expo-audio') as ModuloAudio;
} catch {
  modulo = null;
}

let jogadores: Record<TipoBip, AudioPlayer> | null = null;
let preparando: Promise<void> | null = null;
let habilitado = true;
const filas = porTipo<Promise<void>>(() => Promise.resolve());
// Player recém-criado: já começa no zero, então o primeiro play dispensa o seekTo.
const novos = porTipo(() => true);
// Geração de cada fila: renovar um player abandona a fila antiga (que pode
// estar presa num seekTo que nunca volta) sem esperar por ela.
const geracoes = porTipo(() => 0);

// Um seekTo que não volta não pode travar a fila: depois deste tempo, o
// player é tratado como quebrado.
const LIMITE_SEEK_MS = 400;

function criar(m: ModuloAudio, tipo: TipoBip): AudioPlayer {
  novos[tipo] = true;
  return m.createAudioPlayer(FONTES[tipo], { updateInterval: 500 });
}

// Troca o player de um tipo por um novo e solta o antigo.
function renovar(tipo: TipoBip) {
  const m = modulo;
  if (!m || !jogadores) return;
  const antigo = jogadores[tipo];
  try {
    jogadores[tipo] = criar(m, tipo);
  } catch {
    return; // fica com o antigo
  }
  geracoes[tipo]++;
  filas[tipo] = Promise.resolve();
  try {
    antigo.remove();
  } catch {
    // já solto
  }
}

// "idle" depois de carregado é o estado de erro do ExoPlayer: sem um novo
// prepare, nada mais toca.
function quebrado(jogador: AudioPlayer): boolean {
  try {
    return jogador.currentStatus.playbackState === 'idle';
  } catch {
    return true;
  }
}

function comLimite<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), ms))]);
}

// Players novos para a contagem e o bip de partida. Chamado no primeiro bip de
// cada contagem: o aviso de segurança nunca depende de um player que pode ter
// quebrado numa troca de rota de áudio desde a contagem anterior. Os avisos do
// fim da série pedem os seus no primeiro dos 3 bips.
export function renovarBips(tipos: TipoBip[] = ['contagem', 'inicio']) {
  tipos.forEach(renovar);
}

// Configura a sessão de áudio e pré-carrega os arquivos. Idempotente.
export function prepararAudio(): Promise<void> {
  if (preparando) return preparando;
  preparando = (async () => {
    const m = modulo;
    if (!m) return;
    try {
      // O objeto completo é obrigatório: campos omitidos voltam ao padrão
      // nativo, e no iOS o padrão deixa o som mudo no modo silencioso.
      await m.setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        allowsRecording: false,
        shouldPlayInBackground: true,
        shouldRouteThroughEarpiece: false,
        allowsBackgroundRecording: false,
      });
      await Promise.all(TIPOS.map((tipo) => m.preload(FONTES[tipo]).catch(() => undefined)));
      jogadores = Object.fromEntries(TIPOS.map((tipo) => [tipo, criar(m, tipo)])) as Record<TipoBip, AudioPlayer>;
    } catch {
      jogadores = null;
    }
  })();
  return preparando;
}

// Liga ou cala os sinais que não são de segurança (a contagem não depende disto).
export function configurarBips(ligado: boolean) {
  habilitado = ligado;
}

export function bipsDisponiveis(): boolean {
  return !!jogadores;
}

// O tipo tocaria agora (módulo de áudio presente e, se não for de segurança,
// sinais sonoros ligados).
export function bipHabilitado(tipo: TipoBip): boolean {
  return !!jogadores && (SEMPRE.has(tipo) || habilitado);
}

// Toca um bip. Cada tipo tem sua fila, então dois bips seguidos não se
// atropelam. Erros de áudio (interrupção, fone desconectado) não interrompem a
// sessão: o aviso visual continua.
export function tocarBip(tipo: TipoBip) {
  if (!bipHabilitado(tipo)) return;
  const geracao = geracoes[tipo];
  filas[tipo] = filas[tipo]
    .then(async () => {
      if (!jogadores || geracoes[tipo] !== geracao) return; // fila abandonada
      if (!novos[tipo] && quebrado(jogadores[tipo])) renovar(tipo);
      const jogador = jogadores[tipo];
      if (novos[tipo]) {
        novos[tipo] = false;
      } else {
        try {
          await comLimite(jogador.seekTo(0), LIMITE_SEEK_MS);
        } catch {
          // Preso ou com erro: um player novo toca do zero.
          renovar(tipo);
          novos[tipo] = false;
          jogadores[tipo].play();
          await new Promise((r) => setTimeout(r, DURACAO_MS[tipo]));
          return;
        }
      }
      jogador.play();
      // Um seekTo logo depois do play reagenda o próximo bip a partir do zero.
      await new Promise((r) => setTimeout(r, DURACAO_MS[tipo]));
    })
    .catch(() => undefined);
}
