import {
  clampDescanso,
  descreverTreino,
  duracaoEstimadaMin,
  ehLivre,
  estaPersonalizado,
  LIMITES,
  restaurarTreinoPadrao,
  sanitizarTreino,
  TREINOS_PRONTOS,
  unirTreinos,
  validarTreino,
} from './treinos';
import type { Treino } from './tipos';
import { ajustarMotor, dutyDe, normalizarVelocidade, pct, PRESETS, presetDaVelocidade, velocidadeDoPreset, velocidadeValida } from './velocidade';

const treino = (cambios: Partial<Treino> = {}): Treino => ({
  id: 't-1',
  nome: 'Backhand',
  bolasPorSerie: 15,
  series: 4,
  descansoS: 40,
  padrao: false,
  velocidade: velocidadeDoPreset('medio'),
  ...cambios,
});

test('o duty antigo da Entrega 01 aparece como 39% e 10%', () => {
  expect(pct(100)).toBe(39);
  expect(pct(25)).toBe(10);
  expect(dutyDe(100)).toBe(255);
  expect(dutyDe(0)).toBe(0);
});

test('os presets seguem as medidas pedidas', () => {
  expect(PRESETS.forte).toMatchObject({ lancador: 60, alimentador: 30 });
  expect(PRESETS.medio).toMatchObject({ lancador: 40, alimentador: 25 });
  expect(PRESETS.fraco).toMatchObject({ lancador: 30, alimentador: 20 });
  for (const nome of ['forte', 'medio', 'fraco'] as const) {
    const v = velocidadeDoPreset(nome);
    expect(presetDaVelocidade(v)).toBe(nome);
    expect(pct(v.lancador)).toBe(PRESETS[nome].lancador);
    expect(pct(v.alimentador)).toBe(PRESETS[nome].alimentador);
  }
});

test('valores fora dos presets viram Personalizado', () => {
  expect(presetDaVelocidade({ lancador: dutyDe(45), alimentador: dutyDe(22) })).toBe('personalizado');
});

test('o lançador aceita 0% e o alimentador fica entre 15% e 40%', () => {
  expect(velocidadeValida({ lancador: dutyDe(0), alimentador: dutyDe(15) })).toBe(true);
  expect(velocidadeValida({ lancador: dutyDe(100), alimentador: dutyDe(40) })).toBe(true);
  expect(velocidadeValida({ lancador: dutyDe(100), alimentador: dutyDe(10) })).toBe(false);
  expect(velocidadeValida({ lancador: dutyDe(100), alimentador: dutyDe(45) })).toBe(false);
  expect(velocidadeValida({ lancador: dutyDe(30), alimentador: dutyDe(14) })).toBe(false);
});

test('o passo de 5% respeita cada limite', () => {
  const forte = velocidadeDoPreset('forte');
  expect(pct(ajustarMotor(forte, 'lancador', 1).lancador)).toBe(65);
  expect(pct(ajustarMotor(forte, 'alimentador', -1).alimentador)).toBe(25);
  const zero = { lancador: dutyDe(0), alimentador: dutyDe(15) };
  expect(pct(ajustarMotor(zero, 'lancador', -1).lancador)).toBe(0);
  expect(pct(ajustarMotor(zero, 'alimentador', -1).alimentador)).toBe(15);
  const max = { lancador: dutyDe(100), alimentador: dutyDe(40) };
  expect(pct(ajustarMotor(max, 'lancador', 1).lancador)).toBe(100);
  expect(pct(ajustarMotor(max, 'alimentador', 1).alimentador)).toBe(40);
});

test('normalizarVelocidade traz valores antigos para os limites novos', () => {
  expect(normalizarVelocidade({ lancador: 100, alimentador: 25 })).toEqual({ lancador: 100, alimentador: 38 });
  expect(pct(normalizarVelocidade({ lancador: 100, alimentador: 25 })!.alimentador)).toBe(15);
  const alimBaixo = normalizarVelocidade({ lancador: 100, alimentador: 10 });
  expect(pct(alimBaixo!.alimentador)).toBe(15);
  const alto = normalizarVelocidade({ lancador: 999, alimentador: 999 });
  expect(pct(alto!.lancador)).toBe(100);
  expect(pct(alto!.alimentador)).toBe(40);
  expect(normalizarVelocidade(undefined)).toBeNull();
  expect(normalizarVelocidade({ lancador: 'x' })).toBeNull();
});

test('o treino padrão não tem velocidade de fábrica e é editável', () => {
  for (const p of TREINOS_PRONTOS) {
    expect(p.padrao).toBe(true);
    expect(p.velocidade).toBeUndefined();
    expect(validarTreino(p).velocidade).toBeTruthy();
  }
  expect(TREINOS_PRONTOS.map((t) => t.nome)).toEqual(['Aquecimento', 'Resistência', 'Livre']);
});

