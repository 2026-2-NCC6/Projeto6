import { AVISO_FIM_MS, avisoDeFimDevido, duracaoDaSerieMs, restanteDaSerieMs, SERIE_MINIMA_AVISO_MS, STATUS_VELHO_MS, type LeituraSerie } from './fimDeSerie';

// 12 bolas a 1 s cada: a série acaba quando tempoMs chega a 12 000.
const L: LeituraSerie = { estado: 'LANCANDO', bolasAlvo: 12, tempoMs: 8_000, lancador: 100 };

test('a duração é a mesma conta do firmware (bolas × ms por bola)', () => {
  expect(duracaoDaSerieMs(L, 1000)).toBe(12_000);
  expect(duracaoDaSerieMs({ ...L, bolasAlvo: 0 }, 1000)).toBeNull(); // Livre
  expect(duracaoDaSerieMs({ ...L, lancador: 0 }, 1000)).toBeNull(); // roda parada: não acaba sozinha
  expect(duracaoDaSerieMs(L, 0)).toBeNull();
});

test('o restante é extrapolado desde o último status', () => {
  expect(restanteDaSerieMs(L, 1000, 50_000, 50_000)).toBe(4_000);
  expect(restanteDaSerieMs(L, 1000, 50_000, 51_500)).toBe(2_500);
});

test('sem previsão fora da série, no Livre ou com status velho', () => {
  expect(restanteDaSerieMs({ ...L, estado: 'PAUSADO' }, 1000, 0, 0)).toBeNull();
  expect(restanteDaSerieMs({ ...L, estado: 'ARMADO' }, 1000, 0, 0)).toBeNull();
  expect(restanteDaSerieMs({ ...L, estado: 'PARADA_SEGURA' }, 1000, 0, 0)).toBeNull();
  expect(restanteDaSerieMs({ ...L, bolasAlvo: 0 }, 1000, 0, 0)).toBeNull();
  expect(restanteDaSerieMs(L, 1000, 0, STATUS_VELHO_MS + 1)).toBeNull();
  expect(restanteDaSerieMs(L, 1000, 1000, 0)).toBeNull(); // relógio voltou
});

test('três bips, do 3 ao 1, um por segundo, sem repetir', () => {
  const d = 12_000;
  expect(avisoDeFimDevido(AVISO_FIM_MS + 1, d, 4)).toBeNull();
  expect(avisoDeFimDevido(AVISO_FIM_MS, d, 4)).toBe(3);
  expect(avisoDeFimDevido(2_500, d, 3)).toBeNull();
  expect(avisoDeFimDevido(2_000, d, 3)).toBe(2);
  expect(avisoDeFimDevido(900, d, 2)).toBe(1);
  expect(avisoDeFimDevido(0, d, 1)).toBeNull();
  expect(avisoDeFimDevido(-200, d, 4)).toBeNull();
  // Depois de um salto (app suspenso), só o segundo atual: nada de rajada.
  expect(avisoDeFimDevido(700, d, 4)).toBe(1);
});

test('sem bips em série curta, no Livre ou sem previsão', () => {
  expect(avisoDeFimDevido(2_000, SERIE_MINIMA_AVISO_MS - 1, 4)).toBeNull();
  expect(avisoDeFimDevido(2_000, null, 4)).toBeNull();
  expect(avisoDeFimDevido(null, 12_000, 4)).toBeNull();
});
