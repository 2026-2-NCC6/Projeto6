import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { velocidadeDoPreset } from './limites.js';

test('contrato do Azure SQL', async (t) => {
  if (!process.env.SQL_SERVER) {
    t.skip('SQL_SERVER não definido');
    return;
  }
  const { criarAzureSql } = await import('./azureSql.js');
  const arm = criarAzureSql();
  const id = `pub-${randomBytes(6).toString('hex')}`;
  const agora = new Date().toISOString();
  const base = {
    id,
    nome: 'Contrato',
    bolasPorSerie: 10,
    series: 3,
    descansoS: 30,
    padrao: false as const,
    velocidade: velocidadeDoPreset('forte'),
    categoria: 'personalizado' as const,
    objetivo: 'golpes' as const,
    nivel: 'intermediario' as const,
    licenca: 'uso-academico' as const,
    remuneracao: 'gratuito' as const,
    status: 'rascunho' as const,
    versao: 0,
    atualizadoEm: agora,
  };
  await arm.inserirTreino({ id, autorId: 'u-contrato', status: 'rascunho', versao: 0, doc: base, atualizadoEm: agora });
  const publicado = await arm.publicar(id, 0);
  assert.equal(publicado.versao, 1);
  assert.equal(publicado.nome, 'Contrato');
  const revisao = await arm.abrirRevisao(id);
  assert.equal(revisao.status, 'rascunho');
  const catalogoAntes = await arm.listarTreinos({ status: 'publicado', limit: 50, cursor: null });
  assert.equal(catalogoAntes.itens.find((item) => item.id === id)?.nome, 'Contrato');
  await arm.atualizarRascunho(id, { nome: 'Contrato novo' }, 1);
  const antigo = await arm.obterVersao(id, 1);
  assert.equal(antigo?.nome, 'Contrato');
  const deNovo = await arm.publicar(id, 1);
  assert.equal(deNovo.versao, 2);
  assert.equal(deNovo.nome, 'Contrato novo');

  const sessaoId = `s-${randomBytes(4).toString('hex')}`;
  const sessao = {
    id: sessaoId,
    treino: { id, nome: 'Contrato novo', bolasPorSerie: 10, series: 3, descansoS: 30, padrao: false, velocidade: velocidadeDoPreset('forte') },
    inicio: 1762100000000,
    fim: 1762101800000,
    transporte: 'simulada' as const,
    series: [{ indice: 1, bolas: 10, inicio: 1762100000000, fim: 1762100060000, motivo: 'serie_concluida' as const }],
    comandos: [],
    encerradaPor: 'concluida' as const,
    xp: 30,
  };
  assert.equal(await arm.inserirSessao(sessao, 'u-praticante'), 'criada');
  assert.equal(await arm.inserirSessao(sessao, 'u-praticante'), 'repetida');
  assert.equal(await arm.inserirSessao({ ...sessao, xp: 31 }, 'u-praticante'), 'conflito');
  assert.equal((await arm.obterSessao(sessaoId))?.xp, 30);
});
