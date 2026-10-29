// Gamificação (PRD §9.6): XP, níveis, sequência de dias ativos, meta semanal e
// conquistas. Tudo é derivado das sessões gravadas; nada é contado à parte.

export type ResumoSessao = { inicio: number; bolas: number; xp: number; paradaSegura: boolean };

const DIA_MS = 86_400_000;

export function chaveDia(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

function inicioDoDia(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Soma dias em calendário local (setDate atravessa horário de verão sem erro).
function somarDias(ts: number, dias: number): number {
  const d = new Date(inicioDoDia(ts));
  d.setDate(d.getDate() + dias);
  return d.getTime();
}

export function diasAtivos(sessoes: ResumoSessao[]): Set<string> {
  return new Set(sessoes.map((s) => chaveDia(s.inicio)));
}

// Dias ativos consecutivos até hoje. Se hoje ainda não teve sessão, a
// sequência de ontem continua valendo até o fim do dia.
export function sequencia(ativos: Set<string>, agora: number): number {
  let dia = ativos.has(chaveDia(agora)) ? inicioDoDia(agora) : somarDias(agora, -1);
  let n = 0;
  while (ativos.has(chaveDia(dia))) {
    n++;
    dia = somarDias(dia, -1);
  }
  return n;
}

export const XP_POR_SESSAO = 20;
export const XP_POR_DIA_NA_SEQUENCIA = 10;

// 1 XP por bola estimada + 20 por sessão concluída + 10 quando a sessão é a
// primeira do dia e mantém a sequência (ontem também foi dia ativo).
export function xpDaSessao(bolas: number, inicio: number, anteriores: ResumoSessao[]): number {
  const ativos = diasAtivos(anteriores);
  const primeiraDoDia = !ativos.has(chaveDia(inicio));
  const ontemAtivo = ativos.has(chaveDia(somarDias(inicio, -1)));
  return bolas + XP_POR_SESSAO + (primeiraDoDia && ontemAtivo ? XP_POR_DIA_NA_SEQUENCIA : 0);
}

// Subir do nível n para o n+1 custa 100 × n XP.
export function nivel(xpTotal: number): { nivel: number; xpNoNivel: number; xpDoNivel: number } {
  let n = 1;
  let resto = Math.max(0, xpTotal);
  while (resto >= 100 * n) {
    resto -= 100 * n;
    n++;
  }
  return { nivel: n, xpNoNivel: resto, xpDoNivel: 100 * n };
}

// Semana de segunda a domingo.
export function inicioDaSemana(ts: number): number {
  const d = new Date(inicioDoDia(ts));
  const deslocamento = (d.getDay() + 6) % 7;
  return somarDias(d.getTime(), -deslocamento);
}

export function diasDaSemana(ativos: Set<string>, agora: number): boolean[] {
  const seg = inicioDaSemana(agora);
  return Array.from({ length: 7 }, (_, i) => ativos.has(chaveDia(somarDias(seg, i))));
}

export function bolasPorDia(sessoes: ResumoSessao[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessoes) m.set(chaveDia(s.inicio), (m.get(chaveDia(s.inicio)) ?? 0) + s.bolas);
  return m;
}

// Grade do mapa de calor: semanas em colunas, de segunda a domingo nas linhas.
export function mapaDeCalor(sessoes: ResumoSessao[], agora: number, semanas = 15): { chave: string; bolas: number; futuro: boolean }[][] {
  const porDia = bolasPorDia(sessoes);
  const primeira = somarDias(inicioDaSemana(agora), -7 * (semanas - 1));
  const hoje = inicioDoDia(agora);
  return Array.from({ length: semanas }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const dia = somarDias(primeira, w * 7 + d);
      const chave = chaveDia(dia);
      return { chave, bolas: porDia.get(chave) ?? 0, futuro: dia > hoje };
    }),
  );
}

export function intensidade(bolas: number): 0 | 1 | 2 | 3 {
  if (bolas <= 0) return 0;
  if (bolas < 30) return 1;
  if (bolas < 80) return 2;
  return 3;
}

export type IdConquista =
  | 'primeira_sessao'
  | 'bolas_100'
  | 'bolas_1000'
  | 'sequencia_3'
  | 'sequencia_7'
  | 'meta_semanal'
  | 'primeiro_treino'
  | 'parada_segura';

export const CONQUISTAS: { id: IdConquista; sigla: string; titulo: string; dica: string }[] = [
  { id: 'primeira_sessao', sigla: '1ª', titulo: 'Primeira sessão', dica: 'Conclua uma sessão' },
  { id: 'bolas_100', sigla: '100', titulo: '100 bolas', dica: 'Some 100 bolas estimadas' },
  { id: 'bolas_1000', sigla: '1k', titulo: '1 000 bolas', dica: 'Some 1 000 bolas estimadas' },
  { id: 'sequencia_3', sigla: '3d', titulo: '3 dias seguidos', dica: 'Treine 3 dias seguidos' },
  { id: 'sequencia_7', sigla: '7d', titulo: '7 dias seguidos', dica: 'Treine 7 dias seguidos' },
  { id: 'meta_semanal', sigla: 'META', titulo: 'Meta semanal batida', dica: 'Bata a meta de dias da semana' },
  { id: 'primeiro_treino', sigla: 'NEW', titulo: 'Primeiro treino criado', dica: 'Crie um treino em Treinos' },
  { id: 'parada_segura', sigla: 'STOP', titulo: 'Parada segura usada', dica: 'Parar também é treinar' },
];

// A maior sequência já alcançada, para as conquistas não sumirem quando a
// sequência atual quebra.
export function maiorSequencia(ativos: Set<string>): number {
  const dias = [...ativos].sort();
  let melhor = 0;
  let atual = 0;
  let anterior: string | null = null;
  for (const d of dias) {
    if (anterior) {
      const [a, m, dd] = anterior.split('-').map(Number);
      atual = chaveDia(new Date(a, m - 1, dd + 1).getTime()) === d ? atual + 1 : 1;
    } else {
      atual = 1;
    }
    melhor = Math.max(melhor, atual);
    anterior = d;
  }
  return melhor;
}

function algumaSemanaBateuMeta(ativos: Set<string>, meta: number): boolean {
  const porSemana = new Map<number, number>();
  for (const chave of ativos) {
    const [a, m, d] = chave.split('-').map(Number);
    const semana = inicioDaSemana(new Date(a, m - 1, d).getTime());
    porSemana.set(semana, (porSemana.get(semana) ?? 0) + 1);
  }
  return [...porSemana.values()].some((n) => n >= meta);
}

export function conquistasDesbloqueadas(
  sessoes: ResumoSessao[],
  ctx: { treinosCriados: number; metaSemanal: number },
): Set<IdConquista> {
  const ativos = diasAtivos(sessoes);
  const bolas = sessoes.reduce((t, s) => t + s.bolas, 0);
  const seq = maiorSequencia(ativos);
  const ids = new Set<IdConquista>();
  if (sessoes.length > 0) ids.add('primeira_sessao');
  if (bolas >= 100) ids.add('bolas_100');
  if (bolas >= 1000) ids.add('bolas_1000');
  if (seq >= 3) ids.add('sequencia_3');
  if (seq >= 7) ids.add('sequencia_7');
  if (ctx.metaSemanal > 0 && algumaSemanaBateuMeta(ativos, ctx.metaSemanal)) ids.add('meta_semanal');
  if (ctx.treinosCriados > 0) ids.add('primeiro_treino');
  if (sessoes.some((s) => s.paradaSegura)) ids.add('parada_segura');
  return ids;
}

export { DIA_MS };
