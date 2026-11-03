import { DefaultAzureCredential } from '@azure/identity';
import sql, { type ConnectionPool, type Request, type config as ConfigSql } from 'mssql';
import type {
  Armazenamento,
  AuditoriaItem,
  FiltroSessoes,
  FiltroTreinos,
  Pagina,
  PatchTreino,
  SessaoDoc,
  SessaoResposta,
  TreinoDoc,
  TreinoRegistro,
  UsuarioInterno,
  UsuarioPublico,
  UsuarioSemente,
} from './armazenamento.js';
import { canonico } from './canonico.js';
import { codificarCursor, type Cursor } from './cursor.js';
import { ErroHttp, falha } from './erros.js';
import { aplicarPatch, documentoPublicado, validarRascunhoResultante } from './validar.js';

const TRANSITORIOS = new Set([40613, 40197, 40501, 49918]);

type Linha = Record<string, unknown>;

let poolAtual: ConnectionPool | null = null;
let tokenExpira = 0;

function numeroErro(erro: unknown): number | null {
  const e = erro as { number?: number; originalError?: { info?: { number?: number } } };
  return e.number ?? e.originalError?.info?.number ?? null;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function comRetry<T>(fn: () => Promise<T>): Promise<T> {
  const esperas = [1000, 2000, 4000];
  for (let i = 0; i <= esperas.length; i += 1) {
    try {
      return await fn();
    } catch (erro) {
      if (erro instanceof ErroHttp) throw erro;
      const codigo = numeroErro(erro);
      if (codigo === null || !TRANSITORIOS.has(codigo) || i === esperas.length) throw erro;
      await esperar(esperas[i] ?? 4000);
    }
  }
  throw new Error('retry esgotado');
}

async function obterPool(): Promise<ConnectionPool> {
  if (poolAtual && Date.now() < tokenExpira - 5 * 60 * 1000) return poolAtual;
  if (poolAtual) {
    await poolAtual.close().catch(() => undefined);
    poolAtual = null;
  }
  const servidor = process.env.SQL_SERVER;
  if (!servidor) throw new Error('SQL_SERVER ausente.');
  const credencial = new DefaultAzureCredential();
  const token = await credencial.getToken('https://database.windows.net/.default');
  if (!token?.token) throw new Error('Sem token do Entra ID para o Azure SQL.');
  tokenExpira = token.expiresOnTimestamp;
  const config = {
    server: servidor,
    database: process.env.SQL_DATABASE || 'nockhug',
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token: token.token },
    },
    options: { encrypt: true },
    pool: { max: 5, min: 0 },
    connectionTimeout: 60_000,
    requestTimeout: 30_000,
  } as ConfigSql;
  const criado = new sql.ConnectionPool(config);
  poolAtual = await criado.connect();
  return poolAtual;
}

function pedido(base: ConnectionPool | sql.Transaction): Request {
  if (base instanceof sql.Transaction) return new sql.Request(base);
  return new sql.Request(base);
}

async function consultar(texto: string, preencher: (req: Request) => void): Promise<Linha[]> {
  const resultado = await comRetry(async () => {
    const pool = await obterPool();
    const req = pedido(pool);
    preencher(req);
    return req.query(texto);
  });
  return (resultado.recordset ?? []) as Linha[];
}

function dataIso(valor: unknown): string {
  if (valor instanceof Date) return valor.toISOString();
  return new Date(String(valor)).toISOString();
}

function inteiro(valor: unknown): number {
  return typeof valor === 'number' ? valor : Number(valor);
}

function docTreino(linha: Linha): TreinoDoc {
  const doc = JSON.parse(String(linha.json)) as TreinoDoc;
  if (typeof linha.status === 'string') doc.status = linha.status as TreinoDoc['status'];
  if (linha.versao !== undefined) doc.versao = inteiro(linha.versao);
  if (linha.atualizado_em !== undefined) doc.atualizadoEm = dataIso(linha.atualizado_em);
  return doc;
}

function registroDe(linha: Linha): TreinoRegistro {
  const doc = docTreino(linha);
  return {
    id: String(linha.id),
    autorId: String(linha.autor_id),
    status: String(linha.status) as TreinoRegistro['status'],
    versao: inteiro(linha.versao),
    doc,
    atualizadoEm: dataIso(linha.atualizado_em),
  };
}

