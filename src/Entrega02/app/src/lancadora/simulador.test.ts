// A lançadora simulada precisa se comportar como o firmware v2. Estes testes
// descrevem as regras da máquina de estados (PRD §7) que os dois seguem.

import { argumentoComoTexto, VELOCIDADE_PADRAO } from './contrato';
import { LancadoraSimulada, TOKEN_SIMULADOR } from './simulador';

const T = TOKEN_SIMULADOR;

function nova() {
  // 0 no relógio significa "esta op ainda não foi aceita". Os testes começam
  // acima de zero para o limite de 1 s valer de verdade.
  let agora = 10_000;
  const l = new LancadoraSimulada(() => agora);
  return { l, passar: (ms: number) => { agora += ms; l.avancar(ms); } };
}

it('ligar só em ARMADO', () => {
  const { l } = nova();
  expect(l.executar('ligar', { bolas: 10 }, T)).toBe(409);
  expect(l.executar('armar', undefined, T)).toBe(200);
  expect(l.executar('ligar', { bolas: 10 }, T)).toBe(200);
  expect(l.estado).toBe('LANCANDO');
});

it('sem token não aciona nada', () => {
  const { l } = nova();
  expect(l.executar('armar', undefined, 'errado')).toBe(401);
  expect(l.estado).toBe('REPOUSO');
});

it('para sozinha ao fim das N bolas e volta a ARMADO', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 2 }, T);
  for (let i = 0; i < 6; i++) { passar(500); l.executar('ping', undefined, T); }
  expect(l.estado).toBe('LANCANDO');
  for (let i = 0; i < 6; i++) { passar(500); l.executar('ping', undefined, T); }
  expect(l.estado).toBe('ARMADO');
  expect(l.motivo).toBe('serie_concluida');
});

it('watchdog: 4 s sem sinal do app pausa a série', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 0 }, T);
  passar(4100);
  expect(l.estado).toBe('PAUSADO');
  expect(l.motivo).toBe('conexao_perdida');
});

it('emergência é absorvente até reiniciar', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 0 }, T);
  expect(l.executar('emergencia', undefined, T)).toBe(200);
  expect(l.executar('desligar', undefined, T)).toBe(409);
  // O armar de agora pouco ainda está na janela de 1 s: 429, sem sair da parada.
  expect(l.executar('armar', undefined, T)).toBe(429);
  expect(l.estado).toBe('PARADA_SEGURA');
  passar(1000);
  expect(l.executar('armar', undefined, T)).toBe(409);
  expect(l.executar('reiniciar', undefined, T)).toBe(200);
  expect(l.estado).toBe('REPOUSO');
});

it('pausar mantém o tempo da série e retomar continua de onde parou', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 10 }, T);
  passar(1000);
  l.executar('pausar', undefined, T);
  passar(5000);
  expect(l.tempoMs).toBe(1000);
  l.executar('retomar', undefined, T);
  passar(500);
  expect(l.tempoMs).toBe(1500);
});

it('calibração recusa valores fora do intervalo', () => {
  const { l } = nova();
  expect(l.executar('calibrar', { msPorBola: 100 }, T)).toBe(400);
  expect(l.executar('calibrar', { msPorBola: 2700 }, T)).toBe(200);
  expect(l.calibrado).toBe(true);
});

it('alimentador no dobro do duty da calibração estima o dobro de bolas', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 0, velocidade: { lancador: 100, alimentador: 50 } }, T);
  for (let i = 0; i < 6; i++) { passar(500); l.executar('ping', undefined, T); }
  // 3 s com 3000 ms/bola medidos a 25/255; a 50/255 cada bola leva 1500 ms.
  expect(l.status().bolasEstimadas).toBe(2);
  expect(l.status().alimentador).toBe(50);
});

it('calibrar aceita o duty medido mesmo depois de um reboot', () => {
  const { l } = nova();
  expect(l.executar('calibrar', { msPorBola: 2400, alimentador: 64 }, T)).toBe(200);
  expect(l.status().alimentadorCalib).toBe(64);
  expect(l.status().msPorBola).toBe(2400);
});

it('com o lançador em 0% nenhuma bola é estimada', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 10, velocidade: { lancador: 0, alimentador: 64 } }, T);
  for (let i = 0; i < 6; i++) { passar(1000); l.executar('ping', undefined, T); }
  expect(l.status().bolasEstimadas).toBe(0);
  expect(l.estado).toBe('LANCANDO');
});

