import type { Express, NextFunction, Request, Response } from 'express';
import type { Armazenamento, Papel, SessaoResposta, TreinoRegistro } from './armazenamento.js';
import { exigirUsuario, hashFalso, ipDe, lerToken, LimiteEntrar, senhaConfere, emitirToken, type UsuarioToken } from './auth.js';
import { decodificarCursor } from './cursor.js';
import { falha } from './erros.js';
import { CATEGORIAS, NIVEIS, OBJETIVOS } from './limites.js';
import {
  documentoPublicado,
  enumQuery,
  lerLimite,
  validarCorpoObjeto,
  validarNovoTreino,
  validarPatch,
  validarSessao,
} from './validar.js';

export const ROTAS: { metodo: string; caminho: string }[] = [
  { metodo: 'POST', caminho: '/v1/entrar' },
  { metodo: 'GET', caminho: '/v1/eu' },
  { metodo: 'GET', caminho: '/v1/treinos' },
  { metodo: 'POST', caminho: '/v1/treinos' },
  { metodo: 'GET', caminho: '/v1/treinos/:id' },
  { metodo: 'PATCH', caminho: '/v1/treinos/:id' },
  { metodo: 'POST', caminho: '/v1/treinos/:id/revisoes' },
  { metodo: 'POST', caminho: '/v1/treinos/:id/publicar' },
  { metodo: 'GET', caminho: '/v1/treinos/:id/versoes' },
  { metodo: 'GET', caminho: '/v1/treinos/:id/versoes/:versao' },
  { metodo: 'POST', caminho: '/v1/sessoes' },
  { metodo: 'GET', caminho: '/v1/sessoes' },
  { metodo: 'GET', caminho: '/v1/sessoes/:id' },
  { metodo: 'GET', caminho: '/v1/usuarios' },
  { metodo: 'GET', caminho: '/v1/auditoria' },
  { metodo: 'GET', caminho: '/v1/saude' },
  { metodo: 'GET', caminho: '/v1/saude/banco' },
  { metodo: 'GET', caminho: '/v1/openapi.yaml' },
];

export type Dependencias = {
  armazenamento: Armazenamento;
  jwtSecret: string;
  limite: LimiteEntrar;
  verificarBanco: () => Promise<void>;
  lerOpenapi: () => string;
};

function h(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

function textoQuery(valor: unknown, nome: string): string | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') throw falha(400, 'pedido_invalido', `${nome} é inválido.`);
  return valor;
}

function cursorDe(valor: unknown) {
  const texto = textoQuery(valor, 'cursor');
  if (!texto) return null;
  const cursor = decodificarCursor(texto);
  if (!cursor) throw falha(400, 'pedido_invalido', 'O cursor é inválido.');
  return cursor;
}

function inteiroQuery(valor: unknown, nome: string): number | undefined {
  const texto = textoQuery(valor, nome);
  if (texto === undefined) return undefined;
  if (!/^-?\d+$/.test(texto)) throw falha(400, 'pedido_invalido', `${nome} é inválido.`);
  return Number(texto);
}

