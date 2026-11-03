// Sons do NockHug: a contagem de 5 bips antes de os motores ligarem, o bip de
// partida e o toque que confirma que a palavra de ativação foi ouvida.
//
// A contagem é aviso de segurança e toca sempre. O interruptor de Bips das
// Configurações só cala o toque de ativação.
//
// O player fica fora do React (createAudioPlayer) para o som ser curto e
// imediato. A sessão de áudio é configurada uma única vez, na abertura do app:
// o reconhecedor de fala troca a categoria para playAndRecord quando começa a
// ouvir, e chamar setAudioModeAsync depois disso derrubaria o microfone.

import type { AudioPlayer } from 'expo-audio';

export type TipoBip = 'contagem' | 'inicio' | 'toque';

type ModuloAudio = typeof import('expo-audio');

const FONTES: Record<TipoBip, number> = {
  contagem: require('../../assets/sons/bip-curto.wav') as number,
  inicio: require('../../assets/sons/bip-inicio.wav') as number,
  toque: require('../../assets/sons/bip-toque.wav') as number,
};

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
const filas: Record<TipoBip, Promise<void>> = { contagem: Promise.resolve(), inicio: Promise.resolve(), toque: Promise.resolve() };

// Configura a sessão de áudio e pré-carrega os três arquivos. Idempotente.
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
      await Promise.all((Object.keys(FONTES) as TipoBip[]).map((tipo) => m.preload(FONTES[tipo]).catch(() => undefined)));
      jogadores = Object.fromEntries(
        (Object.keys(FONTES) as TipoBip[]).map((tipo) => [tipo, m.createAudioPlayer(FONTES[tipo], { updateInterval: 500 })]),
      ) as Record<TipoBip, AudioPlayer>;
    } catch {
      jogadores = null;
    }
  })();
  return preparando;
}

// Liga ou cala o toque de ativação (a contagem não depende disto).
export function configurarBips(ligado: boolean) {
  habilitado = ligado;
}

export function bipsDisponiveis(): boolean {
  return !!jogadores;
}

// Toca um bip. Cada tipo tem sua fila, então dois bips seguidos não se
// atropelam. Erros de áudio (interrupção, fone desconectado) não interrompem a
// sessão: o aviso visual continua.
export function tocarBip(tipo: TipoBip) {
  if (!jogadores || (tipo === 'toque' && !habilitado)) return;
  const jogador = jogadores[tipo];
  filas[tipo] = filas[tipo]
    .then(async () => {
      await jogador.seekTo(0);
      jogador.play();
      // Um seekTo logo depois do play reagenda o próximo bip a partir do zero.
      await new Promise((r) => setTimeout(r, tipo === 'inicio' ? 480 : 180));
    })
    .catch(() => undefined);
}
