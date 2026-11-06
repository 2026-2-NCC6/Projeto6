// Interpretação da fala transcrita em comandos (PRD §8; ADR 0005).
//
// A palavra de ativação é um prefixo procurado no texto. Ela vale na mesma fala
// ("nock, liga") ou abre a janela de comando para a fala seguinte ("nock" ...
// "liga"). A emergência é a única exceção: vale sempre, sem prefixo.
//
// O reconhecedor pode devolver até três transcrições alternativas para a mesma
// fala. A melhor hipótese é a primária; as alternativas só podem PARAR a
// máquina (emergência/desliga/pausa). Assim a precisão melhora no lado seguro
// sem risco de um "liga" falso vindo de uma hipótese pior.

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

// Como o reconhecedor escreve "Nock" quando o motor está ligado e a fala sai
// abafada. Valem só para PARAR (desliga/pausa): "não desliga" vira parada, mas
// "não liga" nunca liga. Parar sem precisar é seguro; não parar não é.
const VARIANTES_NOCK_PARADA = ['nao', 'no', 'nokia', 'noquia', 'noquio', 'nuk', 'nuck', 'nhoque', 'nhoc', 'nog', 'noh'];

// "des liga", "dis liga": o reconhecedor às vezes corta "desliga" ao meio, e a
// metade "liga" sozinha seria lida como LIGAR.
const PREFIXOS_PARTIDOS = new Set(['des', 'dis', 'dez', 'diz']);

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

// Comando de UMA palavra. Qualquer forma de "deslig..." é desligar ("desligá",
// "desligaa", "desligando"), menos "desligado/desligada", que o próprio app
// fala depois de desligar.
function comandoDoTermo(termo: string): Comando | null {
  for (const [comando, termos] of TERMOS) {
    if (termos.includes(termo)) return comando;
  }
  if (/^d[ei]slig/.test(termo) && !/^d[ei]sligad/.test(termo)) return 'desligar';
  return null;
}

// Tokens da fala com "des liga" remontado em "desliga".
function tokensDeComando(texto: string): string[] {
  const tokens = normalizar(texto).split(' ');
  const saida: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const prox = tokens[i + 1];
    if (PREFIXOS_PARTIDOS.has(tokens[i]) && prox && comandoDoTermo(prox) === 'ligar') {
      saida.push('desliga');
      i++;
    } else {
      saida.push(tokens[i]);
    }
  }
  return saida;
}

export function encontrarComando(texto: string): Comando | null {
  const achados = new Set(tokensDeComando(texto).map(comandoDoTermo));
  return PRIORIDADE.find((c) => achados.has(c)) ?? null;
}

// Grafias de uma palavra só que podem vir grudadas no comando ("nokdesliga").
function prefixosDeAtivacao(alvo: string, paraParar: boolean): string[] {
  if (alvo !== 'nock') return [alvo];
  const variantes = VARIANTES_NOCK.map(normalizar).filter((v) => !v.includes(' '));
  return paraParar ? [...variantes, ...VARIANTES_NOCK_PARADA] : variantes;
}

// "nockliga" (a ativação grudada no comando) também vale. Só a palavra e as
// grafias conhecidas de "Nock"; as grafias frouxas só para parar.
export function encontrarComandoColado(texto: string, palavra: string): Comando | null {
  const alvo = normalizar(palavra);
  if (!alvo || alvo.includes(' ')) return null;
  const achados = new Set<Comando>();
  for (const token of normalizar(texto).split(' ')) {
    for (const prefixo of prefixosDeAtivacao(alvo, true)) {
      if (!token.startsWith(prefixo) || token.length <= prefixo.length) continue;
      const c = comandoDoTermo(token.slice(prefixo.length));
      const frouxo = !prefixosDeAtivacao(alvo, false).includes(prefixo);
      if (c && (!frouxo || PARADAS.has(c))) achados.add(c);
    }
  }
  return PRIORIDADE.find((c) => achados.has(c)) ?? null;
}

