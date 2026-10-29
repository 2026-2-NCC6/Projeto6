import {
  conquistasDesbloqueadas,
  diasDaSemana,
  diasAtivos,
  maiorSequencia,
  nivel,
  sequencia,
  xpDaSessao,
  type ResumoSessao,
} from './gamificacao';

const dia = (a: number, m: number, d: number, h = 18) => new Date(a, m - 1, d, h).getTime();
const sessao = (ts: number, bolas = 20, paradaSegura = false): ResumoSessao => ({ inicio: ts, bolas, xp: 0, paradaSegura });

describe('sequencia', () => {
  it('conta dias ativos consecutivos até hoje', () => {
    const ativos = diasAtivos([sessao(dia(2026, 10, 20)), sessao(dia(2026, 10, 21)), sessao(dia(2026, 10, 22))]);
    expect(sequencia(ativos, dia(2026, 10, 22, 20))).toBe(3);
  });

  it('mantém a sequência de ontem enquanto hoje não teve sessão', () => {
    const ativos = diasAtivos([sessao(dia(2026, 10, 20)), sessao(dia(2026, 10, 21))]);
    expect(sequencia(ativos, dia(2026, 10, 22, 9))).toBe(2);
  });

  it('zera quando um dia fica sem sessão', () => {
    const ativos = diasAtivos([sessao(dia(2026, 10, 19))]);
    expect(sequencia(ativos, dia(2026, 10, 22))).toBe(0);
  });

  it('atravessa a virada do mês', () => {
    const ativos = diasAtivos([sessao(dia(2026, 9, 30)), sessao(dia(2026, 10, 1))]);
    expect(sequencia(ativos, dia(2026, 10, 1))).toBe(2);
    expect(maiorSequencia(ativos)).toBe(2);
  });
});

describe('xpDaSessao', () => {
  it('soma bolas e bônus de sessão', () => {
    expect(xpDaSessao(30, dia(2026, 10, 22), [])).toBe(50);
  });

  it('dá bônus de sequência na primeira sessão do dia se ontem foi ativo', () => {
    expect(xpDaSessao(100, dia(2026, 10, 22), [sessao(dia(2026, 10, 21))])).toBe(130);
  });

  it('não repete o bônus de sequência na segunda sessão do dia', () => {
    const anteriores = [sessao(dia(2026, 10, 21)), sessao(dia(2026, 10, 22, 8))];
    expect(xpDaSessao(10, dia(2026, 10, 22), anteriores)).toBe(30);
  });
});

describe('nivel', () => {
  it('começa no nível 1', () => {
    expect(nivel(0)).toEqual({ nivel: 1, xpNoNivel: 0, xpDoNivel: 100 });
  });

  it('subir de n para n+1 custa 100 × n', () => {
    expect(nivel(100).nivel).toBe(2);
    expect(nivel(299)).toEqual({ nivel: 2, xpNoNivel: 199, xpDoNivel: 200 });
    expect(nivel(300).nivel).toBe(3);
  });
});

describe('diasDaSemana', () => {
  it('vai de segunda a domingo', () => {
    // 22/10/2026 é quinta-feira
    const ativos = diasAtivos([sessao(dia(2026, 10, 19)), sessao(dia(2026, 10, 22))]);
    expect(diasDaSemana(ativos, dia(2026, 10, 22))).toEqual([true, false, false, true, false, false, false]);
  });
});

describe('conquistasDesbloqueadas', () => {
  it('libera as conquistas a partir das sessões', () => {
    const sessoes = [sessao(dia(2026, 10, 20), 60), sessao(dia(2026, 10, 21), 60, true), sessao(dia(2026, 10, 22), 10)];
    const ids = conquistasDesbloqueadas(sessoes, { treinosCriados: 0, metaSemanal: 3 });
    expect([...ids].sort()).toEqual(['bolas_100', 'meta_semanal', 'parada_segura', 'primeira_sessao', 'sequencia_3']);
  });

  it('sem sessões, só o treino criado conta', () => {
    expect([...conquistasDesbloqueadas([], { treinosCriados: 1, metaSemanal: 4 })]).toEqual(['primeiro_treino']);
  });
});
