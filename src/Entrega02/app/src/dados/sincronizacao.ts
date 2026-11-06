import type { Sessao, Treino } from '@/dominio/tipos';

export type EstadoFila = 'pendente' | 'enviada' | 'conflito';

export type ItemFila = {
  id: string;
  tipo: string;
  json: string;
  tentativas: number;
  estado: EstadoFila;
  ultimoErro: string | null;
};

export type ResultadoEnvio =
  | { id: string; status: 200 | 201 }
  | { id: string; status: 409 }
  | { id: string; status: 503 }
  | { id: string; rede: true };

// Acrescenta ou atualiza o que veio da plataforma. Treino local cujo id não
// começa com pub- permanece como está, mesmo que a API não o devolva.
export function mesclarTreinos(locais: Treino[], remotos: Treino[]): Treino[] {
  const porId = new Map(locais.map((t) => [t.id, t]));
  const ordem = locais.map((t) => t.id);
  for (const remoto of remotos) {
    if (!remoto.id.startsWith('pub-')) continue;
    if (!porId.has(remoto.id)) ordem.push(remoto.id);
    porId.set(remoto.id, remoto);
  }
  return ordem.map((id) => porId.get(id)).filter((t): t is Treino => !!t);
}

// 200 e 201 tiram o item da fila de reenvio. 409 marca conflito e para.
// Rede e 503 mantêm o item e somam uma tentativa.
export function marcarEnvio(fila: ItemFila[], resultado: ResultadoEnvio): ItemFila[] {
  return fila.flatMap((item) => {
    if (item.id !== resultado.id) return [item];
    if ('status' in resultado && (resultado.status === 200 || resultado.status === 201)) return [];
    if ('status' in resultado && resultado.status === 409) {
      return [{ ...item, estado: 'conflito' as const, tentativas: item.tentativas + 1, ultimoErro: '409' }];
    }
    return [{ ...item, tentativas: item.tentativas + 1, ultimoErro: 'status' in resultado ? '503' : 'rede' }];
  });
}

export function pendentes(fila: ItemFila[]): ItemFila[] {
  return fila.filter((item) => item.estado === 'pendente');
}

// Sessões gravadas neste aparelho que nunca entraram na fila: as de um build
// sem a plataforma (EXPO_PUBLIC_API_URL vazio) ou de antes do login. Entram
// como pendentes; o id da sessão é a chave de idempotência, então a API não
// duplica uma que já tenha recebido.
export function sessoesForaDaFila(sessoes: Sessao[], fila: ItemFila[]): ItemFila[] {
  const naFila = new Set(fila.map((i) => i.id));
  return sessoes
    .filter((s) => !naFila.has(s.id))
    .map((s) => ({ id: s.id, tipo: 'sessao' as const, json: JSON.stringify(s), tentativas: 0, estado: 'pendente' as const, ultimoErro: null }));
}