test('validarTreino cobre nome, bolas, séries, descanso e velocidade', () => {
  expect(validarTreino(treino())).toEqual({});
  expect(validarTreino(treino({ nome: '   ' })).nome).toBeTruthy();
  expect(validarTreino(treino({ bolasPorSerie: 2 })).bolas).toBeTruthy();
  expect(validarTreino(treino({ series: 0 })).series).toBeTruthy();
  expect(validarTreino(treino({ descansoS: 5 })).descanso).toBeTruthy();
  expect(validarTreino(treino({ velocidade: undefined })).velocidade).toBeTruthy();
  expect(validarTreino(treino({ velocidade: { lancador: 255, alimentador: 10 } })).velocidade).toBeTruthy();
});

test('o treino Livre ignora bolas, séries e descanso', () => {
  const livre = { ...TREINOS_PRONTOS[2], velocidade: velocidadeDoPreset('fraco') };
  expect(ehLivre(livre)).toBe(true);
  expect(validarTreino(livre)).toEqual({});
});

test('sanitizarTreino conserta registros antigos sem quebrar a tela', () => {
  const antigo = sanitizarTreino({ id: 'aquecimento', nome: 'Aquecimento', bolasPorSerie: 10, series: 3, descansoS: 30, pronto: true });
  expect(antigo).toMatchObject({ id: 'aquecimento', padrao: true, bolasPorSerie: 10, series: 3, descansoS: 30 });
  expect(antigo?.velocidade).toBeUndefined();

  const comVelocidadeAntiga = sanitizarTreino({ id: 't-x', nome: 'Meu', bolasPorSerie: 12, series: 2, descansoS: 20, velocidade: { lancador: 100, alimentador: 8 } });
  expect(pct(comVelocidadeAntiga!.velocidade!.alimentador)).toBe(15);

  expect(sanitizarTreino(null)).toBeNull();
  expect(sanitizarTreino({ nome: 'sem id' })).toBeNull();
  expect(sanitizarTreino({ id: 't-y', nome: '', bolasPorSerie: 999, series: -1, descansoS: 900 })).toMatchObject({
    bolasPorSerie: LIMITES.bolasPorSerie.max,
    series: LIMITES.series.min,
    descansoS: LIMITES.descansoS.max,
  });
});

test('sanitizarTreino preserva origem e versão publicada', () => {
  const t = sanitizarTreino({
    id: 'pub-abc',
    nome: 'Cruzado',
    bolasPorSerie: 10,
    series: 3,
    descansoS: 30,
    origem: 'plataforma',
    versaoPublicada: 2,
    ruido: true,
  });
  expect(t?.origem).toBe('plataforma');
  expect(t?.versaoPublicada).toBe(2);
  expect(t).not.toHaveProperty('ruido');
});

test('unirTreinos sobrescreve os prontos editados e mantém os criados', () => {
  const editado = { ...TREINOS_PRONTOS[0], nome: 'Aquecimento longo', velocidade: velocidadeDoPreset('fraco'), personalizado: true };
  const criado = treino({ id: 't-novo', nome: 'Saque' });
  const lista = unirTreinos([editado, criado]);
  expect(lista).toHaveLength(4);
  expect(lista[0].nome).toBe('Aquecimento longo');
  expect(lista[0].padrao).toBe(true);
  expect(lista[0].personalizado).toBe(true);
  expect(lista[1].nome).toBe('Resistência');
  expect(lista[3].id).toBe('t-novo');
  expect(estaPersonalizado([editado], 'aquecimento')).toBe(true);
  expect(estaPersonalizado([criado], 'aquecimento')).toBe(false);
  expect(restaurarTreinoPadrao('aquecimento')?.nome).toBe('Aquecimento');
});

test('descreverTreino mostra a velocidade atual ou a pendência', () => {
  expect(descreverTreino(TREINOS_PRONTOS[0])).toContain('velocidade a definir');
  const t = treino({ velocidade: velocidadeDoPreset('forte') });
  expect(descreverTreino(t)).toContain('Forte 60% / 30%');
  expect(descreverTreino({ ...t, velocidade: { lancador: dutyDe(45), alimentador: dutyDe(22) } })).toContain('Personalizado 45% / 22%');
  expect(descreverTreino({ ...TREINOS_PRONTOS[2], velocidade: velocidadeDoPreset('medio') })).toContain('desliga');
});

test('duração estimada soma disparos e descansos', () => {
  // 4 × 15 bolas × 2 s + 3 × 40 s = 240 s = 4 min
  expect(duracaoEstimadaMin(treino(), 2000)).toBe(4);
  expect(duracaoEstimadaMin({ ...TREINOS_PRONTOS[2] }, 2000)).toBe(0);
});

test('clampDescanso mantém o descanso entre 10 e 120 segundos', () => {
  expect(clampDescanso(0)).toBe(10);
  expect(clampDescanso(45)).toBe(45);
  expect(clampDescanso(999)).toBe(120);
});
