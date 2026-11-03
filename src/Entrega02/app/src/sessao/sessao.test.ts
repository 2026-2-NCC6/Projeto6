// A sessão contra a lançadora simulada: a contagem de 5 s antes de qualquer
// partida, o cancelamento por voz e o ajuste do descanso.

import { CONTAGEM_MS } from '@/dominio/partida';
import type { Treino } from '@/dominio/tipos';
import { velocidadeDoPreset } from '@/dominio/velocidade';
import { useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import { TOKEN_SIMULADOR } from '@/lancadora/simulador';
import { useSessao } from './sessao';

jest.mock('@/dados/repositorio', () => ({ repositorio: {} }));
jest.mock('@/lancadora/ble', () => ({ TransporteBle: class {} }));

const TREINO: Treino = {
  id: 'teste',
  nome: 'Teste',
  bolasPorSerie: 5,
  series: 3,
  descansoS: 30,
  padrao: false,
  velocidade: velocidadeDoPreset('medio'),
};

async function sessaoArmada(treino = TREINO) {
  await useLancadora.getState().conectar({ tipo: 'wifi', token: TOKEN_SIMULADOR, nome: 'sim', simulado: true });
  useSessao.getState().descartar();
  const r = await useSessao.getState().armar(treino);
  expect(r.ok).toBe(true);
}

// A série termina pelas próprias bolas: a máquina volta a ARMADO e o status
// diz "serie_concluida" (a simulada levaria 15 s; aqui o status é montado).
async function fimDeSerie() {
  const r = await useLancadora.getState().enviar('desligar');
  useSessao.getState().aoStatus({ ...r.status!, estado: 'ARMADO', motivo: 'serie_concluida', bolasEstimadas: 5, bolasAlvo: 5 });
}

afterEach(async () => {
  useSessao.getState().descartar();
  await useLancadora.getState().desconectar();
});

test('"liga" não liga na hora: agenda a contagem de 5 s', async () => {
  await sessaoArmada();
  const antes = Date.now();
  const r = await useSessao.getState().executar('ligar', 'voz', 'nock liga');
  expect(r.aceito).toBe(true);
  expect(r.silencioso).toBe(true);
  const p = useSessao.getState().partida;
  expect(p?.comando).toBe('ligar');
  expect(p!.em - antes).toBeGreaterThanOrEqual(CONTAGEM_MS - 50);
  expect(useLancadora.getState().status?.estado).toBe('ARMADO');
});

test('a contagem dispara o comando e os motores ligam', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'botao');
  const r = await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  expect(r.aceito).toBe(true);
  expect(useLancadora.getState().status?.estado).toBe('LANCANDO');
  expect(useSessao.getState().fase).toBe('lancando');
  expect(useSessao.getState().partida).toBeNull();
});

test('"Nock, desliga" e "Nock, para" cancelam a contagem sem ir à lançadora', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  const d = await useSessao.getState().executar('desligar', 'voz', 'nock desliga');
  expect(d.aceito).toBe(true);
  expect(useSessao.getState().partida).toBeNull();

  await useSessao.getState().executar('ligar', 'voz');
  const id = useSessao.getState().partida!.id;
  await useSessao.getState().executar('emergencia', 'voz', 'nock para', true);
  expect(useSessao.getState().partida).toBeNull();
  expect(useLancadora.getState().status?.estado).toBe('ARMADO');
  // A contagem cancelada não dispara mais.
  expect((await useSessao.getState().dispararPartida(id)).aceito).toBe(false);
  expect(useLancadora.getState().status?.estado).toBe('ARMADO');
});

test('"Para!" sem a palavra de ativação é emergência de verdade', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  const r = await useSessao.getState().executar('emergencia', 'voz', 'para', false);
  expect(r.aceito).toBe(true);
  expect(useSessao.getState().partida).toBeNull();
  expect(useLancadora.getState().status?.estado).toBe('PARADA_SEGURA');
});

test('um segundo "liga" durante a contagem não reinicia nem duplica', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  const p = useSessao.getState().partida;
  const r = await useSessao.getState().executar('ligar', 'voz');
  expect(r.aceito).toBe(false);
  expect(useSessao.getState().partida).toEqual(p);
});

