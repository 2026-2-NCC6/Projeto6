import { repositorio } from '@/dados/repositorio';
import { apagarJwtPlataforma, lerJwtPlataforma, salvarJwtPlataforma } from '@/dados/segredos';
import { marcarEnvio, mesclarTreinos, pendentes, type ItemFila, type ResultadoEnvio } from '@/dados/sincronizacao';
import { sanitizarTreino } from '@/dominio/treinos';
import type { Sessao, Treino } from '@/dominio/tipos';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

let fetchAtual: FetchLike | null = null;

export function definirFetch(fetchImpl: FetchLike) {
  fetchAtual = fetchImpl;
}

export function urlPlataforma(): string {
  return (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
}

function http(input: string, init?: RequestInit) {
  return (fetchAtual ?? fetch)(input, init);
}

function jsonDoToken(token: string): { email?: string; papel?: string } | null {
  try {
    const parte = token.split('.')[1];
    if (!parte) return null;
    const base = parte.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base.length % 4 === 0 ? base : base + '='.repeat(4 - (base.length % 4));
    return JSON.parse(atob(pad)) as { email?: string; papel?: string };
  } catch {
    return null;
  }
}

export async function lerContaPlataforma(): Promise<{ email: string; papel: string } | null> {
  const token = await lerJwtPlataforma();
  if (!token) return null;
  const json = jsonDoToken(token);
  if (!json?.email || !json.papel) return null;
  return { email: json.email, papel: json.papel };
}

export async function entrarPlataforma(email: string, senha: string): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const base = urlPlataforma();
  if (!base) return { ok: false, mensagem: 'A plataforma está desligada neste aplicativo.' };
  try {
    const res = await http(`${base}/v1/entrar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    const json = await res.json() as { token?: string; error?: { message?: string } };
    if (!res.ok || !json.token) return { ok: false, mensagem: json.error?.message ?? 'E-mail ou senha não conferem.' };
    await salvarJwtPlataforma(json.token);
    return { ok: true };
  } catch {
    return { ok: false, mensagem: 'Sem conexão com a plataforma.' };
  }
}

export async function sairPlataforma(): Promise<void> {
  await apagarJwtPlataforma();
}

export type ResultadoSincronizacao = {
  ok: boolean;
  mensagem: string;
  treinos: Treino[] | null;
  envios: Record<string, ItemFila['estado']>;
};

function mapaEnvios(fila: ItemFila[]): Record<string, ItemFila['estado']> {
  return Object.fromEntries(fila.filter((item) => item.tipo === 'sessao').map((item) => [item.id, item.estado]));
}

async function baixarPublicados(base: string): Promise<Treino[]> {
  const remotos: Treino[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 20; pagina += 1) {
    const url = new URL('/v1/treinos', base);
    url.searchParams.set('status', 'publicado');
    url.searchParams.set('limit', '50');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await http(url.toString());
    if (!res.ok) throw new Error('catalogo');
    const corpo = await res.json() as { itens?: unknown[]; proximoCursor?: string | null };
    for (const item of corpo.itens ?? []) {
      const bruto = item as { versao?: number };
      const treino = sanitizarTreino({ ...(item as object), padrao: false, origem: 'plataforma', versaoPublicada: bruto.versao });
      if (treino) remotos.push(treino);
    }
    cursor = corpo.proximoCursor ?? null;
    if (!cursor) break;
  }
  return remotos;
}

async function enviarUm(base: string, token: string, item: ItemFila): Promise<ResultadoEnvio> {
  try {
    const res = await http(`${base}/v1/sessoes`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'idempotency-key': item.id,
      },
      body: item.json,
    });
    if (res.status === 200 || res.status === 201 || res.status === 409 || res.status === 503) {
      return { id: item.id, status: res.status };
    }
    return { id: item.id, status: 503 };
  } catch {
    return { id: item.id, rede: true };
  }
}

export async function enfileirarSessao(sessao: Sessao): Promise<void> {
  if (!urlPlataforma()) return;
  await repositorio.gravarFila({
    id: sessao.id,
    tipo: 'sessao',
    json: JSON.stringify(sessao),
    tentativas: 0,
    estado: 'pendente',
    ultimoErro: null,
  });
}

export async function sincronizarPlataforma(): Promise<ResultadoSincronizacao> {
  const base = urlPlataforma();
  const filaInicial = await repositorio.listarFila();
  if (!base) return { ok: true, mensagem: 'Plataforma desligada.', treinos: null, envios: mapaEnvios(filaInicial) };

  let treinos: Treino[] | null = null;
  let ok = true;
  let mensagem = 'Sincronizado.';
  try {
    const remotos = await baixarPublicados(base);
    const locais = await repositorio.listarTreinos();
    const mesclados = mesclarTreinos(locais, remotos);
    for (const treino of mesclados) {
      if (treino.id.startsWith('pub-')) await repositorio.salvarTreino(treino);
    }
    treinos = (await repositorio.listarTreinos()).map(sanitizarTreino).filter((t): t is Treino => !!t);
  } catch {
    ok = false;
    mensagem = 'Não foi possível baixar os treinos. A lista deste aparelho foi mantida.';
  }

  let fila = await repositorio.listarFila();
  try {
    const token = await lerJwtPlataforma();
    const conta = token ? jsonDoToken(token) : null;
    if (token && conta?.papel === 'praticante') {
      for (const item of pendentes(fila)) {
        if (item.tipo !== 'sessao') continue;
        const resultado = await enviarUm(base, token, item);
        if ('status' in resultado && (resultado.status === 200 || resultado.status === 201)) {
          const marca: ItemFila = { ...item, estado: 'enviada', ultimoErro: null };
          fila = [...marcarEnvio(fila, resultado), marca];
          await repositorio.gravarFila(marca);
        } else {
          fila = marcarEnvio(fila, resultado);
          const atual = fila.find((candidato) => candidato.id === item.id);
          if (atual) await repositorio.gravarFila(atual);
        }
      }
    }
  } catch {
    ok = false;
    mensagem = treinos ? 'O catálogo foi atualizado, mas o envio das sessões falhou.' : 'Os treinos locais foram mantidos e o envio das sessões falhou.';
  }
  return { ok, mensagem, treinos, envios: mapaEnvios(fila) };
}
