// A sessão contra a lançadora simulada: a contagem de 5 s antes de qualquer
// partida, o cancelamento por voz e o ajuste do descanso.

import { fraseSegura } from '@/dominio/frases';
import { CONTAGEM_MS } from '@/dominio/partida';
import type { Treino } from '@/dominio/tipos';
import { velocidadeDoPreset } from '@/dominio/velocidade';
import { useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import { TOKEN_SIMULADOR } from '@/lancadora/simulador';
import { paradaEmCurso, useSessao } from './sessao';

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

// Os casos em que o bip "sumia": todos precisam virar contagem (partida
// agendada), nunca um comando direto à lançadora.
describe('todo arranque depois de uma parada passa pela contagem', () => {
  async function lancando() {
    await useSessao.getState().executar('ligar', 'voz');
    const r = await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
    expect(r.aceito).toBe(true);
    expect(useLancadora.getState().status?.estado).toBe('LANCANDO');
  }

  function esperaContagem(comando: 'ligar' | 'retomar') {
    const p = useSessao.getState().partida;
    expect(p?.comando).toBe(comando);
    expect(p?.origem).toBe('pedido');
    expect(p!.em - Date.now()).toBeGreaterThan(CONTAGEM_MS - 300);
  }

  test('"desliga" no meio da série e "liga" de novo', async () => {
    await sessaoArmada();
    await lancando();
    expect((await useSessao.getState().executar('desligar', 'voz', 'nock desliga')).aceito).toBe(true);
    expect(useLancadora.getState().status?.estado).toBe('ARMADO');
    const r = await useSessao.getState().executar('ligar', 'voz', 'nock liga');
    expect(r.aceito).toBe(true);
    esperaContagem('ligar');
    expect(useLancadora.getState().status?.estado).toBe('ARMADO');
  });

  test('fim de série sem retomada automática e "liga" no descanso', async () => {
    useApp.setState({ config: { ...useApp.getState().config, retomarSozinho: false } });
    try {
      await sessaoArmada();
      await lancando();
      await fimDeSerie();
      expect(useSessao.getState().fase).toBe('descanso');
      expect(useSessao.getState().partida).toBeNull();
      await useSessao.getState().executar('ligar', 'voz', 'nock liga');
      esperaContagem('ligar');
      expect(useSessao.getState().fase).toBe('pronta');
    } finally {
      useApp.setState({ config: { ...useApp.getState().config, retomarSozinho: true } });
    }
  });

  test('pausa no meio da série e "retoma" pelo botão', async () => {
    await sessaoArmada();
    await lancando();
    await useSessao.getState().executar('pausar', 'voz', 'nock pausa');
    expect(useLancadora.getState().status?.estado).toBe('PAUSADO');
    await useSessao.getState().executar('retomar', 'botao');
    esperaContagem('retomar');
    expect(useLancadora.getState().status?.estado).toBe('PAUSADO');
  });

  test('parada de emergência, reinício, rearmar e "liga"', async () => {
    await sessaoArmada();
    await lancando();
    await useSessao.getState().executar('emergencia', 'voz', 'para', false);
    expect(useLancadora.getState().status?.estado).toBe('PARADA_SEGURA');
    expect(await useSessao.getState().reiniciarAposParada()).toBe(true);
    // A lançadora aceita a mesma operação no máximo uma vez por segundo.
    await new Promise((r) => setTimeout(r, 1100));
    expect((await useSessao.getState().armar(TREINO)).ok).toBe(true);
    await useSessao.getState().executar('ligar', 'voz', 'nock liga');
    esperaContagem('ligar');
    expect(useLancadora.getState().status?.estado).toBe('ARMADO');
  });
});

// Como a tela da sessão: o status que chega fecha séries e devolve a frase.
function ouvirStatus(): { faladas: string[]; sair: () => void } {
  const faladas: string[] = [];
  const sair = useLancadora.subscribe((atual, anterior) => {
    if (!atual.status || atual.status === anterior.status) return;
    const f = useSessao.getState().aoStatus(atual.status);
    if (f) faladas.push(f);
  });
  return { faladas, sair };
}

test('cada transição tem a sua frase, uma só e segura', async () => {
  await useApp.setState({ config: { ...useApp.getState().config, retomarSozinho: true } });
  await sessaoArmada();
  const { faladas, sair } = ouvirStatus();
  try {
    await useSessao.getState().executar('ligar', 'voz');
    const ligou = await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
    expect(ligou.frase).toBe('Série 1 de 3');

    const pausa = await useSessao.getState().executar('pausar', 'voz');
    expect(pausa.frase).toBe('Série pausada');
    expect(paradaEmCurso()).toBe(false);

    await useSessao.getState().executar('retomar', 'voz');
    const retomou = await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
    expect(retomou.frase).toBe('Retomando');

    // "Desliga" no meio da série: fala só a frase do fim da série, sem o
    // "Desligado" por cima.
    const desligou = await useSessao.getState().executar('desligar', 'voz');
    expect(desligou.aceito).toBe(true);
    expect(desligou.silencioso).toBe(true);
    expect(faladas).toEqual(['Série 1 de 3 encerrada. Descanso de 30 segundos, sem retomada automática']);
    for (const f of [ligou.frase, pausa.frase, retomou.frase, ...faladas]) expect(fraseSegura(f)).toBe(true);
  } finally {
    sair();
  }
});

test('a série concluída pelas bolas anuncia o descanso e a última, o fim do treino', async () => {
  await useApp.setState({ config: { ...useApp.getState().config, retomarSozinho: true } });
  await sessaoArmada({ ...TREINO, series: 2 });
  await useSessao.getState().executar('ligar', 'voz');
  await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  const r = await useLancadora.getState().enviar('desligar');
  const fim = { ...r.status!, estado: 'ARMADO' as const, motivo: 'serie_concluida' as const, bolasEstimadas: 5, bolasAlvo: 5 };
  expect(useSessao.getState().aoStatus(fim)).toBe('Série 1 de 2 concluída. Descanso de 30 segundos');
  // A lançadora aceita um "ligar" por segundo.
  await new Promise((r) => setTimeout(r, 1100));

  await useSessao.getState().executar('ligar', 'botao');
  const ligou = await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  expect(ligou.frase).toBe('Série 2 de 2');
  const r2 = await useLancadora.getState().enviar('desligar');
  expect(useSessao.getState().aoStatus({ ...r2.status!, estado: 'ARMADO', motivo: 'serie_concluida', bolasEstimadas: 5, bolasAlvo: 5 })).toBe('Série 2 de 2 concluída. Treino concluído');
});

test('no Livre, o "desliga" diz a série e as bolas', async () => {
  await sessaoArmada({ ...TREINO, bolasPorSerie: 0 });
  const { faladas, sair } = ouvirStatus();
  try {
    await useSessao.getState().executar('ligar', 'voz');
    expect((await useSessao.getState().dispararPartida(useSessao.getState().partida!.id)).frase).toBe('Série 1');
    const r = await useSessao.getState().executar('desligar', 'voz');
    expect(r.silencioso).toBe(true);
    expect(faladas).toHaveLength(1);
    expect(faladas[0]).toMatch(/^Série 1 encerrada\. \d+ bolas?$/);
  } finally {
    sair();
  }
});

test('"desliga" logo depois de um "pausa" ainda em voo espera e para, em vez de ser recusado', async () => {
  await sessaoArmada();
  await useSessao.getState().executar('ligar', 'voz');
  await useSessao.getState().dispararPartida(useSessao.getState().partida!.id);
  expect(useLancadora.getState().status?.estado).toBe('LANCANDO');
  const pausa = useSessao.getState().executar('pausar', 'voz', 'nock pausa');
  const d = await useSessao.getState().executar('desligar', 'voz', 'nock desliga');
  await pausa;
  expect(d.frase).not.toBe('Aguarde o comando anterior');
  expect(useLancadora.getState().status?.estado).toBe('ARMADO');
});