test('"retoma" depois da pausa também passa pela contagem', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  expect((await useSessao.getState().executar('pausar', 'voz')).aceito).toBe(true);
  expect(useLancadora.getState().status?.estado).toBe('PAUSADO');
  await useSessao.getState().executar('retomar', 'voz');
  expect(useSessao.getState().partida?.comando).toBe('retomar');
  expect(useLancadora.getState().status?.estado).toBe('PAUSADO');
  await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  expect(useLancadora.getState().status?.estado).toBe('LANCANDO');
});

test('"desliga" com um "retoma" agendado cancela e também encerra a série pausada', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  await useSessao.getState().executar('pausar', 'voz');
  await useSessao.getState().executar('retomar', 'voz');
  await useSessao.getState().executar('desligar', 'voz');
  expect(useSessao.getState().partida).toBeNull();
  expect(useLancadora.getState().status?.estado).toBe('ARMADO');
});

test('o descanso pode ser ajustado fora do descanso e vale para o próximo', async () => {
  await sessaoArmada();
  useSessao.getState().ajustarDescanso(10);
  expect(useSessao.getState().treino?.descansoS).toBe(40);
  useSessao.getState().ajustarDescanso(-1000);
  expect(useSessao.getState().treino?.descansoS).toBe(10);
});

test('fim de série abre o descanso com a retomada agendada para o fim dele', async () => {
  await useApp.setState({ config: { ...useApp.getState().config, retomarSozinho: true } });
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  await fimDeSerie();
  const st = useSessao.getState();
  expect(st.fase).toBe('descanso');
  expect(st.series).toHaveLength(1);
  expect(st.partida?.origem).toBe('descanso');
  expect(st.partida?.em).toBe(st.descansoAte);

  // Mudar o descanso no meio move a retomada junto.
  useSessao.getState().ajustarDescanso(10);
  expect(useSessao.getState().partida?.em).toBe(useSessao.getState().descansoAte);

  // "Pular descanso" antecipa para 5 s, com contagem.
  const agora = Date.now();
  await useSessao.getState().executar('ligar', 'botao');
  const p = useSessao.getState().partida!;
  expect(p.origem).toBe('pedido');
  expect(p.em - agora).toBeLessThanOrEqual(CONTAGEM_MS + 50);
  expect(useSessao.getState().fase).toBe('pronta');
});

test('"desliga" no descanso cancela a retomada automática', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  await fimDeSerie();
  await useSessao.getState().executar('desligar', 'voz', 'nock desliga');
  const st = useSessao.getState();
  expect(st.fase).toBe('descanso');
  expect(st.partida).toBeNull();
  expect(st.autoRetomar).toBe(false);
  expect(st.motivoSemRetomada).toBe('cancelada');
});

test('armar com a lançadora presa numa série anterior repara sozinho e arma', async () => {
  await useLancadora.getState().conectar({ tipo: 'wifi', token: TOKEN_SIMULADOR, nome: 'sim', simulado: true });
  // Sessão anterior deixou a máquina pausada (o watchdog, com a tela apagada).
  await useLancadora.getState().enviar('armar');
  await useLancadora.getState().enviar('ligar', { bolas: 10, velocidade: TREINO.velocidade });
  await useLancadora.getState().enviar('pausar');
  // O armar do setup ocupa o relógio de 1 s dessa op. Sem a espera, o armar
  // da sessão seria 429 (limite) em vez de 409 (máquina pausada).
  await new Promise((resolve) => setTimeout(resolve, 1100));
  useSessao.getState().descartar();
  const r = await useSessao.getState().armar(TREINO);
  expect(r.ok).toBe(true);
  expect(useLancadora.getState().status?.estado).toBe('ARMADO');
});

test('um "liga" com a retomada automática já bipando não reinicia a contagem', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  await fimDeSerie();
  const auto = useSessao.getState().partida!;
  useSessao.setState({ partida: { ...auto, em: Date.now() + 3000 }, descansoAte: Date.now() + 3000 });
  const r = await useSessao.getState().executar('ligar', 'voz');
  expect(r.aceito).toBe(false);
  expect(useSessao.getState().partida?.id).toBe(auto.id);
});

test('cancelar com o "liga" ainda na fila impede o comando de sair', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  const id = useSessao.getState().partida!.id;
  const disparo = useSessao.getState().dispararPartida(id);
  // O cancelamento chega enquanto o "ligar" está a caminho.
  await useSessao.getState().executar('desligar', 'voz', 'nock desliga');
  const r = await disparo;
  expect(r.frase).toBe('Partida cancelada');
  expect(useLancadora.getState().status?.estado).toBe('ARMADO');
  expect(useSessao.getState().series).toHaveLength(0);
});