it('calibrar guarda o duty do alimentador da série medida', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { duracaoMs: 30000, velocidade: { lancador: 120, alimentador: 40 } }, T);
  l.executar('desligar', undefined, T);
  expect(l.executar('calibrar', { msPorBola: 2500 }, T)).toBe(200);
  expect(l.status().alimentadorCalib).toBe(40);
});

it('ligar sem velocidade volta ao duty padrão', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 5, velocidade: { lancador: 200, alimentador: 80 } }, T);
  l.executar('desligar', undefined, T);
  passar(1000);
  l.executar('ligar', { bolas: 5 }, T);
  expect(l.status().lancador).toBe(VELOCIDADE_PADRAO.lancador);
  expect(l.status().alimentador).toBe(VELOCIDADE_PADRAO.alimentador);
});

it('aceita o lançador em 0% e mantém o piso do alimentador', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 5, velocidade: { lancador: 0, alimentador: 5 } }, T);
  expect(l.status().lancador).toBe(0);
  expect(l.status().alimentador).toBe(10);
});

it('limita o duty ao máximo de 255', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 5, velocidade: { lancador: 999, alimentador: 999 } }, T);
  expect(l.status().lancador).toBe(255);
  expect(l.status().alimentador).toBe(102);
});

it('o status conta por que o último comando foi recusado, e o ping não apaga', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 5 }, T);
  expect(l.executar('armar', undefined, T)).toBe(429);
  expect(l.status().op).toBe('armar');
  expect(l.status().erro).toBe('limite');
  expect(l.status().resultado).toBe('limite');
  l.executar('ping', undefined, T);
  expect(l.status().op).toBe('armar');
  expect(l.status().erro).toBe('limite');
  passar(1000);
  expect(l.executar('armar', undefined, T)).toBe(409);
  expect(l.status().erro).toBe('estado:LANCANDO');
  expect(l.status().resultado).toBe('estado_invalido');
  l.executar('ping', undefined, T);
  expect(l.status().op).toBe('armar');
  expect(l.status().erro).toBe('estado:LANCANDO');
});

it('texto do comando BLE segue o formato do firmware', () => {
  expect(argumentoComoTexto({ bolas: 10, velocidade: { lancador: 100, alimentador: 25 } })).toBe('10,l:100,a:25');
  expect(argumentoComoTexto({ duracaoMs: 30000 })).toBe('t:30000');
  expect(argumentoComoTexto({ msPorBola: 2500 })).toBe('2500');
});

it('resetar zera uma série presa e volta a REPOUSO, mas não sai da parada segura', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 10 }, T);
  l.executar('pausar', undefined, T);
  expect(l.executar('resetar', undefined, T)).toBe(200);
  expect(l.estado).toBe('REPOUSO');
  passar(1000);
  expect(l.executar('armar', undefined, T)).toBe(200);
  l.executar('emergencia', undefined, T);
  expect(l.executar('resetar', undefined, T)).toBe(409);
  expect(l.estado).toBe('PARADA_SEGURA');
  expect(l.executar('resetar', undefined, 'errado')).toBe(401);
});

it('limita a mesma op a um aceite por segundo e a recusa não empurra a janela', () => {
  const { l, passar } = nova();
  expect(l.executar('armar', undefined, T)).toBe(200);
  expect(l.estado).toBe('ARMADO');
  expect(l.executar('armar', undefined, T)).toBe(429);
  expect(l.executar('armar', undefined, T)).toBe(429);
  expect(l.estado).toBe('ARMADO');
  expect(l.status().resultado).toBe('limite');
  expect(l.status().erro).toBe('limite');
  expect(l.status().op).toBe('armar');
  const seq = l.status().seq;
  passar(999);
  expect(l.executar('armar', undefined, T)).toBe(429);
  expect(l.status().seq).toBe(seq + 1);
  expect(l.estado).toBe('ARMADO');
  expect(l.status().negados).toBe(3);
  passar(1);
  expect(l.executar('armar', undefined, T)).toBe(200);
  expect(l.estado).toBe('ARMADO');
});