function ifMatch(req: Request): string | null {
  const bruto = req.header('if-match');
  if (bruto === undefined) return null;
  const limpo = bruto.trim().replace(/^W\//, '').replaceAll('"', '');
  return limpo.length ? limpo : null;
}

function exigirVersao(req: Request, versao: number): void {
  const enviado = ifMatch(req);
  if (enviado === null || enviado !== String(versao)) {
    throw falha(409, 'versao_conflito', 'A versão enviada não é a atual.', { versaoAtual: versao });
  }
}

export function registrarRotas(app: Express, deps: Dependencias): void {
  const arm = deps.armazenamento;

  const autenticar = (req: Request, papeis?: Papel[]): UsuarioToken => {
    const usuario = exigirUsuario(req, deps.jwtSecret, papeis);
    req.usuario = usuario;
    return usuario;
  };

  const opcional = (req: Request): UsuarioToken | null => {
    if (!req.header('authorization')) return null;
    const usuario = lerToken(req, deps.jwtSecret);
    if (!usuario) throw falha(401, 'nao_autenticado', 'Autenticação necessária.');
    req.usuario = usuario;
    return usuario;
  };

  const auditar = (req: Request, atorId: string | null, acao: string, recurso: string) =>
    arm.registrarAuditoria({ atorId, acao, recurso: recurso.slice(0, 80), requestId: req.requestId.slice(0, 40) });

  const dono = async (id: string, usuario: UsuarioToken): Promise<TreinoRegistro> => {
    const registro = await arm.obterTreino(id);
    if (!registro || registro.autorId !== usuario.id) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    return registro;
  };

  app.post('/v1/entrar', h(async (req, res) => {
    const limite = deps.limite.tentar(ipDe(req));
    if (!limite.ok) {
      res.set('Retry-After', String(limite.retryAfter));
      throw falha(429, 'limite_excedido', 'Muitas tentativas de entrada. Espere e tente de novo.');
    }
    const json = validarCorpoObjeto(req.body);
    const email = typeof json.email === 'string' ? json.email.trim().toLowerCase() : '';
    const senha = typeof json.senha === 'string' ? json.senha : '';
    const usuario = email ? await arm.buscarUsuarioPorEmail(email) : null;
    const confere = await senhaConfere(senha, usuario?.senhaHash ?? await hashFalso());
    if (!email || !senha || !usuario || !confere) {
      await auditar(req, usuario?.id ?? null, 'entrar_falhou', 'usuarios');
      throw falha(401, 'credencial_invalida', 'E-mail ou senha não conferem.');
    }
    const emitido = emitirToken(usuario, deps.jwtSecret);
    req.usuario = { id: usuario.id, email: usuario.email, papel: usuario.papel };
    await auditar(req, usuario.id, 'entrar', `usuarios/${usuario.id}`);
    res.json({ token: emitido.token, expiraEm: emitido.expiraEm, usuario: emitido.usuario });
  }));

  app.get('/v1/eu', h(async (req, res) => {
    const token = autenticar(req);
    const usuario = await arm.buscarUsuarioPorEmail(token.email);
    if (!usuario || usuario.id !== token.id) throw falha(401, 'nao_autenticado', 'Autenticação necessária.');
    res.json({ id: usuario.id, email: usuario.email, nome: usuario.nome, papel: usuario.papel });
  }));

  app.get('/v1/treinos', h(async (req, res) => {
    const usuario = opcional(req);
    const status = textoQuery(req.query.status, 'status');
    if (status === 'rascunho') {
      if (!usuario) throw falha(401, 'nao_autenticado', 'Autenticação necessária.');
      if (usuario.papel !== 'autor') throw falha(403, 'proibido', 'Você não pode fazer isso.');
    } else if (status !== 'publicado') {
      throw falha(400, 'pedido_invalido', 'Informe status=publicado.');
    }
    const pagina = await arm.listarTreinos({
      status: status === 'rascunho' ? 'rascunho' : 'publicado',
      autorId: status === 'rascunho' ? usuario?.id : undefined,
      objetivo: enumQuery(req.query.objetivo, OBJETIVOS, 'objetivo'),
      nivel: enumQuery(req.query.nivel, NIVEIS, 'nivel'),
      categoria: enumQuery(req.query.categoria, CATEGORIAS, 'categoria'),
      limit: lerLimite(req.query.limit),
      cursor: cursorDe(req.query.cursor),
    });
    res.json(pagina);
  }));

  app.post('/v1/treinos', h(async (req, res) => {
    const usuario = autenticar(req, ['autor']);
    const { id, doc } = validarNovoTreino(req.body, new Date().toISOString());
    await arm.inserirTreino({ id, autorId: usuario.id, status: 'rascunho', versao: 0, doc, atualizadoEm: doc.atualizadoEm });
    await auditar(req, usuario.id, 'treino_criado', `treinos/${id}`);
    res.status(201).set('Location', `/v1/treinos/${id}`).json(doc);
  }));

  app.get('/v1/treinos/:id/versoes/:versao', h(async (req, res) => {
    opcional(req);
    const versao = Number(req.params.versao);
    if (!Number.isInteger(versao)) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    const doc = await arm.obterVersao(req.params.id, versao);
    if (!doc) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    res.json(doc);
  }));

  app.get('/v1/treinos/:id/versoes', h(async (req, res) => {
    opcional(req);
    const itens = await arm.listarVersoes(req.params.id);
    if (itens.length === 0) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    res.json({ itens });
  }));

  app.post('/v1/treinos/:id/revisoes', h(async (req, res) => {
    const usuario = autenticar(req, ['autor']);
    await dono(req.params.id, usuario);
    const doc = await arm.abrirRevisao(req.params.id);
    await auditar(req, usuario.id, 'revisao_aberta', `treinos/${req.params.id}`);
    res.status(201).json(doc);
  }));

  app.post('/v1/treinos/:id/publicar', h(async (req, res) => {
    const usuario = autenticar(req, ['autor']);
    const registro = await dono(req.params.id, usuario);
    exigirVersao(req, registro.versao);
    if (registro.status !== 'rascunho') throw falha(409, 'ja_publicado', 'Este treino já está publicado.');
    documentoPublicado(registro.doc, new Date().toISOString());
    const doc = await arm.publicar(req.params.id, registro.versao);
    await auditar(req, usuario.id, 'treino_publicado', `treinos/${req.params.id}`);
    res.json(doc);
  }));

  app.patch('/v1/treinos/:id', h(async (req, res) => {
    const usuario = autenticar(req, ['autor']);
    const registro = await dono(req.params.id, usuario);
    exigirVersao(req, registro.versao);
    if (registro.status !== 'rascunho') throw falha(409, 'treino_publicado', 'Treino publicado não se edita direto. Abra uma revisão.');
    const patch = validarPatch(req.body);
    const doc = await arm.atualizarRascunho(req.params.id, patch, registro.versao);
    await auditar(req, usuario.id, 'treino_editado', `treinos/${req.params.id}`);
    res.json(doc);
  }));

  app.get('/v1/treinos/:id', h(async (req, res) => {
    const usuario = opcional(req);
    const registro = await arm.obterTreino(req.params.id);
    if (!registro) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    const ehDono = usuario?.papel === 'autor' && usuario.id === registro.autorId;
    if (registro.status === 'rascunho' && ehDono) {
      res.json(registro.doc);
      return;
    }
    const versoes = await arm.listarVersoes(req.params.id);
    const ultima = versoes[0];
    if (!ultima) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    const doc = await arm.obterVersao(req.params.id, ultima.versao);
    if (!doc) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    res.json(doc);
  }));

  app.post('/v1/sessoes', h(async (req, res) => {
    const usuario = autenticar(req, ['praticante']);
    const sessao = validarSessao(req.body);
    const chave = req.header('idempotency-key');
    if (chave !== undefined && chave !== sessao.id) {
      throw falha(400, 'pedido_invalido', 'Idempotency-Key diferente do id da sessão.');
    }
    const resultado = await arm.inserirSessao(sessao, usuario.id);
    if (resultado === 'conflito') throw falha(409, 'sessao_conflito', 'Esta sessão já foi recebida com outro conteúdo.');
    if (resultado === 'criada') await auditar(req, usuario.id, 'sessao_recebida', `sessoes/${sessao.id}`);
    const gravada = await arm.obterSessao(sessao.id);
    if (!gravada) throw falha(500, 'erro_interno', 'Erro interno.');
    const { praticanteId: _ignorado, ...corpo } = gravada;
    res.status(resultado === 'criada' ? 201 : 200).json(corpo);
  }));

  app.get('/v1/sessoes', h(async (req, res) => {
    const usuario = autenticar(req);
    const de = inteiroQuery(req.query.de, 'de');
    const ate = inteiroQuery(req.query.ate, 'ate');
    if (de !== undefined && ate !== undefined && de > ate) throw falha(400, 'pedido_invalido', 'O intervalo é inválido.');
    const pagina = await arm.listarSessoes({
      praticanteId: usuario.papel === 'autor' ? undefined : usuario.id,
      treinoId: textoQuery(req.query.treinoId, 'treinoId'),
      de,
      ate,
      limit: lerLimite(req.query.limit),
      cursor: cursorDe(req.query.cursor),
    });
    res.json(pagina);
  }));

  app.get('/v1/sessoes/:id', h(async (req, res) => {
    const usuario = autenticar(req);
    const sessao = await arm.obterSessao(req.params.id);
    if (!sessao) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    if (usuario.papel !== 'autor' && sessao.praticanteId !== usuario.id) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    const { praticanteId: _ignorado, ...corpo } = sessao;
    res.json(corpo satisfies SessaoResposta);
  }));

  app.get('/v1/usuarios', h(async (req, res) => {
    autenticar(req, ['autor']);
    res.json(await arm.listarUsuarios({ limit: lerLimite(req.query.limit), cursor: cursorDe(req.query.cursor) }));
  }));

  app.get('/v1/auditoria', h(async (req, res) => {
    autenticar(req, ['autor']);
    res.json(await arm.listarAuditoria({ limit: lerLimite(req.query.limit), cursor: cursorDe(req.query.cursor) }));
  }));

  app.get('/v1/saude', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/v1/saude/banco', h(async (_req, res) => {
    try {
      await deps.verificarBanco();
      res.json({ status: 'ok' });
    } catch {
      res.set('Retry-After', '30');
      throw falha(503, 'banco_indisponivel', 'O banco não respondeu.');
    }
  }));

  app.get('/v1/openapi.yaml', (_req, res) => {
    res.status(200).type('text/yaml; charset=utf-8').send(deps.lerOpenapi());
  });
}
