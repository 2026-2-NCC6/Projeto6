// O reconhecimento contínuo devolve a transcrição acumulada da sessão de escuta
// ("nock liga ... nock desliga"), e no iOS quase nunca marca uma frase como
// final. Este acompanhador entrega só o trecho que ainda não foi tratado.
//
// O tratado é guardado pelas PALAVRAS, não só pela contagem: o reconhecedor
// reescreve o parcial (com o motor ligado, um ruído "a é" já tratado vira
// "a nock" quando chega o resto da fala). Contando só palavras, o "nock
// desliga" que entrou no lugar do ruído sumia, ou chegava como "desliga" sem a
// ativação.

import { normalizar } from '@/dominio/vocabulario';

// Silêncio depois da última palavra para decidir sem esperar o resultado final.
export const PAUSA_PARA_DECIDIR_MS = 700;

export class AcompanhadorDeTrechos {
  private tokens: string[] = [];
  // As palavras já tratadas, como estavam quando foram tratadas.
  private tratados: string[] = [];
  // Onde o trecho atual começa na transcrição.
  private inicio = 0;
  private substituido: string | null = null;
  // O resultado final fecha o segmento: a próxima transcrição começa do zero.
  private encerrado = false;
  // Muda a cada segmento novo; uma decisão atrasada só consome o próprio.
  segmento = 0;

  // Recebe a transcrição completa e devolve o trecho novo (normalizado).
  atualizar(texto: string, final = false): string {
    if (this.encerrado) this.reiniciar();
    this.encerrado = final;
    this.tokens = normalizar(texto).split(' ').filter(Boolean);
    this.substituido = null;

    let comum = 0;
    while (comum < this.tratados.length && comum < this.tokens.length && this.tokens[comum] === this.tratados[comum]) comum++;

    if (comum === this.tratados.length) {
      this.inicio = comum;
    } else if (comum === 0 && this.tokens.length < this.tratados.length) {
      // Mais curta e sem nada em comum: o reconhecedor recomeçou.
      this.tratados = [];
      this.inicio = 0;
    } else {
      // Revisão: o trecho vai desde a primeira palavra reescrita.
      this.inicio = comum;
      this.substituido = this.tratados.slice(comum).join(' ');
    }
    return this.tokens.slice(this.inicio).join(' ');
  }

  // Palavras já tratadas que a última transcrição reescreveu, ou null se ela
  // só acrescentou. Com revisão, o trecho pode repetir uma fala já atendida.
  revisao(): string | null {
    return this.substituido;
  }

  // Trecho novo de uma transcrição ALTERNATIVA, medida a partir do mesmo
  // ponto da principal. Limitado às últimas palavras para uma hipótese mais
  // longa não trazer um comando antigo de volta.
  trechoDe(texto: string, maxTokens = 8): string {
    const tokens = normalizar(texto).split(' ').filter(Boolean);
    if (tokens.length <= this.inicio) return '';
    return tokens.slice(this.inicio).slice(-maxTokens).join(' ');
  }

  // O segmento ainda pode receber palavras (não houve final nem recomeço).
  aberto(segmento: number): boolean {
    return segmento === this.segmento && !this.encerrado;
  }

  // Marca como tratado tudo o que chegou até agora.
  consumir() {
    this.tratados = [...this.tokens];
    this.inicio = this.tokens.length;
    this.substituido = null;
  }

  // Nova sessão de escuta: a próxima transcrição começa do zero.
  reiniciar() {
    this.tokens = [];
    this.tratados = [];
    this.inicio = 0;
    this.substituido = null;
    this.encerrado = false;
    this.segmento++;
  }
}
