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
import { paginar, type Cursor } from './cursor.js';
import { falha } from './erros.js';
import { documentoPublicado, aplicarPatch, validarRascunhoResultante } from './validar.js';

type Versao = { treinoId: string; versao: number; doc: TreinoDoc; publicadoEm: string };
type SessaoGravada = { praticanteId: string; treinoId: string; inicio: number; recebidaEm: string; doc: SessaoDoc; canon: string };

function clone<T>(valor: T): T {
  return structuredClone(valor);
}

function versaoConflito(versao: number) {
  return falha(409, 'versao_conflito', 'A versão enviada não é a atual.', { versaoAtual: versao });
}

export class Memoria implements Armazenamento {
  private readonly usuarios: UsuarioInterno[] = [];
  private readonly treinos = new Map<string, TreinoRegistro>();
  private readonly versoes: Versao[] = [];
  private readonly sessoes = new Map<string, SessaoGravada>();
  private readonly auditoria: AuditoriaItem[] = [];
  private seqAuditoria = 0;

  async garantirUsuario(usuario: UsuarioSemente): Promise<void> {
    const email = usuario.email.trim().toLowerCase();
    if (this.usuarios.some((u) => u.email === email)) return;
    this.usuarios.push({ ...usuario, email });
  }

  inspecionar(): string {
    return JSON.stringify({
      usuarios: this.usuarios,
      treinos: [...this.treinos.values()],
      versoes: this.versoes,
      sessoes: [...this.sessoes.values()],
      auditoria: this.auditoria,
    });
  }

  async buscarUsuarioPorEmail(email: string): Promise<UsuarioInterno | null> {
    const alvo = email.trim().toLowerCase();
    return this.usuarios.find((u) => u.email === alvo) ?? null;
  }

  async listarUsuarios(f: { limit: number; cursor: Cursor | null }): Promise<Pagina<UsuarioPublico>> {
    const pagina = paginar(this.usuarios, f.limit, f.cursor, (u) => ({ t: u.criadoEm, id: u.id }));
    return {
      itens: pagina.itens.map(({ id, email, nome, papel }) => ({ id, email, nome, papel })),
      proximoCursor: pagina.proximoCursor,
    };
  }

  async inserirTreino(treino: TreinoRegistro): Promise<void> {
    if (this.treinos.has(treino.id)) throw falha(422, 'pedido_invalido', 'Já existe um treino com este id.', { campos: { id: 'Já existe um treino com este id.' } });
    this.treinos.set(treino.id, clone(treino));
  }

  async obterTreino(id: string): Promise<TreinoRegistro | null> {
    const treino = this.treinos.get(id);
    return treino ? clone(treino) : null;
  }

  async listarTreinos(f: FiltroTreinos): Promise<Pagina<TreinoDoc>> {
    let docs: TreinoDoc[];
    if (f.status === 'publicado') {
      const ultima = new Map<string, Versao>();
      for (const versao of this.versoes) {
        const atual = ultima.get(versao.treinoId);
        if (!atual || versao.versao > atual.versao) ultima.set(versao.treinoId, versao);
      }
      docs = [...ultima.values()].map((v) => clone(v.doc));
    } else {
      docs = [...this.treinos.values()]
        .filter((t) => t.status === 'rascunho' && (!f.autorId || t.autorId === f.autorId))
        .map((t) => clone(t.doc));
    }
    if (f.objetivo) docs = docs.filter((d) => d.objetivo === f.objetivo);
    if (f.nivel) docs = docs.filter((d) => d.nivel === f.nivel);
    if (f.categoria) docs = docs.filter((d) => d.categoria === f.categoria);
    return paginar(docs, f.limit, f.cursor, (d) => ({ t: d.atualizadoEm, id: d.id }));
  }

  async atualizarRascunho(id: string, patch: PatchTreino, versaoEsperada: number): Promise<TreinoDoc> {
    const atual = this.treinos.get(id);
    if (!atual) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    if (atual.versao !== versaoEsperada) throw versaoConflito(atual.versao);
    if (atual.status !== 'rascunho') throw falha(409, 'treino_publicado', 'Treino publicado não se edita direto. Abra uma revisão.');
    const prox = clone(atual.doc);
    aplicarPatch(prox, patch);
    prox.status = 'rascunho';
    prox.versao = atual.versao;
    prox.atualizadoEm = new Date().toISOString();
    validarRascunhoResultante(prox);
    atual.doc = prox;
    atual.atualizadoEm = prox.atualizadoEm;
    return clone(prox);
  }

