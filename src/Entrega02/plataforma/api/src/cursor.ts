export type Cursor = { t: string | number; id: string };

export function codificarCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.t, id: cursor.id }), 'utf8').toString('base64url');
}

export function decodificarCursor(bruto: string): Cursor | null {
  try {
    const json = JSON.parse(Buffer.from(bruto, 'base64url').toString('utf8')) as { t?: unknown; id?: unknown };
    if ((typeof json.t !== 'string' && typeof json.t !== 'number') || typeof json.id !== 'string') return null;
    return { t: json.t, id: json.id };
  } catch {
    return null;
  }
}

function antes(item: Cursor, cursor: Cursor): boolean {
  if (typeof item.t !== typeof cursor.t) return false;
  if (item.t < cursor.t) return true;
  if (item.t === cursor.t && item.id < cursor.id) return true;
  return false;
}

export function paginar<T>(itens: T[], limit: number, cursor: Cursor | null, chave: (item: T) => Cursor): { itens: T[]; proximoCursor: string | null } {
  const ordenados = [...itens].sort((a, b) => {
    const ka = chave(a);
    const kb = chave(b);
    if (ka.t > kb.t) return -1;
    if (ka.t < kb.t) return 1;
    if (ka.id > kb.id) return -1;
    if (ka.id < kb.id) return 1;
    return 0;
  });
  const filtrados = cursor ? ordenados.filter((item) => antes(chave(item), cursor)) : ordenados;
  const fatia = filtrados.slice(0, limit);
  const proximoCursor = filtrados.length > limit && fatia.length > 0 ? codificarCursor(chave(fatia[fatia.length - 1]!)) : null;
  return { itens: fatia, proximoCursor };
}
