import { descreverTreino, dutyDe, LIMITES, passoPct, pct, TREINOS_PRONTOS, velocidadeDoTreino } from './treinos';

const PADRAO = { lancador: 100, alimentador: 25 };

test('o duty padrão da Entrega 01 aparece como 39% e 10%', () => {
  expect(pct(100)).toBe(39);
  expect(pct(25)).toBe(10);
  expect(dutyDe(100)).toBe(255);
});

test('o passo de 5% encaixa nos múltiplos de 5', () => {
  expect(passoPct(39, 1, LIMITES.lancadorPct)).toBe(40);
  expect(passoPct(39, -1, LIMITES.lancadorPct)).toBe(35);
  expect(passoPct(40, 1, LIMITES.lancadorPct)).toBe(45);
});

test('o passo respeita os limites de cada motor', () => {
  expect(passoPct(100, 1, LIMITES.lancadorPct)).toBe(100);
  expect(passoPct(20, -1, LIMITES.lancadorPct)).toBe(20);
  expect(passoPct(50, 1, LIMITES.alimentadorPct)).toBe(50);
  expect(passoPct(5, -1, LIMITES.alimentadorPct)).toBe(5);
});

test('treino sem velocidade própria usa o padrão', () => {
  expect(velocidadeDoTreino(TREINOS_PRONTOS[0], PADRAO)).toEqual(PADRAO);
  const proprio = { ...TREINOS_PRONTOS[0], velocidade: { lancador: 153, alimentador: 38 } };
  expect(velocidadeDoTreino(proprio, PADRAO)).toEqual({ lancador: 153, alimentador: 38 });
  expect(descreverTreino(proprio)).toContain('lançador 60%');
});