function cursorSql(cursor: Cursor | null, colunaTempo: string, colunaId: string): { where: string; bind: (req: Request) => void } {
  if (!cursor) return { where: '1 = 1', bind: () => undefined };
  return {
    where: `(${colunaTempo} < @cursorTempo OR (${colunaTempo} = @cursorTempo AND ${colunaId} < @cursorId))`,
    bind(req) {
      const tempo = typeof cursor.t === 'number' ? new Date(cursor.t) : new Date(cursor.t);
      if (typeof cursor.t === 'number') req.input('cursorTempo', sql.BigInt, cursor.t);
      else req.input('cursorTempo', sql.DateTimeOffset, tempo);
      req.input('cursorId', sql.NVarChar(40), cursor.id);
    },
  };
}

function proxima<T>(linhas: T[], limit: number, chave: (item: T) => Cursor): Pagina<T> {
  const temMais = linhas.length > limit;
  const itens = temMais ? linhas.slice(0, limit) : linhas;
  const ultimo = itens[itens.length - 1];
  return {
    itens,
    proximoCursor: temMais && ultimo ? codificarCursor(chave(ultimo)) : null,
  };
}

async function transacao<T>(fn: (req: () => Request) => Promise<T>): Promise<T> {
  return comRetry(async () => {
    const pool = await obterPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const resultado = await fn(() => pedido(tx));
      await tx.commit();
      return resultado;
    } catch (erro) {
      await tx.rollback().catch(() => undefined);
      throw erro;
    }
  });
}

export async function verificarConexao(): Promise<void> {
  await consultar('SELECT 1 AS ok', () => undefined);
}

export async function executarScript(script: string): Promise<void> {
  await comRetry(async () => {
    const pool = await obterPool();
    await pedido(pool).query(script);
  });
}

export function criarAzureSql(): AzureSql {
  return new AzureSql();
}

class AzureSql implements Armazenamento {
  async garantirUsuario(usuario: UsuarioSemente): Promise<void> {
    await consultar(
      `IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = @email)
       INSERT INTO usuarios (id, email, senha_hash, nome, papel, criado_em)
       VALUES (@id, @email, @hash, @nome, @papel, @criado)`,
      (req) => {
        req.input('id', sql.NVarChar(40), usuario.id);
        req.input('email', sql.NVarChar(200), usuario.email.trim().toLowerCase());
        req.input('hash', sql.NVarChar(200), usuario.senhaHash);
        req.input('nome', sql.NVarChar(80), usuario.nome);
        req.input('papel', sql.NVarChar(20), usuario.papel);
        req.input('criado', sql.DateTimeOffset, new Date(usuario.criadoEm));
      },
    );
  }

  async buscarUsuarioPorEmail(email: string): Promise<UsuarioInterno | null> {
    const linhas = await consultar(
      'SELECT id, email, senha_hash, nome, papel, criado_em FROM usuarios WHERE email = @email',
      (req) => req.input('email', sql.NVarChar(200), email.trim().toLowerCase()),
    );
    const linha = linhas[0];
    if (!linha) return null;
    return {
      id: String(linha.id),
      email: String(linha.email),
      senhaHash: String(linha.senha_hash),
      nome: String(linha.nome),
      papel: linha.papel === 'autor' ? 'autor' : 'praticante',
      criadoEm: dataIso(linha.criado_em),
    };
  }

  async listarUsuarios(f: { limit: number; cursor: Cursor | null }): Promise<Pagina<UsuarioPublico>> {
    const cursor = cursorSql(f.cursor, 'criado_em', 'id');
    const linhas = await consultar(
      `SELECT TOP (@limite) id, email, nome, papel, criado_em FROM usuarios
       WHERE ${cursor.where}
       ORDER BY criado_em DESC, id DESC`,
      (req) => {
        req.input('limite', sql.Int, f.limit + 1);
        cursor.bind(req);
      },
    );
    const pagina = proxima(
      linhas.map((linha) => ({
        id: String(linha.id),
        email: String(linha.email),
        nome: String(linha.nome),
        papel: (linha.papel === 'autor' ? 'autor' : 'praticante') as UsuarioPublico['papel'],
        criadoEm: dataIso(linha.criado_em),
      })),
      f.limit,
      (u) => ({ t: u.criadoEm, id: u.id }),
    );
    return {
      itens: pagina.itens.map(({ id, email, nome, papel }) => ({ id, email, nome, papel })),
      proximoCursor: pagina.proximoCursor,
    };
  }

