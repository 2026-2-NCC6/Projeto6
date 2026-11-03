import type { Categoria, Nivel, Objetivo, Preset, Velocidade } from './limites.js';
import type { Cursor } from './cursor.js';

export type Papel = 'autor' | 'praticante';

export type UsuarioPublico = {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
};

export type UsuarioInterno = UsuarioPublico & {
  senhaHash: string;
  criadoEm: string;
};

export type TreinoDoc = {
  id: string;
  nome: string;
  bolasPorSerie?: number;
  series?: number;
  descansoS?: number;
  padrao: boolean;
  velocidade?: Velocidade;
  preset?: Preset;
  status: 'rascunho' | 'publicado';
  versao: number;
  categoria?: Categoria;
  objetivo?: Objetivo;
  nivel?: Nivel;
  publico?: 'adulto';
  licenca?: 'uso-academico';
  remuneracao?: 'gratuito';
  duracaoEstimadaMin?: number;
  publicadoEm?: string;
  atualizadoEm: string;
};

export type TreinoRegistro = {
  id: string;
  autorId: string;
  status: 'rascunho' | 'publicado';
  versao: number;
  doc: TreinoDoc;
  atualizadoEm: string;
};

export type PatchTreino = {
  nome?: string;
  bolasPorSerie?: number;
  series?: number;
  descansoS?: number;
  velocidade?: Velocidade | null;
  preset?: Preset;
  categoria?: Categoria;
  objetivo?: Objetivo;
  nivel?: Nivel;
  publico?: 'adulto';
  licenca?: 'uso-academico';
  remuneracao?: 'gratuito';
  padrao?: boolean;
};

export type SessaoTreino = {
  id: string;
  nome: string;
  bolasPorSerie: number;
  series: number;
  descansoS: number;
  padrao: boolean;
  velocidade?: Velocidade;
  preset?: Preset;
};

export type SerieSessao = {
  indice: number;
  bolas: number;
  inicio: number;
  fim: number;
  motivo: 'serie_concluida' | 'desligar' | 'emergencia' | 'conexao_perdida' | 'encerrada';
};

export type ComandoSessao = {
  ts: number;
  origem: 'voz' | 'botao' | 'auto';
  transcricao: string;
  comando: string;
  aceito: boolean;
  motivo: string | null;
  latenciaMs: number | null;
};

export type SessaoDoc = {
  id: string;
  treino: SessaoTreino;
  inicio: number;
  fim: number;
  transporte: 'wifi' | 'ble' | 'simulada';
  series: SerieSessao[];
  comandos: ComandoSessao[];
  encerradaPor: 'concluida' | 'praticante' | 'parada_segura';
  xp: number;
};

export type SessaoResposta = SessaoDoc & { recebidaEm: string };

export type AuditoriaItem = {
  id: number;
  em: string;
  atorId: string | null;
  acao: string;
  recurso: string;
  requestId: string;
};

export type Pagina<T> = { itens: T[]; proximoCursor: string | null };

export type FiltroTreinos = {
  status: 'rascunho' | 'publicado';
  autorId?: string;
  objetivo?: string;
  nivel?: string;
  categoria?: string;
  limit: number;
  cursor: Cursor | null;
};

export type FiltroSessoes = {
  praticanteId?: string;
  treinoId?: string;
  de?: number;
  ate?: number;
  limit: number;
  cursor: Cursor | null;
};

export interface Armazenamento {
  buscarUsuarioPorEmail(email: string): Promise<UsuarioInterno | null>;
  listarUsuarios(f: { limit: number; cursor: Cursor | null }): Promise<Pagina<UsuarioPublico>>;
  inserirTreino(treino: TreinoRegistro): Promise<void>;
  obterTreino(id: string): Promise<TreinoRegistro | null>;
  listarTreinos(f: FiltroTreinos): Promise<Pagina<TreinoDoc>>;
  atualizarRascunho(id: string, patch: PatchTreino, versaoEsperada: number): Promise<TreinoDoc>;
  abrirRevisao(id: string): Promise<TreinoDoc>;
  publicar(id: string, versaoEsperada: number): Promise<TreinoDoc>;
  listarVersoes(id: string): Promise<{ versao: number; publicadoEm: string }[]>;
  obterVersao(id: string, versao: number): Promise<TreinoDoc | null>;
  inserirSessao(sessao: SessaoDoc, praticanteId: string): Promise<'criada' | 'repetida' | 'conflito'>;
  listarSessoes(f: FiltroSessoes): Promise<Pagina<SessaoResposta>>;
  obterSessao(id: string): Promise<(SessaoResposta & { praticanteId: string }) | null>;
  registrarAuditoria(a: { atorId: string | null; acao: string; recurso: string; requestId: string }): Promise<void>;
  listarAuditoria(f: { limit: number; cursor: Cursor | null }): Promise<Pagina<AuditoriaItem>>;
}

export type UsuarioSemente = {
  id: string;
  email: string;
  senhaHash: string;
  nome: string;
  papel: Papel;
  criadoEm: string;
};

export type ComSemente = Armazenamento & {
  garantirUsuario(usuario: UsuarioSemente): Promise<void>;
};