it('ligar sem token não muda seq, diagnóstico nem estado', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  const antes = l.status();
  expect(l.executar('ligar', { bolas: 3 }, '')).toBe(401);
  const d = l.status();
  expect(d.seq).toBe(antes.seq);
  expect(d.op).toBe(antes.op);
  expect(d.erro).toBe(antes.erro);
  expect(d.resultado).toBe(antes.resultado);
  expect(d.estado).toBe('ARMADO');
  expect(l.estado).toBe('ARMADO');
  expect(d.negados).toBe(1);
  expect(d.negadosJanela).toBe(1);
  expect(d.ultimoNegadoVia).toBe('wifi');
  expect(d.ultimoNegadoMs).toBe(10_000);
});

it('status repetido não muda seq nem conta negado', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  const seq = l.status().seq;
  expect(l.executar('status', undefined, '')).toBe(200);
  expect(l.executar('status', undefined, 'qualquer')).toBe(200);
  expect(l.status().seq).toBe(seq);
  expect(l.status().negados).toBe(0);
  expect(l.status().op).toBe('armar');
  expect(l.status().erro).toBeNull();
});

it('vários ping a cada 750 ms não geram 429 nem conexao_perdida', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 0 }, T);
  for (let i = 0; i < 8; i++) {
    passar(750);
    expect(l.executar('ping', undefined, T)).toBe(200);
  }
  expect(l.estado).toBe('LANCANDO');
  expect(l.motivo).toBe('ligar');
  expect(l.status().negados).toBe(0);
  expect(l.status().resultado).toBe('ok');
});

it('emergência no meio de uma rajada de ligar vai para parada segura', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  expect(l.executar('ligar', { bolas: 0 }, T)).toBe(200);
  expect(l.executar('ligar', { bolas: 0 }, T)).toBe(429);
  expect(l.executar('ligar', { bolas: 0 }, T)).toBe(429);
  expect(l.estado).toBe('LANCANDO');
  expect(l.executar('emergencia', undefined, T)).toBe(200);
  expect(l.estado).toBe('PARADA_SEGURA');
});

it('pausar e desligar não tomam 429', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 0 }, T);
  expect(l.executar('pausar', undefined, T)).toBe(200);
  expect(l.executar('pausar', undefined, T)).toBe(409);
  expect(l.estado).toBe('PAUSADO');
  expect(l.executar('desligar', undefined, T)).toBe(200);
  expect(l.executar('desligar', undefined, T)).toBe(409);
  expect(l.estado).toBe('ARMADO');
  expect(l.status().negados).toBe(0);
  expect(l.status().resultado).toBe('estado_invalido');
});

it('409 autenticado não recomeça a janela de 1 s', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 0 }, T);
  passar(1000);
  expect(l.executar('armar', undefined, T)).toBe(409);
  l.executar('desligar', undefined, T);
  passar(500);
  expect(l.executar('armar', undefined, T)).toBe(200);
  expect(l.estado).toBe('ARMADO');
});

it('op inexistente sem token é 400 e não mexe no diagnóstico', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  const antes = l.status();
  expect(l.executar('invalida', undefined, '')).toBe(400);
  const d = l.status();
  expect(d.seq).toBe(antes.seq);
  expect(d.op).toBe(antes.op);
  expect(d.erro).toBe(antes.erro);
  expect(d.estado).toBe('ARMADO');
  expect(d.negados).toBe(1);
  expect(l.executar('invalida', undefined, T)).toBe(400);
  expect(l.status().op).toBe('invalida');
  expect(l.status().seq).toBe((antes.seq ?? 0) + 1);
  expect(l.status().negados).toBe(1);
  expect(l.estado).toBe('ARMADO');
});

it('a janela de 60 s zera e o total de negados fica', () => {
  const { l, passar } = nova();
  expect(l.executar('ligar', { bolas: 1 }, '')).toBe(401);
  expect(l.executar('armar', undefined, 'errado')).toBe(401);
  expect(l.status().negados).toBe(2);
  expect(l.status().negadosJanela).toBe(2);
  expect(l.estado).toBe('REPOUSO');
  passar(60_000);
  expect(l.status().negadosJanela).toBe(0);
  expect(l.status().negados).toBe(2);
  expect(l.executar('ligar', { bolas: 1 }, '')).toBe(401);
  expect(l.status().negados).toBe(3);
  expect(l.status().negadosJanela).toBe(1);
});