  async inserirTreino(treino: TreinoRegistro): Promise<void> {
    try {
      await consultar(
        `INSERT INTO treinos (id, autor_id, status, versao, json, atualizado_em)
         VALUES (@id, @autor, @status, @versao, @json, @quando)`,
        (req) => {
          req.input('id', sql.NVarChar(40), treino.id);
          req.input('autor', sql.NVarChar(40), treino.autorId);
          req.input('status', sql.NVarChar(20), treino.status);
          req.input('versao', sql.Int, treino.versao);
          req.input('json', sql.NVarChar(sql.MAX), JSON.stringify(treino.doc));
          req.input('quando', sql.DateTimeOffset, new Date(treino.atualizadoEm));
        },
      );
    } catch (erro) {
      if (numeroErro(erro) === 2627) {
        throw falha(422, 'pedido_invalido', 'Já existe um treino com este id.', { campos: { id: 'Já existe um treino com este id.' } });
      }
      throw erro;
    }
  }

  async obterTreino(id: string): Promise<TreinoRegistro | null> {
    const linhas = await consultar(
      'SELECT id, autor_id, status, versao, json, atualizado_em FROM treinos WHERE id = @id',
      (req) => req.input('id', sql.NVarChar(40), id),
    );
    return linhas[0] ? registroDe(linhas[0]) : null;
  }

  async listarTreinos(f: FiltroTreinos): Promise<Pagina<TreinoDoc>> {
    const cursor = f.status === 'publicado'
      ? cursorSql(f.cursor, 'v.publicado_em', 'v.treino_id')
      : cursorSql(f.cursor, 'atualizado_em', 'id');
    const texto = f.status === 'publicado'
      ? `SELECT TOP (@limite) v.json, v.treino_id AS id, v.publicado_em AS atualizado_em, v.versao
         FROM treino_versoes v
         INNER JOIN (
           SELECT treino_id, MAX(versao) AS versao FROM treino_versoes GROUP BY treino_id
         ) m ON m.treino_id = v.treino_id AND m.versao = v.versao
         WHERE ${cursor.where}
           AND (@objetivo IS NULL OR JSON_VALUE(v.json, '$.objetivo') = @objetivo)
           AND (@nivel IS NULL OR JSON_VALUE(v.json, '$.nivel') = @nivel)
           AND (@categoria IS NULL OR JSON_VALUE(v.json, '$.categoria') = @categoria)
         ORDER BY v.publicado_em DESC, v.treino_id DESC`
      : `SELECT TOP (@limite) json, id, atualizado_em, versao, status
         FROM treinos
         WHERE status = N'rascunho' AND autor_id = @autor AND ${cursor.where}
           AND (@objetivo IS NULL OR JSON_VALUE(json, '$.objetivo') = @objetivo)
           AND (@nivel IS NULL OR JSON_VALUE(json, '$.nivel') = @nivel)
           AND (@categoria IS NULL OR JSON_VALUE(json, '$.categoria') = @categoria)
         ORDER BY atualizado_em DESC, id DESC`;
    const linhas = await consultar(texto, (req) => {
      req.input('limite', sql.Int, f.limit + 1);
      req.input('objetivo', sql.NVarChar(40), f.objetivo ?? null);
      req.input('nivel', sql.NVarChar(40), f.nivel ?? null);
      req.input('categoria', sql.NVarChar(40), f.categoria ?? null);
      req.input('autor', sql.NVarChar(40), f.autorId ?? '');
      cursor.bind(req);
    });
    const docs = linhas.map((linha) => docTreino(linha));
    return proxima(docs, f.limit, (d) => ({ t: d.atualizadoEm, id: d.id }));
  }

  async atualizarRascunho(id: string, patch: PatchTreino, versaoEsperada: number): Promise<TreinoDoc> {
    return transacao(async (novo) => {
      const req = novo();
      req.input('id', sql.NVarChar(40), id);
      const lido = await req.query(
        'SELECT id, autor_id, status, versao, json, atualizado_em FROM treinos WITH (UPDLOCK, HOLDLOCK) WHERE id = @id',
      );
      const linha = (lido.recordset?.[0] ?? null) as Linha | null;
      if (!linha) throw falha(404, 'nao_encontrado', 'Não encontrado.');
      const atual = registroDe(linha);
      if (atual.versao !== versaoEsperada) throw falha(409, 'versao_conflito', 'A versão enviada não é a atual.', { versaoAtual: atual.versao });
      if (atual.status !== 'rascunho') throw falha(409, 'treino_publicado', 'Treino publicado não se edita direto. Abra uma revisão.');
      const prox = structuredClone(atual.doc);
      aplicarPatch(prox, patch);
      prox.status = 'rascunho';
      prox.versao = atual.versao;
      prox.atualizadoEm = new Date().toISOString();
      validarRascunhoResultante(prox);
      const gravar = novo();
      gravar.input('id', sql.NVarChar(40), id);
      gravar.input('json', sql.NVarChar(sql.MAX), JSON.stringify(prox));
      gravar.input('quando', sql.DateTimeOffset, new Date(prox.atualizadoEm));
      await gravar.query('UPDATE treinos SET json = @json, atualizado_em = @quando WHERE id = @id');
      return prox;
    });
  }

