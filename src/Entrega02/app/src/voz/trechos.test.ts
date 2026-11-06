import { escolherInterpretacao, filtrarRevisao, interpretar } from '@/dominio/vocabulario';
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
    expect(interpretar(primeiro, 'Nock', false)).toEqual({ tipo: 'comando', comando: 'ligar', ativada: true });
    expect(interpretar(segundo, 'Nock', false)).toEqual({ tipo: 'comando', comando: 'desligar', ativada: true });
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

  test('trechoDe mede a alternativa contra o consumido da principal', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('Nock liga');
    a.consumir();
    expect(a.trechoDe('Nock liga nock desliga')).toBe('nock desliga');
    expect(a.trechoDe('Nock liga')).toBe('');
    expect(a.trechoDe('Nock liga agora Nock desliga')).toBe('agora nock desliga');
    expect(a.trechoDe('Nock liga agora Nock desliga Nock pausa Nock retoma Nock para Nock sobe Nock vai', 3)).toBe('sobe nock vai');
  });

  test('reiniciar volta a entregar a transcrição inteira', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('Nock retoma');
    a.consumir();
    a.reiniciar();
    expect(a.atualizar('Nock retoma de novo')).toBe('nock retoma de novo');
  });

  test('o final fecha o segmento mesmo sem trecho novo', () => {
    // Android: a pausa de 700 ms decide "nock liga" antes do final chegar.
    // O final repete o texto já tratado; a frase seguinte começa do zero e não
    // pode ter as primeiras palavras engolidas como "já tratadas".
    const a = new AcompanhadorDeTrechos();
    a.atualizar('nock liga');
    a.consumir();
    expect(a.atualizar('nock liga', true)).toBe('');
    expect(a.atualizar('nock desliga')).toBe('nock desliga');
  });

  test('o final fecha o segmento mesmo com um ruído mais longo já tratado', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('a o e');
    a.consumir();
    a.atualizar('a o e', true);
    expect(a.atualizar('ah nock desliga')).toBe('ah nock desliga');
  });

  test('cada segmento tem seu número; o aberto deixa de ser com o final', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('nock');
    const s = a.segmento;
    expect(a.aberto(s)).toBe(true);
    a.atualizar('nock desliga', true);
    expect(a.aberto(s)).toBe(false);
    a.atualizar('liga');
    expect(a.segmento).not.toBe(s);
    expect(a.aberto(a.segmento)).toBe(true);
  });
});

describe('revisão do parcial com o motor ligado', () => {
  // O iPhone reescreve palavras já entregues quando chega o resto da fala.
  // Com o motor ligado, o ruído vira palavras soltas que já foram tratadas.
  const decidir = (a: AcompanhadorDeTrechos, texto: string) => {
    const trecho = a.atualizar(texto);
    const escolha = escolherInterpretacao([trecho], 'Nock', false);
    const revisto = a.revisao();
    return revisto === null ? escolha.resultado : filtrarRevisao(escolha, revisto, 'Nock').resultado;
  };

  test('ruído tratado reescrito como "nock desliga", do mesmo tamanho, não some', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('a e');
    a.consumir();
    // Só pela contagem de palavras este trecho era vazio.
    expect(a.atualizar('nock desliga')).toBe('nock desliga');
    expect(a.revisao()).toBe('a e');
  });

  test('ruído tratado reescrito como "nock": o desliga chega com a ativação', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('a e');
    a.consumir();
    // Só pela contagem, o trecho era "desliga", sem o "Nock": recusado.
    expect(decidir(a, 'a nock desliga')).toEqual({ tipo: 'comando', comando: 'desligar', ativada: true });
  });

  test('"nock liga" reescrito como "knock liga" não liga de novo', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('nock liga');
    a.consumir();
    expect(decidir(a, 'knock liga')).toEqual({ tipo: 'ignorado', motivo: 'nao_entendi' });
  });

  test('"nock desliga" já atendido e só reescrito não desliga duas vezes', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('nock desliga');
    a.consumir();
    expect(decidir(a, 'nok desliga')).toEqual({ tipo: 'ignorado', motivo: 'nao_entendi' });
  });

  test('revisão seguida de um novo "nock desliga" ainda para', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('nock desliga');
    a.consumir();
    expect(decidir(a, 'nok desliga nock desliga')).toEqual({ tipo: 'comando', comando: 'desligar', ativada: true });
  });

  test('sem revisão, só o acréscimo conta e tudo vale', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('nock liga');
    a.consumir();
    expect(decidir(a, 'nock liga nock pausa')).toEqual({ tipo: 'comando', comando: 'pausar', ativada: true });
    expect(a.revisao()).toBeNull();
  });

  test('as alternativas começam no mesmo ponto da principal revista', () => {
    const a = new AcompanhadorDeTrechos();
    a.atualizar('a e');
    a.consumir();
    a.atualizar('a nock desliga');
    expect(a.trechoDe('a nock para')).toBe('nock para');
  });
});