// Ativação mais tolerante, só para desliga/pausa: as grafias abafadas de
// "Nock" (inclusive "não") e uma letra de diferença em qualquer palavra de 3
// letras ou mais ("nick", "rock" para "Nock").
export function contemAtivacaoParaParar(texto: string, palavra: string): boolean {
  if (contemAtivacao(texto, palavra)) return true;
  const alvo = normalizar(palavra);
  if (!alvo || alvo.includes(' ')) return false;
  const tokens = normalizar(texto).split(' ');
  if (alvo === 'nock' && tokens.some((tk) => VARIANTES_NOCK_PARADA.includes(tk))) return true;
  return alvo.length >= 3 && tokens.some((tk) => tk.length >= 3 && distancia(tk, alvo) <= 1);
}

const ordem = (c: Comando | null) => (c ? PRIORIDADE.indexOf(c) : PRIORIDADE.length);

export function interpretar(texto: string, palavra: string, janelaAberta: boolean): Interpretacao {
  const colado = encontrarComandoColado(texto, palavra);
  const solto = encontrarComando(texto);
  const comando = [solto, colado].sort((a, b) => ordem(a) - ordem(b))[0];
  const temAtivacao = contemAtivacao(texto, palavra) || colado !== null;

  if (comando === 'emergencia') return { tipo: 'comando', comando, ativada: temAtivacao || janelaAberta };
  if (!comando) return temAtivacao ? { tipo: 'ativacao' } : { tipo: 'ignorado', motivo: 'nao_entendi' };
  if (!temAtivacao && !janelaAberta) {
    // Desliga/pausa com um "Nock" mal transcrito ainda param a máquina.
    if (PARADAS.has(comando) && contemAtivacaoParaParar(texto, palavra)) return { tipo: 'comando', comando, ativada: true };
    return { tipo: 'ignorado', motivo: 'sem_ativacao' };
  }
  return { tipo: 'comando', comando, ativada: true };
}

// Parada (emergência, desliga, pausa): o comando que sai no resultado parcial,
// sem esperar pausa na fala.
export function ehParada(escolha: Escolha): boolean {
  return escolha.resultado.tipo === 'comando' && PARADAS.has(escolha.resultado.comando);
}

// Quantas vezes o comando aparece na fala (solto ou grudado na ativação).
function ocorrencias(texto: string, comando: Comando, palavra: string): number {
  const tokens = tokensDeComando(texto);
  return tokens.filter((t) => comandoDoTermo(t) === comando || encontrarComandoColado(t, palavra) === comando).length;
}

// O reconhecedor reescreveu palavras já tratadas (revisão do parcial). O
// trecho revisto pode repetir uma fala já atendida, então dele só sai parada,
// e só se ela for nova: mais ocorrências do comando do que no texto que a
// revisão substituiu. "Nock liga" reescrito como "knock liga" não liga de novo;
// um ruído já tratado reescrito como "nock desliga" para a máquina.
export function filtrarRevisao(escolha: Escolha, substituido: string, palavra: string): Escolha {
  const r = escolha.resultado;
  if (r.tipo === 'ativacao') return escolha;
  const nova = r.tipo === 'comando' && PARADAS.has(r.comando) && ocorrencias(escolha.texto, r.comando, palavra) > ocorrencias(substituido, r.comando, palavra);
  return nova ? escolha : { resultado: { tipo: 'ignorado', motivo: 'nao_entendi' }, texto: escolha.texto };
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
// As frases inteiras de parada ajudam o reconhecedor a ouvir "Nock desliga"
// por cima do motor; as de ligar ficam de fora para não puxar um "liga" falso.
export function termosDeContexto(palavra: string): string[] {
  const frasesDeParada = ['desliga', 'para', 'pausa'].map((t) => `${palavra} ${t}`);
  return [...new Set([palavra, ...frasesDeParada, ...TERMOS.flatMap(([, termos]) => termos), ...VARIANTES_NOCK])].filter(Boolean);
}

export const JANELA_DE_COMANDO_MS = 5000;
