import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ROTAS } from './rotas.js';

const CAMINHOS = [
  '/v1/entrar',
  '/v1/eu',
  '/v1/treinos',
  '/v1/treinos/{id}',
  '/v1/treinos/{id}/revisoes',
  '/v1/treinos/{id}/publicar',
  '/v1/treinos/{id}/versoes',
  '/v1/treinos/{id}/versoes/{versao}',
  '/v1/sessoes',
  '/v1/sessoes/{id}',
  '/v1/usuarios',
  '/v1/auditoria',
  '/v1/saude',
  '/v1/saude/banco',
  '/v1/openapi.yaml',
];

test('o YAML contém cada caminho da seção 10 e cada rota registrada', () => {
  const yaml = readFileSync(fileURLToPath(new URL('../openapi.yaml', import.meta.url)), 'utf8');
  for (const caminho of CAMINHOS) assert.ok(yaml.includes(`  ${caminho}:`), caminho);
  for (const rota of ROTAS) {
    const aberto = rota.caminho.replace(/:([A-Za-z]+)/g, '{$1}');
    assert.ok(yaml.includes(`  ${aberto}:`), `${rota.metodo} ${aberto}`);
  }
});