  async abrirRevisao(id: string): Promise<TreinoDoc> {
    const atual = this.treinos.get(id);
    if (!atual) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    if (atual.status === 'rascunho') throw falha(409, 'revisao_aberta', 'Já existe uma revisão aberta.');
    const doc = clone(atual.doc);
    doc.status = 'rascunho';
    doc.atualizadoEm = new Date().toISOString();
    atual.doc = doc;
    atual.status = 'rascunho';
    atual.atualizadoEm = doc.atualizadoEm;
    return clone(doc);
  }

  async publicar(id: string, versaoEsperada: number): Promise<TreinoDoc> {
    const atual = this.treinos.get(id);
    if (!atual) throw falha(404, 'nao_encontrado', 'Não encontrado.');
    if (atual.versao !== versaoEsperada) throw versaoConflito(atual.versao);
    if (atual.status !== 'rascunho') throw falha(409, 'ja_publicado', 'Este treino já está publicado.');
    const agora = new Date().toISOString();
    const doc = documentoPublicado(atual.doc, agora);
    this.versoes.push({ treinoId: id, versao: doc.versao, doc: clone(doc), publicadoEm: agora });
    atual.doc = clone(doc);
    atual.status = 'publicado';
    atual.versao = doc.versao;
    atual.atualizadoEm = agora;
    return clone(doc);
  }

  async listarVersoes(id: string): Promise<{ versao: number; publicadoEm: string }[]> {
    return this.versoes
      .filter((v) => v.treinoId === id)
      .sort((a, b) => b.versao - a.versao)
      .map((v) => ({ versao: v.versao, publicadoEm: v.publicadoEm }));
  }

  async obterVersao(id: string, versao: number): Promise<TreinoDoc | null> {
    const achada = this.versoes.find((v) => v.treinoId === id && v.versao === versao);
    return achada ? clone(achada.doc) : null;
  }

  async inserirSessao(sessao: SessaoDoc, praticanteId: string): Promise<'criada' | 'repetida' | 'conflito'> {
    const canon = canonico(sessao);
    const existente = this.sessoes.get(sessao.id);
    if (existente) return existente.canon === canon ? 'repetida' : 'conflito';
    this.sessoes.set(sessao.id, {
      praticanteId,
      treinoId: sessao.treino.id,
      inicio: sessao.inicio,
      recebidaEm: new Date().toISOString(),
      doc: clone(sessao),
      canon,
    });
    return 'criada';
  }

  async listarSessoes(f: FiltroSessoes): Promise<Pagina<SessaoResposta>> {
    const itens = [...this.sessoes.values()].filter((s) => {
      if (f.praticanteId && s.praticanteId !== f.praticanteId) return false;
      if (f.treinoId && s.treinoId !== f.treinoId) return false;
      if (f.de !== undefined && s.inicio < f.de) return false;
      if (f.ate !== undefined && s.inicio > f.ate) return false;
      return true;
    }).map((s) => ({ ...clone(s.doc), recebidaEm: s.recebidaEm }));
    return paginar(itens, f.limit, f.cursor, (s) => ({ t: s.inicio, id: s.id }));
  }

  async obterSessao(id: string): Promise<(SessaoResposta & { praticanteId: string }) | null> {
    const s = this.sessoes.get(id);
    if (!s) return null;
    return { ...clone(s.doc), recebidaEm: s.recebidaEm, praticanteId: s.praticanteId };
  }

  async registrarAuditoria(a: { atorId: string | null; acao: string; recurso: string; requestId: string }): Promise<void> {
    this.seqAuditoria += 1;
    this.auditoria.push({
      id: this.seqAuditoria,
      em: new Date().toISOString(),
      atorId: a.atorId,
      acao: a.acao,
      recurso: a.recurso,
      requestId: a.requestId,
    });
  }

  async listarAuditoria(f: { limit: number; cursor: Cursor | null }): Promise<Pagina<AuditoriaItem>> {
    return paginar(this.auditoria, f.limit, f.cursor, (a) => ({ t: a.em, id: String(a.id).padStart(12, '0') }));
  }
}