  async abrirRevisao(id: string): Promise<TreinoDoc> {
    return transacao(async (novo) => {
      const req = novo();
      req.input('id', sql.NVarChar(40), id);
      const lido = await req.query(
        'SELECT id, autor_id, status, versao, json, atualizado_em FROM treinos WITH (UPDLOCK, HOLDLOCK) WHERE id = @id',
      );
      const linha = (lido.recordset?.[0] ?? null) as Linha | null;
      if (!linha) throw falha(404, 'nao_encontrado', 'Não encontrado.');
      const atual = registroDe(linha);
      if (atual.status === 'rascunho') throw falha(409, 'revisao_aberta', 'Já existe uma revisão aberta.');
      const doc = structuredClone(atual.doc);
      doc.status = 'rascunho';
      doc.atualizadoEm = new Date().toISOString();
      const gravar = novo();
      gravar.input('id', sql.NVarChar(40), id);
      gravar.input('json', sql.NVarChar(sql.MAX), JSON.stringify(doc));
      gravar.input('quando', sql.DateTimeOffset, new Date(doc.atualizadoEm));
      await gravar.query(`UPDATE treinos SET status = N'rascunho', json = @json, atualizado_em = @quando WHERE id = @id`);
      return doc;
    });
  }

  async publicar(id: string, versaoEsperada: number): Promise<TreinoDoc> {
    return transacao(async (novo) => {
      const req = novo();
      req.input('id', sql.NVarChar(40), id);
      const lido = await req.query(
        'SELECT id, autor_id, status, versao, json, atualizado_em FROM treinos WITH (UPDLOCK, HOLDLOCK) WHERE id = @id',
      );
      const linha = (lido.recordset?.[0] ?? null) as Linha | null;
      if (!linha) throw falha(404, 'nao_encontrado', 'Não encontrado.');
      const atual = registroDe(linha);
      if (atual.versao !== versaoEsperada) throw falha(409, 'versao_conflito', 'A versão enviada não é a atual.', { versaoAtual: atual.versao });
      if (atual.status !== 'rascunho') throw falha(409, 'ja_publicado', 'Este treino já está publicado.');
      const agora = new Date().toISOString();
      const doc = documentoPublicado(atual.doc, agora);
      const gravar = novo();
      gravar.input('id', sql.NVarChar(40), id);
      gravar.input('versao', sql.Int, doc.versao);
      gravar.input('json', sql.NVarChar(sql.MAX), JSON.stringify(doc));
      gravar.input('quando', sql.DateTimeOffset, new Date(agora));
      await gravar.query(
        `INSERT INTO treino_versoes (treino_id, versao, json, publicado_em) VALUES (@id, @versao, @json, @quando);
         UPDATE treinos SET status = N'publicado', versao = @versao, json = @json, atualizado_em = @quando WHERE id = @id`,
      );
      return doc;
    });
  }

  async listarVersoes(id: string): Promise<{ versao: number; publicadoEm: string }[]> {
    const linhas = await consultar(
      'SELECT versao, publicado_em FROM treino_versoes WHERE treino_id = @id ORDER BY versao DESC',
      (req) => req.input('id', sql.NVarChar(40), id),
    );
    return linhas.map((linha) => ({ versao: inteiro(linha.versao), publicadoEm: dataIso(linha.publicado_em) }));
  }

  async obterVersao(id: string, versao: number): Promise<TreinoDoc | null> {
    const linhas = await consultar(
      'SELECT json, versao, publicado_em AS atualizado_em FROM treino_versoes WHERE treino_id = @id AND versao = @versao',
      (req) => {
        req.input('id', sql.NVarChar(40), id);
        req.input('versao', sql.Int, versao);
      },
    );
    return linhas[0] ? docTreino(linhas[0]) : null;
  }

