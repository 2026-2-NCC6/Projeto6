import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { FiltroTreinos } from './armazenamento.js';
import { criarApp, lerOpenapiDoDisco } from './app.js';
import { Memoria } from './memoria.js';
import { senhaAceita } from './seed.js';
import { dutyDe } from './limites.js';

const SEGREDO = 'x'.repeat(48);
const FORTE = { lancador: 153, alimentador: 77 };
let hashDemo = '';

before(async () => {
  hashDemo = await bcrypt.hash('demo1234', 10);
});

type Ctx = {
  base: string;
  memoria: Memoria;
  logs: string[];
  fechar: () => Promise<void>;
};

async function subir(limiteEntrar = 10_000, armazenamento?: Memoria): Promise<Ctx> {
  const memoria = armazenamento ?? new Memoria();
  await memoria.garantirUsuario({
    id: 'u-autor',
    email: 'autor@nockhug.local',
    senhaHash: hashDemo,
    nome: 'Autor Demo',
    papel: 'autor',
    criadoEm: '2026-11-02T12:00:00.000Z',
  });
  await memoria.garantirUsuario({
    id: 'u-praticante',
    email: 'praticante@nockhug.local',
    senhaHash: hashDemo,
    nome: 'Praticante Demo',
    papel: 'praticante',
    criadoEm: '2026-11-02T12:00:01.000Z',
  });
  const logs: string[] = [];
  const app = criarApp({
    armazenamento: memoria,
    jwtSecret: SEGREDO,
    siteOrigem: 'http://127.0.0.1:5173',
    escreverLog: (linha) => logs.push(linha),
    limiteEntrar,
    verificarBanco: async () => {
      throw new Error('SELECT 1 at /tmp/banco.ts');
    },
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const porta = (server.address() as AddressInfo).port;
  return {
    base: `http://127.0.0.1:${porta}`,
    memoria,
    logs,
    fechar: () => new Promise((resolve, reject) => server.close((erro) => (erro ? reject(erro) : resolve()))),
  };
}

type Resposta = { status: number; json: any; texto: string; headers: Headers };

async function pedir(ctx: Ctx, metodo: string, caminho: string, op: { token?: string; corpo?: unknown; bruto?: string; headers?: Record<string, string> } = {}): Promise<Resposta> {
  const headers: Record<string, string> = { ...(op.headers ?? {}) };
  if (op.token) headers.authorization = `Bearer ${op.token}`;
  let body: string | undefined;
  if (op.bruto !== undefined) {
    body = op.bruto;
    headers['content-type'] ??= 'application/json';
  } else if (op.corpo !== undefined) {
    body = JSON.stringify(op.corpo);
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(ctx.base + caminho, { method: metodo, headers, body });
  const texto = await res.text();
  let json: any = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, texto, headers: res.headers };
}

async function entrar(ctx: Ctx, email = 'autor@nockhug.local', senha = 'demo1234') {
  const r = await pedir(ctx, 'POST', '/v1/entrar', { corpo: { email, senha } });
  assert.equal(r.status, 200, r.texto);
  return r.json.token as string;
}

function completo(extra: Record<string, unknown> = {}) {
  return {
    nome: 'Cruzado',
    bolasPorSerie: 10,
    series: 3,
    descansoS: 30,
    velocidade: FORTE,
    categoria: 'personalizado',
    objetivo: 'golpes',
    nivel: 'intermediario',
    licenca: 'uso-academico',
    remuneracao: 'gratuito',
    ...extra,
  };
}

function sessaoDe(id: string, treino: { id: string; nome: string }, xp = 30, extra: Record<string, unknown> = {}) {
  return {
    id,
    treino: {
      id: treino.id,
      nome: treino.nome,
      bolasPorSerie: 10,
      series: 3,
      descansoS: 30,
      padrao: false,
      velocidade: FORTE,
      preset: 'forte',
    },
    inicio: 1_762_100_000_000,
    fim: 1_762_101_800_000,
    transporte: 'ble',
    series: [{ indice: 1, bolas: 10, inicio: 1_762_100_000_000, fim: 1_762_100_060_000, motivo: 'serie_concluida' }],
    comandos: [{ ts: 1_762_100_001_000, origem: 'voz', transcricao: 'Nock, liga', comando: 'ligar', aceito: true, motivo: null, latenciaMs: 400 }],
    encerradaPor: 'concluida',
    xp,
    ...extra,
  };
}

function payload(token: string) {
  return JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'));
}

test('a senha semente exige letra e dígito', () => {
  assert.equal(senhaAceita('demo1234'), true);
  assert.equal(senhaAceita('curta1'), false);
  assert.equal(senhaAceita('semnumero'), false);
  assert.equal(senhaAceita('12345678'), false);
});

test('FR-1, FR-12, log, eu e autenticação', async () => {
  const ctx = await subir();
  try {
    const certo = await pedir(ctx, 'POST', '/v1/entrar', { corpo: { email: 'autor@nockhug.local', senha: 'demo1234' } });
    assert.equal(certo.status, 200);
    assert.equal(certo.headers.get('x-request-id')?.startsWith('req_'), true);
    assert.equal(payload(certo.json.token).papel, 'autor');
    assert.equal(typeof certo.json.expiraEm, 'number');
    assert.deepEqual(certo.json.usuario, { id: 'u-autor', email: 'autor@nockhug.local', nome: 'Autor Demo', papel: 'autor' });
    assert.equal(certo.texto.includes('demo1234'), false);
    assert.equal(ctx.memoria.inspecionar().includes('demo1234'), false);
    assert.equal(ctx.memoria.inspecionar().includes('"$2'), true);

    const errado = await pedir(ctx, 'POST', '/v1/entrar', { corpo: { email: 'autor@nockhug.local', senha: 'VisivelSenha99' } });
    assert.equal(errado.status, 401);
    assert.equal(errado.json.error.code, 'credencial_invalida');
    assert.equal(errado.texto.includes('VisivelSenha99'), false);
    assert.equal(errado.texto.includes('$2'), false);

    const ausente = await pedir(ctx, 'POST', '/v1/entrar', { corpo: { senha: 'demo1234' } });
    assert.equal(ausente.status, 401);
    assert.equal(ausente.json.error.code, 'credencial_invalida');

    const eu = await pedir(ctx, 'GET', '/v1/eu', { token: certo.json.token });
    assert.equal(eu.status, 200);
    assert.equal(eu.json.nome, 'Autor Demo');

    const auditoria = await pedir(ctx, 'GET', '/v1/auditoria', { token: certo.json.token });
    const acoes = auditoria.json.itens.map((item: { acao: string }) => item.acao);
    assert.ok(acoes.includes('entrar'));
    assert.ok(acoes.includes('entrar_falhou'));
    assert.equal(auditoria.texto.includes('VisivelSenha99'), false);
    assert.equal(auditoria.texto.includes('demo1234'), false);
    assert.equal(auditoria.texto.includes('Authorization'), false);

    assert.equal(ctx.logs.some((linha) => linha.includes('VisivelSenha99') || linha.includes('demo1234') || linha.includes('Authorization')), false);
    const linhaLogin = ctx.logs.find((linha) => linha.includes('"/v1/entrar"'));
    assert.ok(linhaLogin);
    const log = JSON.parse(linhaLogin!);
    assert.equal(typeof log.requestId, 'string');
    assert.equal(log.metodo, 'POST');
    assert.equal(log.caminho, '/v1/entrar');
    assert.equal(typeof log.status, 'number');
    assert.equal(typeof log.duracaoMs, 'number');

    const sem = await pedir(ctx, 'POST', '/v1/treinos', { corpo: { nome: 'X' } });
    assert.equal(sem.status, 401);
    assert.equal(sem.json.error.code, 'nao_autenticado');

    const expirado = jwt.sign({ sub: 'u-autor', papel: 'autor', email: 'autor@nockhug.local' }, SEGREDO, { algorithm: 'HS256', expiresIn: -10 });
    const ruim = jwt.sign({ sub: 'u-autor', papel: 'autor', email: 'autor@nockhug.local' }, 'y'.repeat(48), { algorithm: 'HS256' });
    const a = await pedir(ctx, 'GET', '/v1/eu', { token: expirado });
    const b = await pedir(ctx, 'GET', '/v1/eu', { token: ruim });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.json.error.code, 'nao_autenticado');
    assert.equal(a.json.error.message, b.json.error.message);
    assert.equal(/expir|assinatura/i.test(a.json.error.message), false);

    const quebrado = await pedir(ctx, 'POST', '/v1/entrar', { bruto: '{', headers: {} });
    assert.equal(quebrado.status, 400);
    assert.equal(quebrado.json.error.code, 'pedido_invalido');
    assert.equal(quebrado.texto.includes('at '), false);
    assert.equal(quebrado.texto.includes('SELECT'), false);
  } finally {
    await ctx.fechar();
  }
});

test('FR-2 a FR-5, catálogo, revisão e validação de treino', async () => {
  const ctx = await subir();
  try {
    const autor = await entrar(ctx);
    const praticante = await entrar(ctx, 'praticante@nockhug.local');
    const proibido = await pedir(ctx, 'POST', '/v1/treinos', { token: praticante, corpo: { nome: 'Nao' } });
    assert.equal(proibido.status, 403);
    assert.equal(proibido.json.error.code, 'proibido');

    const vazio = await pedir(ctx, 'POST', '/v1/treinos', { token: autor, corpo: { nome: '   ' } });
    assert.equal(vazio.status, 422);
    assert.ok(vazio.json.error.details.campos.nome);
    const rascunhosVazios = await pedir(ctx, 'GET', '/v1/treinos?status=rascunho', { token: autor });
    assert.equal(rascunhosVazios.json.itens.length, 0);

    const minimo = await pedir(ctx, 'POST', '/v1/treinos', {
      token: autor,
      corpo: { nome: 'Cruzado', bolasPorSerie: 10, series: 3, descansoS: 30 },
    });
    assert.equal(minimo.status, 201);
    assert.equal(minimo.json.status, 'rascunho');
    assert.equal(minimo.json.versao, 0);
    assert.match(minimo.headers.get('location') ?? '', /^\/v1\/treinos\/pub-[0-9a-f]{12}$/);
    assert.match(minimo.json.id, /^pub-[0-9a-f]{12}$/);

    const semVelocidade = await pedir(ctx, 'POST', `/v1/treinos/${minimo.json.id}/publicar`, { token: autor, headers: { 'if-match': '"0"' } });
    assert.equal(semVelocidade.status, 422);
    assert.ok(semVelocidade.json.error.details.campos.velocidade);
    const catalogoVazio = await pedir(ctx, 'GET', '/v1/treinos?status=publicado');
    assert.equal(catalogoVazio.json.itens.some((item: { id: string }) => item.id === minimo.json.id), false);
    assert.equal(catalogoVazio.headers.get('cache-control'), 'no-store');

    for (const id of ['aquecimento', 'resistencia', 'livre']) {
      const reservado = await pedir(ctx, 'POST', '/v1/treinos', { token: autor, corpo: { nome: 'X', id } });
      assert.equal(reservado.status, 422);
      assert.equal(reservado.json.error.code, 'id_reservado');
    }

    const criado = await pedir(ctx, 'POST', '/v1/treinos', { token: autor, corpo: completo() });
    assert.equal(criado.status, 201);
    const id = criado.json.id as string;
    const publicado = await pedir(ctx, 'POST', `/v1/treinos/${id}/publicar`, { token: autor, headers: { 'if-match': '"0"' } });
    assert.equal(publicado.status, 200);
    assert.equal(publicado.json.status, 'publicado');
    assert.equal(publicado.json.versao, 1);
    assert.equal(publicado.json.remuneracao, 'gratuito');
    assert.deepEqual(publicado.json.velocidade, FORTE);
    const catalogo = await pedir(ctx, 'GET', '/v1/treinos?status=publicado');
    assert.equal(catalogo.json.itens.some((item: { id: string }) => item.id === id), true);
    assert.equal(catalogo.json.itens.some((item: { id: string }) => item.id === minimo.json.id), false);

    const semMatch = await pedir(ctx, 'PATCH', `/v1/treinos/${id}`, { token: autor, corpo: { nome: 'Outro' } });
    assert.equal(semMatch.status, 409);
    assert.equal(semMatch.json.error.code, 'versao_conflito');
    assert.equal(semMatch.json.error.details.versaoAtual, 1);
    const direto = await pedir(ctx, 'PATCH', `/v1/treinos/${id}`, { token: autor, corpo: { nome: 'Outro' }, headers: { 'if-match': '"1"' } });
    assert.equal(direto.status, 409);
    assert.equal(direto.json.error.code, 'treino_publicado');

    const revisao = await pedir(ctx, 'POST', `/v1/treinos/${id}/revisoes`, { token: autor });
    assert.equal(revisao.status, 201);
    assert.equal(revisao.json.status, 'rascunho');
    const publicoDurante = await pedir(ctx, 'GET', `/v1/treinos/${id}`);
    assert.equal(publicoDurante.json.nome, 'Cruzado');
    const editado = await pedir(ctx, 'PATCH', `/v1/treinos/${id}`, { token: autor, corpo: { nome: 'Cruzado novo' }, headers: { 'if-match': '"1"' } });
    assert.equal(editado.status, 200);
    const aindaAntigo = await pedir(ctx, 'GET', '/v1/treinos?status=publicado');
    assert.equal(aindaAntigo.json.itens.find((item: { id: string }) => item.id === id).nome, 'Cruzado');
    const deNovo = await pedir(ctx, 'POST', `/v1/treinos/${id}/publicar`, { token: autor, headers: { 'if-match': '"1"' } });
    assert.equal(deNovo.status, 200);
    assert.equal(deNovo.json.versao, 2);
    assert.equal(deNovo.json.nome, 'Cruzado novo');
    const versao1 = await pedir(ctx, 'GET', `/v1/treinos/${id}/versoes/1`);
    assert.equal(versao1.json.nome, 'Cruzado');
    const segundaPublicacao = await pedir(ctx, 'POST', `/v1/treinos/${id}/publicar`, { token: autor, headers: { 'if-match': '"2"' } });
    assert.equal(segundaPublicacao.status, 409);
    assert.equal(segundaPublicacao.json.error.code, 'ja_publicado');
    const revisaoDupla = await pedir(ctx, 'POST', `/v1/treinos/${id}/revisoes`, { token: autor });
    assert.equal(revisaoDupla.status, 201);
    const aberta = await pedir(ctx, 'POST', `/v1/treinos/${id}/revisoes`, { token: autor });
    assert.equal(aberta.status, 409);
    assert.equal(aberta.json.error.code, 'revisao_aberta');

    await ctx.memoria.garantirUsuario({
      id: 'u-autor-2',
      email: 'autor2@nockhug.local',
      senhaHash: hashDemo,
      nome: 'Autor Dois',
      papel: 'autor',
      criadoEm: '2026-11-02T12:00:02.000Z',
    });
    const outro = await entrar(ctx, 'autor2@nockhug.local');
    const alheio = await pedir(ctx, 'GET', `/v1/treinos/${minimo.json.id}`, { token: outro });
    assert.equal(alheio.status, 404);
    assert.equal(alheio.json.error.code, 'nao_encontrado');
    const sumiu = await pedir(ctx, 'GET', '/v1/treinos/pub-000000000000');
    assert.equal(sumiu.status, 404);

    for (const corpo of [
      completo({ bolasPorSerie: 4 }),
      completo({ bolasPorSerie: 61 }),
      completo({ bolasPorSerie: 10.5 }),
      completo({ descansoS: 9 }),
      completo({ bolasPorSerie: 0, series: 3, descansoS: 0 }),
      completo({ velocidade: { lancador: dutyDe(60), alimentador: dutyDe(10) } }),
      completo({ velocidade: { lancador: dutyDe(60), alimentador: dutyDe(50) } }),
    ]) {
      const ruim = await pedir(ctx, 'POST', '/v1/treinos', { token: autor, corpo });
      assert.equal(ruim.status, 422, JSON.stringify(corpo));
    }
    const livre = await pedir(ctx, 'POST', '/v1/treinos', { token: autor, corpo: completo({ nome: 'Livre', bolasPorSerie: 0, series: 0, descansoS: 0, categoria: 'livre' }) });
    assert.equal(livre.status, 201);
    const livrePublicado = await pedir(ctx, 'POST', `/v1/treinos/${livre.json.id}/publicar`, { token: autor, headers: { 'if-match': '"0"' } });
    assert.equal(livrePublicado.status, 200);
    assert.equal(livrePublicado.json.series, 0);
    assert.equal(livrePublicado.json.descansoS, 0);
    assert.equal(livrePublicado.json.duracaoEstimadaMin, 0);
  } finally {
    await ctx.fechar();
  }
});

test('FR-4 paginação do catálogo', async () => {
  const ctx = await subir();
  try {
    const autor = await entrar(ctx);
    const ids: string[] = [];
    for (const nome of ['Um', 'Dois', 'Tres']) {
      const criado = await pedir(ctx, 'POST', '/v1/treinos', { token: autor, corpo: completo({ nome }) });
      const publicado = await pedir(ctx, 'POST', `/v1/treinos/${criado.json.id}/publicar`, { token: autor, headers: { 'if-match': '"0"' } });
      assert.equal(publicado.status, 200);
      ids.push(criado.json.id);
    }
    const primeira = await pedir(ctx, 'GET', '/v1/treinos?status=publicado&limit=2');
    assert.equal(primeira.json.itens.length, 2);
    assert.equal(typeof primeira.json.proximoCursor, 'string');
    const segunda = await pedir(ctx, 'GET', `/v1/treinos?status=publicado&limit=2&cursor=${encodeURIComponent(primeira.json.proximoCursor)}`);
    assert.equal(segunda.json.itens.length, 1);
    assert.equal(segunda.json.proximoCursor, null);
    const vistos = [...primeira.json.itens, ...segunda.json.itens].map((item: { id: string }) => item.id);
    assert.deepEqual(vistos.slice().sort(), ids.slice().sort());
    assert.equal(new Set(vistos).size, 3);
  } finally {
    await ctx.fechar();
  }
});

test('FR-7 e FR-8 sessões idempotentes e visibilidade', async () => {
  const ctx = await subir();
  try {
    const autor = await entrar(ctx);
    const a = await entrar(ctx, 'praticante@nockhug.local');
    await ctx.memoria.garantirUsuario({
      id: 'u-b',
      email: 'b@nockhug.local',
      senhaHash: hashDemo,
      nome: 'Praticante B',
      papel: 'praticante',
      criadoEm: '2026-11-02T12:00:03.000Z',
    });
    const b = await entrar(ctx, 'b@nockhug.local');
    const criado = await pedir(ctx, 'POST', '/v1/treinos', { token: autor, corpo: completo() });
    await pedir(ctx, 'POST', `/v1/treinos/${criado.json.id}/publicar`, { token: autor, headers: { 'if-match': '"0"' } });
    const treino = { id: criado.json.id as string, nome: 'Cruzado' };
    const corpo = sessaoDe('s-demo-1', treino, 30, { ruido: true });
    const primeira = await pedir(ctx, 'POST', '/v1/sessoes', { token: a, corpo, headers: { 'idempotency-key': 's-demo-1' } });
    assert.equal(primeira.status, 201);
    assert.equal(primeira.json.id, 's-demo-1');
    assert.equal(typeof primeira.json.recebidaEm, 'string');
    assert.equal('ruido' in primeira.json, false);
    const segunda = await pedir(ctx, 'POST', '/v1/sessoes', { token: a, corpo: sessaoDe('s-demo-1', treino, 30) });
    assert.equal(segunda.status, 200);
    assert.equal(segunda.json.id, 's-demo-1');
    const conflito = await pedir(ctx, 'POST', '/v1/sessoes', { token: a, corpo: sessaoDe('s-demo-1', treino, 31) });
    assert.equal(conflito.status, 409);
    assert.equal(conflito.json.error.code, 'sessao_conflito');
    const lida = await pedir(ctx, 'GET', '/v1/sessoes/s-demo-1', { token: a });
    assert.equal(lida.json.xp, 30);

    const doB = await pedir(ctx, 'POST', '/v1/sessoes', { token: b, corpo: sessaoDe('s-demo-b', treino, 12) });
    assert.equal(doB.status, 201);
    const todas = await pedir(ctx, 'GET', '/v1/sessoes', { token: autor });
    assert.equal(todas.json.itens.length, 2);
    const soA = await pedir(ctx, 'GET', '/v1/sessoes', { token: a });
    assert.equal(soA.json.itens.length, 1);
    const alheia = await pedir(ctx, 'GET', '/v1/sessoes/s-demo-b', { token: a });
    assert.equal(alheia.status, 404);
    assert.equal(alheia.json.error.code, 'nao_encontrado');
    const autorVe = await pedir(ctx, 'GET', '/v1/sessoes/s-demo-b', { token: autor });
    assert.equal(autorVe.status, 200);

    const chave = await pedir(ctx, 'POST', '/v1/sessoes', { token: a, corpo: sessaoDe('s-outra', treino), headers: { 'idempotency-key': 'diferente' } });
    assert.equal(chave.status, 400);
    assert.equal(chave.json.error.code, 'pedido_invalido');
    const fim = await pedir(ctx, 'POST', '/v1/sessoes', { token: a, corpo: sessaoDe('s-fim', treino, 1, { fim: 1 }) });
    assert.equal(fim.status, 422);
    const negativa = await pedir(ctx, 'POST', '/v1/sessoes', { token: a, corpo: sessaoDe('s-xp', treino, -1) });
    assert.equal(negativa.status, 422);
    const alta = await pedir(ctx, 'POST', '/v1/sessoes', { token: a, corpo: sessaoDe('s-xp2', treino, 100_001) });
    assert.equal(alta.status, 422);

    const series = Array.from({ length: 31 }, (_, i) => ({ indice: i + 1, bolas: 1, inicio: 10, fim: 20, motivo: 'serie_concluida' }));
    const muitasSeries = await pedir(ctx, 'POST', '/v1/sessoes', { token: a, corpo: sessaoDe('s-series', treino, 1, { series }) });
    assert.equal(muitasSeries.status, 422);
    const comandos = Array.from({ length: 501 }, (_, i) => ({ ts: i, origem: 'botao', transcricao: '', comando: 'ligar', aceito: true, motivo: null, latenciaMs: null }));
    const muitos = await pedir(ctx, 'POST', '/v1/sessoes', { token: a, corpo: sessaoDe('s-cmd', treino, 1, { comandos }) });
    assert.equal(muitos.status, 422);

    const semToken = await pedir(ctx, 'GET', '/v1/sessoes');
    assert.equal(semToken.status, 401);
    assert.equal(semToken.json.error.code, 'nao_autenticado');
  } finally {
    await ctx.fechar();
  }
});

test('limites de corpo, login e saúde', async () => {
  const ctx = await subir(30);
  try {
    let toques = 0;
    const memoria = ctx.memoria;
    const original = memoria.listarTreinos.bind(memoria);
    memoria.listarTreinos = async (f: FiltroTreinos) => {
      toques += 1;
      if (f.status === 'publicado' && toques === 1) throw new Error('SELECT segredo at /app/src/x.ts:10');
      return original(f);
    };
    const interno = await pedir(ctx, 'GET', '/v1/treinos?status=publicado');
    assert.equal(interno.status, 500);
    assert.equal(interno.json.error.code, 'erro_interno');
    assert.equal(interno.texto.includes('SELECT'), false);
    assert.equal(interno.texto.includes('at '), false);

    const saude = await pedir(ctx, 'GET', '/v1/saude');
    assert.equal(saude.status, 200);
    assert.deepEqual(saude.json, { status: 'ok' });
    const banco = await pedir(ctx, 'GET', '/v1/saude/banco');
    assert.equal(banco.status, 503);
    assert.equal(banco.json.error.code, 'banco_indisponivel');
    assert.equal(banco.headers.get('retry-after'), '30');

    const yaml = await pedir(ctx, 'GET', '/v1/openapi.yaml');
    assert.equal(yaml.status, 200);
    assert.match(yaml.headers.get('content-type') ?? '', /yaml/);
    assert.equal(yaml.texto, lerOpenapiDoDisco());

    const grande = await pedir(ctx, 'POST', '/v1/entrar', { bruto: JSON.stringify({ email: 'a'.repeat(300_000), senha: 'x' }) });
    assert.equal(grande.status, 413);

    let ultimo = 0;
    for (let i = 0; i < 31; i += 1) {
      const r = await pedir(ctx, 'POST', '/v1/entrar', { corpo: { email: 'autor@nockhug.local', senha: 'errada123' } });
      ultimo = r.status;
      if (i < 30) assert.equal(r.status, 401);
      else {
        assert.equal(r.status, 429);
        assert.equal(r.json.error.code, 'limite_excedido');
        assert.ok(r.headers.get('retry-after'));
      }
    }
    assert.equal(ultimo, 429);

    const usuarios = await entrar(ctx, 'autor@nockhug.local').catch(() => '');
    assert.equal(usuarios, '');
  } finally {
    await ctx.fechar();
  }
});

test('produção recusa JWT_SECRET curto e o rascunho sem login não vaza', async () => {
  assert.throws(() => criarApp({
    armazenamento: new Memoria(),
    jwtSecret: 'curto',
    siteOrigem: 'http://127.0.0.1:5173',
    producao: true,
    escreverLog: () => undefined,
  }));
  const ctx = await subir();
  try {
    const autor = await entrar(ctx);
    await pedir(ctx, 'POST', '/v1/treinos', { token: autor, corpo: { nome: 'Secreto' } });
    const publico = await pedir(ctx, 'GET', '/v1/treinos?status=rascunho');
    assert.equal(publico.status, 401);
    const estranho = await pedir(ctx, 'GET', '/v1/treinos?status=qualquer');
    assert.equal(estranho.status, 400);
    const usuarios = await pedir(ctx, 'GET', '/v1/usuarios', { token: autor });
    assert.equal(usuarios.status, 200);
    assert.equal(usuarios.texto.includes('senhaHash'), false);
    assert.equal(usuarios.texto.includes('demo1234'), false);
    assert.equal(usuarios.texto.includes('$2'), false);
  } finally {
    await ctx.fechar();
  }
});
