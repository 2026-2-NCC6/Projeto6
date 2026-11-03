import { bipDevido, cancelaPartida, CONTAGEM_MS, ehPartida, instanteDaPartida, segundoDaContagem } from './partida';

test('ligar e retomar passam pela contagem; o resto não', () => {
  expect(ehPartida('ligar')).toBe(true);
  expect(ehPartida('retomar')).toBe(true);
  expect(ehPartida('desligar')).toBe(false);
  expect(ehPartida('pausar')).toBe(false);
  expect(ehPartida('emergencia')).toBe(false);
});

test('desliga, pausa e "Nock, para" cancelam a contagem', () => {
  expect(cancelaPartida('desligar', 'voz', true)).toBe(true);
  expect(cancelaPartida('desligar', 'botao', true)).toBe(true);
  expect(cancelaPartida('pausar', 'voz', true)).toBe(true);
  expect(cancelaPartida('emergencia', 'voz', true)).toBe(true);
});

test('"Para!" sem a palavra e o botão vermelho são emergência, não cancelamento', () => {
  expect(cancelaPartida('emergencia', 'voz', false)).toBe(false);
  expect(cancelaPartida('emergencia', 'botao', false)).toBe(false);
  expect(cancelaPartida('ligar', 'voz', true)).toBe(false);
});

test('o próprio app disparando a partida nunca se cancela', () => {
  expect(cancelaPartida('desligar', 'auto', true)).toBe(false);
});

test('a contagem vai do 5 ao 1 e some fora da janela', () => {
  expect(segundoDaContagem(CONTAGEM_MS + 1)).toBeNull();
  expect(segundoDaContagem(CONTAGEM_MS)).toBe(5);
  expect(segundoDaContagem(4001)).toBe(5);
  expect(segundoDaContagem(4000)).toBe(4);
  expect(segundoDaContagem(1)).toBe(1);
  expect(segundoDaContagem(0)).toBeNull();
  expect(segundoDaContagem(-500)).toBeNull();
  expect(segundoDaContagem(Number.NaN)).toBeNull();
});

test('um bip por segundo, sem repetir e sem rajada depois de um salto', () => {
  expect(bipDevido(4900, 6)).toBe(5);
  expect(bipDevido(4700, 5)).toBeNull();
  expect(bipDevido(3900, 5)).toBe(4);
  // O app ficou parado do 4 ao 1: toca só o 1.
  expect(bipDevido(800, 4)).toBe(1);
  expect(bipDevido(6000, 6)).toBeNull();
});

test('um "liga" no descanso antecipa a partida para 5 s, mas não a atrasa', () => {
  expect(instanteDaPartida(1_000, null)).toBe(1_000 + CONTAGEM_MS);
  expect(instanteDaPartida(1_000, { em: 60_000 })).toBe(1_000 + CONTAGEM_MS);
  expect(instanteDaPartida(1_000, { em: 3_000 })).toBe(3_000);
});
