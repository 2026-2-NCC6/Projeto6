// Interpretação da fala transcrita em comandos (PRD §8; ADR 0005).
//
// A palavra de ativação é um prefixo procurado no texto. Ela vale na mesma fala
// ("nock, liga") ou abre a janela de comando para a fala seguinte ("nock" ...
// "liga"). A emergência é a única exceção: vale sempre, sem prefixo.
//
// O reconhecedor pode devolver até três transcrições alternativas para a mesma
// fala. A melhor hipótese é a primária; as alternativas só podem PARAR a
// máquina (emergência/desliga/pausa). Assim a precisão melhora no lado seguro
// sem risk de um "liga" falso vindo de uma hipótese pior.

export type Comando = 'ligar' | 'desligar' | 'pausar' | 'retomar' | 'emergencia';

export type Interpretacao =
  | { tipo: 'comando'; comando: Comando; ativada: boolean }
  | { tipo: 'ativacao' }
  | { tipo: 'ignorado'; motivo: 'sem_ativacao' | 'nao_entendi' };

export type Escolha = { resultado: Interpretacao; texto: string };

// Ordem = prioridade. Diante de ambiguidade vence o lado seguro: "desligar"
// contém "ligar", e uma frase com os dois resulta em desligar (autômato M2).
const TERMOS: [Comando, string[]][] = [
  ['emergencia', ['para', 'pare', 'parar', 'emergencia', 'socorro', 'stop']],
  ['desligar', ['desliga', 'disliga', 'desligar', 'desligue', 'apaga', 'apagar', 'off']],
  ['pausar', ['pausa', 'pausar', 'pause', 'espera', 'esperar']],
  ['retomar', ['retoma', 'retomar', 'retome', 'continua', 'continuar', 'continue']],
  ['ligar', ['liga', 'ligah', 'ligar', 'ligue', 'acende', 'acender', 'on', 'comeca', 'comecar']],
];

// Só estas podem vir de uma transcrição alternativa: errar para o lado de
// parar é seguro; errar para o lado de ligar não é.
const PARADAS = new Set<Comando>(['emergencia', 'desligar', 'pausar']);

export const PRIORIDADE: Comando[] = ['emergencia', 'desligar', 'pausar', 'retomar', 'ligar'];

// Como o reconhecedor costuma escrever "Nock".
const VARIANTES_NOCK = ['nock', 'nok', 'noc', 'nóc', 'knock', 'noque', 'nook', 'nóqui', 'noki', 'nocki', 'nockhug', 'nock hug', 'nok hug'];

// Nomes de assistentes comerciais disparam outros aparelhos por perto.
const PROIBIDAS = ['alexa', 'siri', 'google', 'ok google', 'hey google', 'hey siri', 'bixby', 'cortana'];

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
  // Palavra de duas palavras: procura a sequência inteira.
  if (alvo.includes(' ')) return false;
  const tokens = t.split(' ');
  if (alvo === 'nock' && tokens.some((tk) => VARIANTES_NOCK.map(normalizar).includes(tk))) return true;
  if (alvo.length >= 5) return tokens.some((tk) => distancia(tk, alvo) <= 1);
  return false;
}

export function encontrarComando(texto: string): Comando | null {
  const tokens = normalizar(texto).split(' ');
  for (const [comando, termos] of TERMOS) {
    if (tokens.some((t) => termos.includes(t))) return comando;
  }
  return null;
}

// "nockliga" (a ativação grudada no comando) também vale.
export function encontrarComandoColado(texto: string, palavra: string): Comando | null {
  const alvo = normalizar(palavra);
  if (!alvo || alvo.includes(' ')) return null;
  for (const token of normalizar(texto).split(' ')) {
    if (!token.startsWith(alvo) || token.length <= alvo.length) continue;
    const resto = token.slice(alvo.length);
    for (const [comando, termos] of TERMOS) {
      if (termos.includes(resto)) return comando;
    }
  }
  return null;
}

export function interpretar(texto: string, palavra: string, janelaAberta: boolean): Interpretacao {
  const colado = encontrarComandoColado(texto, palavra);
  const comando = encontrarComando(texto) ?? colado;
  const temAtivacao = contemAtivacao(texto, palavra) || colado !== null;

  if (comando === 'emergencia') return { tipo: 'comando', comando, ativada: temAtivacao || janelaAberta };
  if (!comando) return temAtivacao ? { tipo: 'ativacao' } : { tipo: 'ignorado', motivo: 'nao_entendi' };
  if (!temAtivacao && !janelaAberta) return { tipo: 'ignorado', motivo: 'sem_ativacao' };
  return { tipo: 'comando', comando, ativada: true };
}

// Escolhe entre a transcrição primária e as alternativas do reconhecedor.
// A primária pode dar qualquer comando; as alternativas só valem para parar.
export function escolherInterpretacao(textos: string[], palavra: string, janelaAberta: boolean): Escolha {
  const lista = textos.filter(Boolean);
  if (lista.length === 0) return { resultado: { tipo: 'ignorado', motivo: 'nao_entendi' }, texto: '' };

  const avaliadas = lista.map((texto) => ({ texto, resultado: interpretar(texto, palavra, janelaAberta) }));
  const primaria = avaliadas[0];
  const comandos = avaliadas.filter((x): x is { texto: string; resultado: Extract<Interpretacao, { tipo: 'comando' }> } => x.resultado.tipo === 'comando');

  // Uma parada em qualquer hipótese vence: o pior caso é parar sem precisar.
  // Mas uma emergência SEM ativação vinda só de uma alternativa não pode
  // transformar um "desliga" reversível em PARADA_SEGURA. Se a principal não
  // deu comando (ou já é emergência), a alternativa ainda vale: é o "Para!"
  // que o reconhecedor pode ter jogado para a segunda hipótese.
  const comandoPrimario = primaria.resultado.tipo === 'comando' ? primaria.resultado.comando : null;
  const emergenciaAlternativaVale = comandoPrimario === null || comandoPrimario === 'emergencia';
  const paradas = comandos.filter((x) => {
    if (!PARADAS.has(x.resultado.comando)) return false;
    if (x.texto === primaria.texto) return true;
    if (x.resultado.comando === 'emergencia' && !x.resultado.ativada && !emergenciaAlternativaVale) return false;
    return true;
  });
  if (paradas.length) {
    paradas.sort((a, b) => PRIORIDADE.indexOf(a.resultado.comando) - PRIORIDADE.indexOf(b.resultado.comando));
    return paradas[0];
  }

  // O comando da hipótese principal (mesmo que seja de ligar).
  if (primaria.resultado.tipo === 'comando') return primaria;

  // Sem comando na primária, uma ativação ainda abre a janela; o comando da
  // alternativa que ligaria fica para a próxima fala.
  const ativacao = avaliadas.find((x) => x.resultado.tipo === 'ativacao');
  return ativacao ?? primaria;
}

// Termos que ajudam o reconhecedor a acertar (contextualStrings).
export function termosDeContexto(palavra: string): string[] {
  return [...new Set([palavra, ...TERMOS.flatMap(([, termos]) => termos), ...VARIANTES_NOCK])].filter(Boolean);
}

export const JANELA_DE_COMANDO_MS = 5000;
