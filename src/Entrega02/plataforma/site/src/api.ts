const CHAVE = 'nockhug.plataforma.jwt';

export type Papel = 'autor' | 'praticante';

export type Treino = {
  id: string;
  nome: string;
  bolasPorSerie?: number;
  series?: number;
  descansoS?: number;
  padrao: boolean;
  velocidade?: { lancador: number; alimentador: number };
  preset?: string;
  status: 'rascunho' | 'publicado';
  versao: number;
  categoria?: string;
  objetivo?: string;
  nivel?: string;
  publico?: string;
  licenca?: string;
  remuneracao?: string;
  duracaoEstimadaMin?: number;
  publicadoEm?: string;
  atualizadoEm: string;
};

export type Sessao = {
  id: string;
  treino: { id: string; nome: string; bolasPorSerie: number; series: number; descansoS: number };
  inicio: number;
  fim: number;
  transporte: string;
  series: { indice: number; bolas: number; inicio: number; fim: number; motivo: string }[];
  comandos: { ts: number; origem: string; transcricao: string; comando: string; aceito: boolean; motivo: string | null; latenciaMs: number | null }[];
  encerradaPor: string;
  xp: number;
  recebidaEm?: string;
};

export type Usuario = { id: string; email: string; nome: string; papel: Papel };

export class ErroApi extends Error {
  readonly status: number;
  readonly code: string;
  readonly campos: Record<string, string>;

  constructor(status: number, code: string, message: string, campos: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.campos = campos;
  }
}

export function lerToken(): string | null {
  return sessionStorage.getItem(CHAVE);
}

export function guardarToken(token: string): void {
  sessionStorage.setItem(CHAVE, token);
}

export function apagarToken(): void {
  sessionStorage.removeItem(CHAVE);
}

export function papelDoToken(token = lerToken()): Papel | null {
  if (!token) return null;
  const parte = token.split('.')[1];
  if (!parte) return null;
  try {
    const json = JSON.parse(atob(parte.replace(/-/g, '+').replace(/_/g, '/'))) as { papel?: string };
    return json.papel === 'autor' || json.papel === 'praticante' ? json.papel : null;
  } catch {
    return null;
  }
}

function baseUrl(): string {
  const bruto = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3099';
  return bruto.replace(/\/$/, '');
}

async function pedir<T>(caminho: string, op: { metodo?: string; corpo?: unknown; ifMatch?: number; token?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (op.corpo !== undefined) headers['content-type'] = 'application/json';
  if (op.ifMatch !== undefined) headers['if-match'] = `"${op.ifMatch}"`;
  if (op.token !== false) {
    const token = lerToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl()}${caminho}`, {
    method: op.metodo ?? 'GET',
    headers,
    body: op.corpo === undefined ? undefined : JSON.stringify(op.corpo),
  });
  const texto = await res.text();
  const json = texto ? JSON.parse(texto) as { error?: { code?: string; message?: string; details?: { campos?: Record<string, string> } } } : {};
  if (!res.ok) {
    if (res.status === 401 && caminho !== '/v1/entrar') apagarToken();
    throw new ErroApi(res.status, json.error?.code ?? 'erro_interno', json.error?.message ?? 'Não foi possível concluir.', json.error?.details?.campos ?? {});
  }
  return json as T;
}

export const api = {
  entrar: (email: string, senha: string) => pedir<{ token: string; usuario: Usuario }>('/v1/entrar', { metodo: 'POST', corpo: { email, senha }, token: false }),
  rascunhos: () => pedir<{ itens: Treino[] }>('/v1/treinos?status=rascunho'),
  publicados: () => pedir<{ itens: Treino[] }>('/v1/treinos?status=publicado&limit=50', { token: false }),
  obterTreino: (id: string) => pedir<Treino>(`/v1/treinos/${id}`),
  criarTreino: (corpo: unknown) => pedir<Treino>('/v1/treinos', { metodo: 'POST', corpo }),
  atualizarTreino: (id: string, corpo: unknown, versao: number) => pedir<Treino>(`/v1/treinos/${id}`, { metodo: 'PATCH', corpo, ifMatch: versao }),
  publicar: (id: string, versao: number) => pedir<Treino>(`/v1/treinos/${id}/publicar`, { metodo: 'POST', ifMatch: versao }),
  abrirRevisao: (id: string) => pedir<Treino>(`/v1/treinos/${id}/revisoes`, { metodo: 'POST' }),
  versoes: (id: string) => pedir<{ itens: { versao: number; publicadoEm: string }[] }>(`/v1/treinos/${id}/versoes`, { token: false }),
  versao: (id: string, versao: number) => pedir<Treino>(`/v1/treinos/${id}/versoes/${versao}`, { token: false }),
  sessoes: () => pedir<{ itens: Sessao[] }>('/v1/sessoes'),
  sessao: (id: string) => pedir<Sessao>(`/v1/sessoes/${id}`),
  auditoria: () => pedir<{ itens: { id: number; em: string; acao: string; recurso: string }[] }>('/v1/auditoria'),
};
