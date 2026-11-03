const api = process.env.API_URL?.replace(/\/$/, '');
if (!api) {
  console.log('fumaça ignorada');
  process.exit(0);
}

const site = process.env.SITE_URL ?? '';
const senhaAutor = process.env.SEED_AUTOR_SENHA ?? '';
const senhaPraticante = process.env.SEED_PRATICANTE_SENHA ?? '';
if (!senhaAutor || !senhaPraticante) {
  console.error('Defina SEED_AUTOR_SENHA e SEED_PRATICANTE_SENHA no ambiente.');
  process.exit(1);
}

async function json(caminho, opcoes = {}) {
  const { method = 'GET', corpo, headers = {} } = opcoes;
  const resposta = await fetch(`${api}${caminho}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  const lido = texto ? JSON.parse(texto) : null;
  if (!resposta.ok) throw new Error(`${resposta.status} ${caminho} ${texto}`);
  return lido;
}

const nome = `fumaça-${Date.now()}`;
await json('/v1/saude');
const autor = await json('/v1/entrar', { method: 'POST', corpo: { email: 'autor@nockhug.local', senha: senhaAutor } });
const praticante = await json('/v1/entrar', { method: 'POST', corpo: { email: 'praticante@nockhug.local', senha: senhaPraticante } });
const treino = await json('/v1/treinos', {
  method: 'POST',
  headers: { authorization: `Bearer ${autor.token}` },
  corpo: {
    nome,
    bolasPorSerie: 10,
    series: 1,
    descansoS: 10,
    velocidade: { lancador: 153, alimentador: 77 },
    categoria: 'personalizado',
    objetivo: 'golpes',
    nivel: 'intermediario',
    licenca: 'uso-academico',
    remuneracao: 'gratuito',
  },
});
await json(`/v1/treinos/${treino.id}/publicar`, {
  method: 'POST',
  headers: { authorization: `Bearer ${autor.token}`, 'if-match': '"0"' },
});
const sessaoId = `s-${Date.now()}`;
await json('/v1/sessoes', {
  method: 'POST',
  headers: { authorization: `Bearer ${praticante.token}` },
  corpo: {
    id: sessaoId,
    treino: { id: treino.id, nome, bolasPorSerie: 10, series: 1, descansoS: 10, padrao: false, velocidade: { lancador: 153, alimentador: 77 } },
    inicio: Date.now() - 1000,
    fim: Date.now(),
    transporte: 'simulada',
    series: [{ indice: 1, bolas: 1, inicio: Date.now() - 1000, fim: Date.now(), motivo: 'serie_concluida' }],
    comandos: [],
    encerradaPor: 'concluida',
    xp: 21,
  },
});
const lida = await json(`/v1/sessoes/${sessaoId}`, { headers: { authorization: `Bearer ${autor.token}` } });
if (lida.treino?.nome !== nome) throw new Error('A sessão lida não é a da fumaça.');
console.log(JSON.stringify({ ok: true, nome, sessaoId, site }));
