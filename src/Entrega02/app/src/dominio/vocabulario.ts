// Interpretação da fala transcrita em comandos (PRD §8; ADR 0005).
//
// A palavra de ativação é um prefixo procurado no texto. Ela vale na mesma fala
// ("nock, liga") ou abre a janela de comando para a fala seguinte ("nock" ...
// "liga"). A emergência é a única exceção: vale sempre, sem prefixo.

export type Comando = 'ligar' | 'desligar' | 'pausar' | 'retomar' | 'emergencia';

export type Interpretacao =
  | { tipo: 'comando'; comando: Comando }
  | { tipo: 'ativacao' }
  | { tipo: 'ignorado'; motivo: 'sem_ativacao' | 'nao_entendi' };

// Ordem = prioridade. Diante de ambiguidade vence o lado seguro: "desligar"
// contém "ligar", e uma frase com os dois resulta em desligar (autômato M2).
const TERMOS: [Comando, string[]][] = [
  ['emergencia', ['para', 'pare', 'parar', 'emergencia', 'socorro']],
  ['desligar', ['desliga', 'desligar', 'desligue', 'apaga', 'apagar', 'off']],
  ['pausar', ['pausa', 'pausar', 'pause', 'espera', 'esperar']],
  ['retomar', ['retoma', 'retomar', 'retome', 'continua', 'continuar', 'continue']],
  ['ligar', ['liga', 'ligar', 'ligue', 'acende', 'acender', 'on', 'comeca', 'comecar']],
];

// Como o reconhecedor costuma escrever "Nock".
const VARIANTES_NOCK = ['nock', 'nok', 'noc', 'nóc', 'knock', 'noque', 'nook', 'nóqui', 'noki'];

// Nomes de assistentes comerciais disparam outros aparelhos por perto.
const PROIBIDAS = ['alexa', 'siri', 'google', 'ok google', 'hey google', 'hey siri', 'bixby', 'cortana'];

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function palavraDeAtivacaoValida(palavra: string): { ok: true } | { ok: false; motivo: string } {
  const p = normalizar(palavra);
  if (p.length < 3) return { ok: false, motivo: 'Use pelo menos 3 letras.' };
  if (p.split(' ').length > 2) return { ok: false, motivo: 'Use no máximo duas palavras.' };
  if (PROIBIDAS.includes(p)) {
    return { ok: false, motivo: 'Nomes de assistentes (Alexa, Siri, Ok Google) acionam outros aparelhos por perto.' };
  }
  const tokens = p.split(' ');
  if (TERMOS.some(([, termos]) => tokens.some((t) => termos.includes(t)))) {
    return { ok: false, motivo: 'A palavra não pode ser um dos comandos.' };
  }
  return { ok: true };
}

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

// Aceita pequenas variações de transcrição: uma letra de diferença em palavras
// de 5 letras ou mais, e as grafias conhecidas de "Nock".
export function contemAtivacao(texto: string, palavra: string): boolean {
  const alvo = normalizar(palavra);
  const t = normalizar(texto);
  if (!alvo) return false;
  if (` ${t} `.includes(` ${alvo} `)) return true;
  const tokens = t.split(' ');
  if (alvo === 'nock' && tokens.some((tk) => VARIANTES_NOCK.map(normalizar).includes(tk))) return true;
  if (!alvo.includes(' ') && alvo.length >= 5) return tokens.some((tk) => distancia(tk, alvo) <= 1);
  return false;
}

export function encontrarComando(texto: string): Comando | null {
  const tokens = normalizar(texto).split(' ');
  for (const [comando, termos] of TERMOS) {
    if (tokens.some((t) => termos.includes(t))) return comando;
  }
  return null;
}

export function interpretar(texto: string, palavra: string, janelaAberta: boolean): Interpretacao {
  const comando = encontrarComando(texto);
  if (comando === 'emergencia') return { tipo: 'comando', comando };

  const temAtivacao = contemAtivacao(texto, palavra);
  if (!comando) return temAtivacao ? { tipo: 'ativacao' } : { tipo: 'ignorado', motivo: 'nao_entendi' };
  if (!temAtivacao && !janelaAberta) return { tipo: 'ignorado', motivo: 'sem_ativacao' };
  return { tipo: 'comando', comando };
}

// Termos que ajudam o reconhecedor a acertar (contextualStrings).
export function termosDeContexto(palavra: string): string[] {
  return [palavra, ...TERMOS.flatMap(([, termos]) => termos.slice(0, 2))];
}

export const JANELA_DE_COMANDO_MS = 5000;
