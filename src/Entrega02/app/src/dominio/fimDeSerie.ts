// Os últimos segundos da série: 3 bips graves antes de os motores pararem
// sozinhos no número de bolas, para quem treina de fone sem olhar a tela.
//
// A conta é a mesma do firmware (atualizarSerie): a série acaba quando o tempo
// com motores ligados (tempoMs, que não anda na pausa) chega a
// bolasAlvo × msPorBolaAtual. O firmware decide pelo relógio dele, não por um
// sensor de bolas, então o fim é previsível. O app só não sabe o tempoMs
// entre um status e o próximo (600 ms no Wi-Fi, 500 ms no BLE): extrapola a
// partir do último status, e o erro fica na latência da resposta (dezenas de
// ms). Sem status recente, não avisa: o fim deixou de ser previsível.

export const AVISO_FIM_SEGUNDOS = 3;
export const AVISO_FIM_MS = AVISO_FIM_SEGUNDOS * 1000;
// Série curta demais: os bips do fim encostariam no bip de partida e na
// frase "Série N de M".
export const SERIE_MINIMA_AVISO_MS = AVISO_FIM_MS + 3000;
// Status mais velho que isto não serve para prever o fim (conexão ruim; o
// watchdog do firmware para os motores em 4 s).
export const STATUS_VELHO_MS = 2000;

export type LeituraSerie = {
  estado: string;
  bolasAlvo: number;
  tempoMs: number;
  // Duty do lançador da série. Com a roda parada (0) o firmware não conta
  // bolas e a série não acaba sozinha.
  lancador: number;
};

// Duração total da série com motores ligados, ou null quando ela não acaba
// sozinha (treino Livre, lançador em 0).
export function duracaoDaSerieMs(l: Pick<LeituraSerie, 'bolasAlvo' | 'lancador'>, msPorBolaAtual: number): number | null {
  if (l.bolasAlvo <= 0 || l.lancador <= 0 || !(msPorBolaAtual > 0)) return null;
  return l.bolasAlvo * msPorBolaAtual;
}

// Quanto falta para a lançadora encerrar a série, extrapolado desde o status
// recebido em `recebidoEm`. null: não está lançando, não acaba sozinha ou o
// status é velho demais.
export function restanteDaSerieMs(l: LeituraSerie, msPorBolaAtual: number, recebidoEm: number, agora: number): number | null {
  if (l.estado !== 'LANCANDO') return null;
  const total = duracaoDaSerieMs(l, msPorBolaAtual);
  if (total === null || !Number.isFinite(l.tempoMs)) return null;
  const idade = agora - recebidoEm;
  if (idade < 0 || idade > STATUS_VELHO_MS) return null;
  return total - (l.tempoMs + idade);
}

// O bip do fim devido agora (3, 2 ou 1), se ainda não tocou. Como na contagem
// de partida: um por segundo, e depois de um salto do relógio só o atual.
export function avisoDeFimDevido(restanteMs: number | null, duracaoMs: number | null, ultimoSegundo: number): number | null {
  if (restanteMs === null || duracaoMs === null || duracaoMs < SERIE_MINIMA_AVISO_MS) return null;
  if (restanteMs <= 0 || restanteMs > AVISO_FIM_MS) return null;
  const s = Math.ceil(restanteMs / 1000);
  return s < ultimoSegundo ? s : null;
}