  async inserirSessao(sessao: SessaoDoc, praticanteId: string): Promise<'criada' | 'repetida' | 'conflito'> {
    const canon = canonico(sessao);
    return transacao(async (novo) => {
      const req = novo();
      req.input('id', sql.NVarChar(40), sessao.id);
      const lido = await req.query('SELECT json FROM sessoes WITH (UPDLOCK, HOLDLOCK) WHERE id = @id');
      const linha = (lido.recordset?.[0] ?? null) as Linha | null;
      if (linha) {
        const gravada = JSON.parse(String(linha.json)) as SessaoDoc;
        return canonico(gravada) === canon ? 'repetida' : 'conflito';
      }
      const gravar = novo();
      gravar.input('id', sql.NVarChar(40), sessao.id);
      gravar.input('praticante', sql.NVarChar(40), praticanteId);
      gravar.input('treino', sql.NVarChar(40), sessao.treino.id);
      gravar.input('inicio', sql.BigInt, sessao.inicio);
      gravar.input('json', sql.NVarChar(sql.MAX), JSON.stringify(sessao));
      gravar.input('quando', sql.DateTimeOffset, new Date());
      await gravar.query(
        `INSERT INTO sessoes (id, praticante_id, treino_id, inicio, json, recebida_em)
         VALUES (@id, @praticante, @treino, @inicio, @json, @quando)`,
      );
      return 'criada';
    });
  }

  async listarSessoes(f: FiltroSessoes): Promise<Pagina<SessaoResposta>> {
    const cursor = cursorSql(f.cursor, 'inicio', 'id');
    const linhas = await consultar(
      `SELECT TOP (@limite) json, recebida_em, inicio, id FROM sessoes
       WHERE (@praticante IS NULL OR praticante_id = @praticante)
         AND (@treino IS NULL OR treino_id = @treino)
         AND (@de IS NULL OR inicio >= @de)
         AND (@ate IS NULL OR inicio <= @ate)
         AND ${cursor.where}
       ORDER BY inicio DESC, id DESC`,
      (req) => {
        req.input('limite', sql.Int, f.limit + 1);
        req.input('praticante', sql.NVarChar(40), f.praticanteId ?? null);
        req.input('treino', sql.NVarChar(40), f.treinoId ?? null);
        req.input('de', sql.BigInt, f.de ?? null);
        req.input('ate', sql.BigInt, f.ate ?? null);
        cursor.bind(req);
      },
    );
    const itens = linhas.map((linha) => ({ ...(JSON.parse(String(linha.json)) as SessaoDoc), recebidaEm: dataIso(linha.recebida_em) }));
    return proxima(itens, f.limit, (s) => ({ t: s.inicio, id: s.id }));
  }

  async obterSessao(id: string): Promise<(SessaoResposta & { praticanteId: string }) | null> {
    const linhas = await consultar(
      'SELECT json, recebida_em, praticante_id FROM sessoes WHERE id = @id',
      (req) => req.input('id', sql.NVarChar(40), id),
    );
    const linha = linhas[0];
    if (!linha) return null;
    return {
      ...(JSON.parse(String(linha.json)) as SessaoDoc),
      recebidaEm: dataIso(linha.recebida_em),
      praticanteId: String(linha.praticante_id),
    };
  }

  async registrarAuditoria(a: { atorId: string | null; acao: string; recurso: string; requestId: string }): Promise<void> {
    await consultar(
      `INSERT INTO auditoria (em, ator_id, acao, recurso, request_id)
       VALUES (SYSUTCDATETIME(), @ator, @acao, @recurso, @request)`,
      (req) => {
        req.input('ator', sql.NVarChar(40), a.atorId);
        req.input('acao', sql.NVarChar(40), a.acao);
        req.input('recurso', sql.NVarChar(80), a.recurso);
        req.input('request', sql.NVarChar(40), a.requestId);
      },
    );
  }

  async listarAuditoria(f: { limit: number; cursor: Cursor | null }): Promise<Pagina<AuditoriaItem>> {
    const cursor = f.cursor
      ? {
          where: '(em < @cursorTempo OR (em = @cursorTempo AND id < @cursorId))',
          bind(req: Request) {
            req.input('cursorTempo', sql.DateTimeOffset, new Date(String(f.cursor?.t)));
            req.input('cursorId', sql.BigInt, Number(f.cursor?.id));
          },
        }
      : { where: '1 = 1', bind: (_req: Request) => undefined };
    const linhas = await consultar(
      `SELECT TOP (@limite) id, em, ator_id, acao, recurso, request_id FROM auditoria
       WHERE ${cursor.where}
       ORDER BY em DESC, id DESC`,
      (req) => {
        req.input('limite', sql.Int, f.limit + 1);
        cursor.bind(req);
      },
    );
    const itens = linhas.map((linha) => ({
      id: inteiro(linha.id),
      em: dataIso(linha.em),
      atorId: linha.ator_id == null ? null : String(linha.ator_id),
      acao: String(linha.acao),
      recurso: String(linha.recurso),
      requestId: String(linha.request_id),
    }));
    return proxima(itens, f.limit, (a) => ({ t: a.em, id: String(a.id).padStart(12, '0') }));
  }
}
