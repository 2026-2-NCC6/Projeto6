// O reconhecimento contínuo devolve a transcrição acumulada da sessão de escuta
// ("nock liga ... nock desliga"), e no iOS quase nunca marca uma frase como
// final. Este acompanhador entrega só o trecho que ainda não foi tratado.

import { normalizar } from '@/dominio/vocabulario';

// Silêncio depois da última palavra para decidir sem esperar o resultado final.
export const PAUSA_PARA_DECIDIR_MS = 700;

export class AcompanhadorDeTrechos {
  private tokens: string[] = [];
  private consumido = 0;

  // Recebe a transcrição completa e devolve o trecho novo (normalizado).
  atualizar(texto: string): string {
    this.tokens = normalizar(texto).split(' ').filter(Boolean);
    // Transcrição mais curta que o já tratado: o reconhecedor recomeçou.
    if (this.tokens.length < this.consumido) this.consumido = 0;
    return this.tokens.slice(this.consumido).join(' ');
  }

  // Marca como tratado tudo o que chegou até agora.
  consumir() {
    this.consumido = this.tokens.length;
  }

  // Nova sessão de escuta: a próxima transcrição começa do zero.
  reiniciar() {
    this.tokens = [];
    this.consumido = 0;
  }
}
