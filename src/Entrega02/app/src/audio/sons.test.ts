// Os bips da contagem não podem depender de um player que quebrou: no Android
// o ExoPlayer fica em "idle" depois de um erro (troca de rota de áudio) e todo
// play seguinte sai mudo.

type Falso = {
  id: number;
  estado: string;
  seekTo: jest.Mock;
  play: jest.Mock;
  remove: jest.Mock;
  readonly currentStatus: { playbackState: string };
};

const criados: Falso[] = [];

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  preload: jest.fn(async () => undefined),
  createAudioPlayer: jest.fn(() => {
    const p: Falso = {
      id: criados.length,
      estado: 'ready',
      seekTo: jest.fn(async () => undefined),
      play: jest.fn(),
      remove: jest.fn(),
      get currentStatus() {
        return { playbackState: p.estado };
      },
    };
    criados.push(p);
    return p;
  }),
}));

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// O módulo guarda estado (players e filas): cada teste carrega um novo.
async function carregar() {
  jest.resetModules();
  criados.length = 0;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.resetModules exige o require para recarregar o módulo com estado limpo.
  const sons = require('./sons') as typeof import('./sons');
  await sons.prepararAudio();
  return sons;
}


test('o primeiro bip de um player novo toca sem seekTo', async () => {
  const sons = await carregar();
  const [bip] = criados;
  sons.tocarBip('contagem');
  await espera(20);
  expect(bip.play).toHaveBeenCalledTimes(1);
  expect(bip.seekTo).not.toHaveBeenCalled();
});

test('um player quebrado (idle) é trocado por um novo e o bip toca', async () => {
  const sons = await carregar();
  const [bip] = criados;
  sons.tocarBip('contagem');
  await espera(250);
  bip.estado = 'idle'; // erro de reprodução no ExoPlayer
  sons.tocarBip('contagem');
  await espera(250);
  const novo = criados[criados.length - 1];
  expect(novo).not.toBe(bip);
  expect(bip.remove).toHaveBeenCalled();
  expect(novo.play).toHaveBeenCalledTimes(1);
});

test('um seekTo que nunca volta não trava a fila', async () => {
  const sons = await carregar();
  const [bip] = criados;
  sons.tocarBip('contagem');
  await espera(250);
  bip.seekTo.mockImplementation(() => new Promise(() => undefined));
  sons.tocarBip('contagem');
  await espera(800);
  const novo = criados[criados.length - 1];
  expect(novo).not.toBe(bip);
  expect(novo.play).toHaveBeenCalledTimes(1);
  // E os bips seguintes continuam tocando.
  sons.tocarBip('contagem');
  await espera(250);
  expect(novo.play).toHaveBeenCalledTimes(2);
});

test('renovarBips dá players novos à contagem e à partida', async () => {
  const sons = await carregar();
  const [bip, inicio, toque] = criados;
  const iniciais = criados.length;
  sons.renovarBips();
  expect(bip.remove).toHaveBeenCalled();
  expect(inicio.remove).toHaveBeenCalled();
  expect(toque.remove).not.toHaveBeenCalled();
  expect(criados).toHaveLength(iniciais + 2);
  sons.tocarBip('contagem');
  sons.tocarBip('inicio');
  await espera(20);
  expect(criados[iniciais].play).toHaveBeenCalledTimes(1);
  expect(criados[iniciais + 1].play).toHaveBeenCalledTimes(1);
  expect(bip.play).not.toHaveBeenCalled();
});


test('com os sinais sonoros desligados, só a contagem e a partida tocam', async () => {
  const sons = await carregar();
  sons.configurarBips(false);
  const [bip, inicio, toque, aviso, pausa, fim] = criados;
  for (const tipo of ['contagem', 'inicio', 'toque', 'aviso', 'pausa', 'fim'] as const) sons.tocarBip(tipo);
  await espera(20);
  expect(bip.play).toHaveBeenCalledTimes(1);
  expect(inicio.play).toHaveBeenCalledTimes(1);
  for (const p of [toque, aviso, pausa, fim]) expect(p.play).not.toHaveBeenCalled();
  sons.configurarBips(true);
  sons.tocarBip('aviso');
  await espera(20);
  expect(aviso.play).toHaveBeenCalledTimes(1);
});

test('os avisos do fim da série se curam como a contagem', async () => {
  const sons = await carregar();
  const aviso = criados[3];
  sons.tocarBip('aviso');
  await espera(250);
  aviso.estado = 'idle';
  sons.tocarBip('aviso');
  await espera(250);
  const novo = criados[criados.length - 1];
  expect(novo).not.toBe(aviso);
  expect(novo.play).toHaveBeenCalledTimes(1);
  // E podem ser renovados de propósito, sem mexer na contagem.
  sons.renovarBips(['aviso', 'fim']);
  expect(novo.remove).toHaveBeenCalled();
  expect(criados[0].remove).not.toHaveBeenCalled();
});
