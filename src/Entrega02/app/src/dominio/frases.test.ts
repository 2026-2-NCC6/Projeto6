// O app ouve a própria voz: nenhuma frase falada pode virar comando, nem com
// a palavra de ativação dita logo antes pelo praticante.

import { readFileSync } from 'fs';
import { join } from 'path';
import { duracaoFalada, FRASE, fraseFaltaDescanso, fraseFimSerie, fraseInicioSerie, fraseSegura } from './frases';

// Todas as frases que as funções podem montar, nos limites dos treinos.
function frasesGeradas(): string[] {
  const out: string[] = [...Object.values(FRASE)];
  for (let total = 1; total <= 10; total++) {
    for (let n = 1; n <= total; n++) {
      out.push(fraseInicioSerie(n, total));
      for (let descansoS = 10; descansoS <= 120; descansoS += 5) {
        for (const motivo of ['serie_concluida', 'desligar'] as const) {
          for (const autoRetomar of [true, false]) out.push(fraseFimSerie({ n, total, bolas: 12, motivo, descansoS, autoRetomar }));
        }
      }
    }
  }
  for (let n = 1; n <= 20; n++) {
    out.push(fraseInicioSerie(n, null));
    for (const bolas of [0, 1, 7, 60]) out.push(fraseFimSerie({ n, total: null, bolas, motivo: 'desligar', descansoS: 30, autoRetomar: false }));
  }
  for (let s = 1; s <= 120; s++) out.push(fraseFaltaDescanso(s));
  return [...new Set(out)];
}

// Literais que vão para a voz (ou para o leitor de tela, que também fala) em
// sessao.ts, usePartida.ts e nos títulos de falha. O corpo das falhas e o
// detalhe técnico só aparecem na tela.
function literaisFalados(): string[] {
  const raiz = join(__dirname, '..');
  const arquivos = ['sessao/sessao.ts', 'sessao/usePartida.ts', 'sessao/useAvisos.ts', 'lancadora/falhas.ts'];
  const out: string[] = [];
  for (const a of arquivos) {
    for (const linha of readFileSync(join(raiz, a), 'utf8').split('\n')) {
      if (/^\s*\/\//.test(linha) || /\b(corpo|tecnico|erro):/.test(linha)) continue;
      for (const m of linha.matchAll(/'([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^'\n]* [^'\n]*)'/g)) out.push(m[1]);
    }
  }
  return out;
}

// Uma palavra de ativação que aparece numa frase ("Bola" e "1 bola") faz a
// frase ficar só na tela: é o fraseSegura na hora de falar que cuida disso.
const PALAVRAS = ['Nock', 'Quadra', 'Jarvis'];

test('nenhuma frase gerada contém "para", "pare", "socorro" ou um comando', () => {
  const frases = frasesGeradas();
  expect(frases.length).toBeGreaterThan(1000);
  for (const palavra of PALAVRAS) {
    const ruins = frases.filter((f) => !fraseSegura(f, palavra));
    expect(ruins).toEqual([]);
  }
  for (const f of frases) expect(f).not.toMatch(/\b(para|pare|socorro)\b/i);
});

test('os literais falados nos arquivos da sessão também são seguros', () => {
  const literais = literaisFalados();
  expect(literais.length).toBeGreaterThan(15);
  expect(literais.filter((f) => !fraseSegura(f, 'Nock'))).toEqual([]);
});

test('fraseSegura recusa o que o microfone tomaria por comando', () => {
  expect(fraseSegura('Nada para cancelar')).toBe(false);
  expect(fraseSegura('Pare agora')).toBe(false);
  expect(fraseSegura('Pausa iniciada')).toBe(false); // "Nock" + "pausa iniciada" pausaria
  expect(fraseSegura('Espera um pouco')).toBe(false);
  expect(fraseSegura('Pode continuar')).toBe(false);
  expect(fraseSegura('Diga Nock, desliga')).toBe(false);
  expect(fraseSegura('Diga Nock')).toBe(false); // abriria a janela de comando
  expect(fraseSegura('Série 1 encerrada. 1 bola', 'Bola')).toBe(false);
  expect(fraseSegura('Série pausada')).toBe(true);
  expect(fraseSegura('Parada segura')).toBe(true);
});

test('as transições têm frases curtas e no mesmo formato', () => {
  expect(fraseInicioSerie(3, 5)).toBe('Série 3 de 5');
  expect(fraseInicioSerie(2, null)).toBe('Série 2');
  expect(fraseFimSerie({ n: 2, total: 5, bolas: 12, motivo: 'serie_concluida', descansoS: 30, autoRetomar: true })).toBe('Série 2 de 5 concluída. Descanso de 30 segundos');
  expect(fraseFimSerie({ n: 2, total: 5, bolas: 7, motivo: 'desligar', descansoS: 30, autoRetomar: false })).toBe('Série 2 de 5 encerrada. Descanso de 30 segundos, sem retomada automática');
  expect(fraseFimSerie({ n: 5, total: 5, bolas: 12, motivo: 'serie_concluida', descansoS: 30, autoRetomar: true })).toBe('Série 5 de 5 concluída. Treino concluído');
  expect(fraseFimSerie({ n: 3, total: null, bolas: 1, motivo: 'desligar', descansoS: 30, autoRetomar: false })).toBe('Série 3 encerrada. 1 bola');
  expect(fraseFaltaDescanso(10)).toBe('Faltam 10 segundos de descanso');
});

test('durações faladas por extenso nas unidades certas', () => {
  expect(duracaoFalada(1)).toBe('1 segundo');
  expect(duracaoFalada(45)).toBe('45 segundos');
  expect(duracaoFalada(60)).toBe('1 minuto');
  expect(duracaoFalada(90)).toBe('1 minuto e 30 segundos');
  expect(duracaoFalada(120)).toBe('2 minutos');
  expect(duracaoFalada(61)).toBe('1 minuto e 1 segundo');
});
