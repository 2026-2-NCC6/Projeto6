import { AVISO_MS, avisoComAntecedencia, decidirFimDoDescanso, novoAlvoDescanso, podeRetomarAutomaticamente, segundosRestantes, situacaoDescanso, TOLERANCIA_RETOMADA_MS } from './descanso';

test('só a série concluída pelas próprias bolas retoma sozinha', () => {
  expect(podeRetomarAutomaticamente('serie_concluida', true)).toBe(true);
  expect(podeRetomarAutomaticamente('serie_concluida', false)).toBe(false);
  expect(podeRetomarAutomaticamente('desligar', true)).toBe(false);
  expect(podeRetomarAutomaticamente('emergencia', true)).toBe(false);
});

test('o descanso espera, retoma ou expira conforme o relógio', () => {
  expect(decidirFimDoDescanso(10_000, true)).toBe('aguardar');
  expect(decidirFimDoDescanso(0, true)).toBe('retomar');
  expect(decidirFimDoDescanso(-1_000, true)).toBe('retomar');
  expect(decidirFimDoDescanso(-TOLERANCIA_RETOMADA_MS - 1, true)).toBe('expirado');
  expect(decidirFimDoDescanso(0, false)).toBe('manual');
  expect(decidirFimDoDescanso(5_000, false)).toBe('aguardar');
});

test('a situação do descanso muda no aviso de 5 s', () => {
  expect(situacaoDescanso(30_000, true)).toBe('contando');
  expect(situacaoDescanso(AVISO_MS, true)).toBe('avisando');
  expect(situacaoDescanso(1_000, true)).toBe('avisando');
  expect(situacaoDescanso(0, true)).toBe('pronto');
  expect(situacaoDescanso(30_000, false)).toBe('cancelado');
  expect(situacaoDescanso(0, false)).toBe('pronto');
});

test('mudar o tempo do descanso desloca o alvo e nunca come o aviso de 5 s', () => {
  const agora = 1_000_000;
  // Faltam 30 s; mais 10 s de descanso → 40 s.
  expect(novoAlvoDescanso(agora + 30_000, 10_000, agora, true)).toBe(agora + 40_000);
  // Faltam 8 s; menos 30 s → alvo cortado para 5 s à frente (aviso preservado).
  expect(novoAlvoDescanso(agora + 8_000, -30_000, agora, true)).toBe(agora + AVISO_MS);
  // Sem retomada automática, pode acabar já (meio segundo para o estado respirar).
  expect(novoAlvoDescanso(agora + 8_000, -30_000, agora, false)).toBe(agora + 500);
});

test('o aviso precisa ter tocado com antecedência para retomar', () => {
  expect(avisoComAntecedencia(0, 1_000_000)).toBe(false);
  // Aviso e início no mesmo instante: não vale.
  expect(avisoComAntecedencia(1_000_000, 1_000_000)).toBe(false);
  expect(avisoComAntecedencia(1_000_000, 1_004_000)).toBe(true);
  expect(avisoComAntecedencia(1_000_000, 1_003_000)).toBe(false);
});

test('segundos restantes arredondam para cima e param em zero', () => {
  expect(segundosRestantes(1_000, 0)).toBe(1);
  expect(segundosRestantes(1_200, 0)).toBe(2);
  expect(segundosRestantes(0, 1_000)).toBe(0);
});
