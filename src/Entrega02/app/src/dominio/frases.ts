// O que o app fala durante a sessão. Pensado para quem treina de fone, sem
// olhar a tela: cada transição tem uma frase curta, sempre no mesmo formato
// ("Série 2 de 5 ..."), e nenhuma transição fala duas vezes.
//
// O app ouve a própria voz. Por isso nenhuma frase pode conter um termo de
// comando (vocabulario.ts): "para", "pare" e "socorro" disparam a emergência
// sem a palavra de ativação, e os outros ("pausa", "liga", "espera",
// "continua", "começa"...) virariam comando se o praticante dissesse "Nock"
// logo antes. Daí "Série pausada" e não "Pausa iniciada", "Nada a cancelar" e
// não "Nada para cancelar". fraseSegura confere isso nos testes e na hora de
// falar.

import { contemAtivacao, encontrarComando, encontrarComandoColado, interpretar } from './vocabulario';

export const FRASE = {
  // Depois da contagem, quando os motores voltam de uma pausa.
  retomando: 'Retomando',
  pausada: 'Série pausada',
  // "Desliga" que não fechou série nenhuma (por exemplo, a resposta se perdeu).
  desligado: 'Desligado',
  paradaSegura: 'Parada segura',
  // Mostrada na tela, não falada: a contagem se anuncia pelos bips.
  contagem: 'Motores em 5 segundos',
  cancelada: 'Partida cancelada',
  nadaACancelar: 'Nada a cancelar',
  retomadaJaDesligada: 'A retomada já estava desligada',
  descansoEncerrado: 'Descanso encerrado',
  conexaoPerdida: 'Conexão perdida. Motores parados',
  repouso: 'A lançadora voltou ao repouso. Rearme antes de seguir',
} as const;

// "30 segundos", "1 minuto", "1 minuto e 30 segundos".
export function duracaoFalada(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return s === 1 ? '1 segundo' : `${s} segundos`;
  const min = Math.floor(s / 60);
  const resto = s % 60;
  const m = min === 1 ? '1 minuto' : `${min} minutos`;
  return resto ? `${m} e ${resto === 1 ? '1 segundo' : `${resto} segundos`}` : m;
}

// "Série 2 de 5" num treino com séries; "Série 2" no Livre (total null).
function serie(n: number, total: number | null): string {
  return total ? `Série ${n} de ${total}` : `Série ${n}`;
}

// Os motores acabaram de ligar (a contagem terminou).
export function fraseInicioSerie(n: number, total: number | null): string {
  return serie(n, total);
}

export type FimDeSerie = {
  n: number;
  total: number | null; // null = Livre
  bolas: number;
  // serie_concluida: a lançadora parou sozinha no número de bolas.
  // desligar: o praticante desligou antes.
  motivo: 'serie_concluida' | 'desligar';
  descansoS: number;
  autoRetomar: boolean;
};

// Uma frase só para o fim da série, o descanso e o fim do treino: o "Desligado"
// do comando fica calado quando esta já foi dita.
export function fraseFimSerie(f: FimDeSerie): string {
  const verbo = f.motivo === 'serie_concluida' ? 'concluída' : 'encerrada';
  if (!f.total) return `${serie(f.n, null)} ${verbo}. ${f.bolas === 1 ? '1 bola' : `${f.bolas} bolas`}`;
  const base = `${serie(f.n, f.total)} ${verbo}`;
  if (f.n >= f.total) return `${base}. Treino concluído`;
  const descanso = `Descanso de ${duracaoFalada(f.descansoS)}`;
  return f.autoRetomar ? `${base}. ${descanso}` : `${base}. ${descanso}, sem retomada automática`;
}

export function fraseFaltaDescanso(segundos: number): string {
  return `Faltam ${duracaoFalada(segundos)} de descanso`;
}

// A frase pode ser dita em voz alta sem o app se comandar: nenhum termo de
// comando (nem colado à palavra), nada de "para"/"pare"/"socorro" e nem a
// própria palavra de ativação, que abriria a janela de comando sozinha.
export function fraseSegura(frase: string, palavra = 'Nock'): boolean {
  if (/\b(para|pare|socorro)\b/i.test(frase)) return false;
  if (encontrarComando(frase) || encontrarComandoColado(frase, palavra)) return false;
  if (contemAtivacao(frase, palavra)) return false;
  // O pior caso: o praticante diz a palavra e o app fala logo em seguida.
  return interpretar(`${palavra} ${frase}`, palavra, true).tipo !== 'comando';
}
