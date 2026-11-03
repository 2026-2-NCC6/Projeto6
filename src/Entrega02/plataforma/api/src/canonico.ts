export function canonico(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor) ?? 'null';
  if (Array.isArray(valor)) return `[${valor.map((item) => canonico(item)).join(',')}]`;
  const entradas = Object.keys(valor as Record<string, unknown>)
    .sort()
    .map((chave) => `${JSON.stringify(chave)}:${canonico((valor as Record<string, unknown>)[chave])}`);
  return `{${entradas.join(',')}}`;
}
