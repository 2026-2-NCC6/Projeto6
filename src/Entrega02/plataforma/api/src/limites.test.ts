import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dutyDe, pct, presetDaVelocidade, segredoAceito, velocidadeDoPreset, velocidadeValida } from './limites.js';

test('os três vetores de duty e o alimentador de 10% ou 50%', () => {
  assert.deepEqual(velocidadeDoPreset('forte'), { lancador: 153, alimentador: 77 });
  assert.deepEqual(velocidadeDoPreset('medio'), { lancador: 102, alimentador: 64 });
  assert.deepEqual(velocidadeDoPreset('fraco'), { lancador: 77, alimentador: 51 });
  assert.equal(pct(velocidadeDoPreset('forte').lancador), 60);
  assert.equal(pct(velocidadeDoPreset('forte').alimentador), 30);
  assert.equal(presetDaVelocidade(velocidadeDoPreset('medio')), 'medio');
  assert.equal(velocidadeValida({ lancador: dutyDe(60), alimentador: dutyDe(10) }), false);
  assert.equal(velocidadeValida({ lancador: dutyDe(60), alimentador: dutyDe(50) }), false);
  assert.equal(velocidadeValida(velocidadeDoPreset('fraco')), true);
});

test('JWT_SECRET curto impede o boot em produção', () => {
  assert.equal(segredoAceito('curto', 'production'), false);
  assert.equal(segredoAceito('x'.repeat(32), 'production'), true);
  assert.equal(segredoAceito('curto', 'test'), true);
});
