import { interpretar } from '@/dominio/vocabulario';
import { AcompanhadorDeTrechos } from './trechos';

describe('AcompanhadorDeTrechos', () => {
  test('entrega só o trecho novo da transcrição acumulada', () => {
    const a = new AcompanhadorDeTrechos();
    expect(a.atualizar('Nock ligar')).toBe('nock ligar');
    a.consumir();
    expect(a.atualizar('Nock ligar Nock')).toBe('nock');
    expect(a.atualizar('Nock ligar Nock desligar')).toBe('nock desligar');
  });

  test('cada comando falado vira um comando, sem misturar com o anterior', () => {
    // Caso real do iPhone: "Nock ligar" ... "Nock desligar" na mesma escuta.
    const a = new AcompanhadorDeTrechos();
    const primeiro = a.atualizar('Nock ligar');
    a.consumir();
    const segundo = a.atualizar('Nock ligar Nock desligar');
    expect(interpretar(primeiro, 'Nock', false)).toEqual({ tipo: 'comando', comando: 'ligar' });
    expect(interpretar(segundo, 'Nock', false)).toEqual({ tipo: 'comando', comando: 'desligar' });
  });

  test('nada novo depois de consumir', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('Nock pausa');
    a.consumir();
    expect(a.atualizar('Nock pausa')).toBe('');
  });

  test('transcrição mais curta indica recomeço do reconhecedor', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('Nock ligar agora mesmo');
    a.consumir();
    expect(a.atualizar('para')).toBe('para');
  });

  test('reiniciar volta a entregar a transcrição inteira', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('Nock retoma');
    a.consumir();
    a.reiniciar();
    expect(a.atualizar('Nock retoma de novo')).toBe('nock retoma de novo');
  });
});
