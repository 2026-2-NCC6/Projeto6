// A lançadora simulada precisa se comportar como o firmware v2. Estes testes
// descrevem as regras da máquina de estados (PRD §7) que os dois seguem.

import { argumentoComoTexto, VELOCIDADE_PADRAO } from './contrato';
import { LancadoraSimulada, TOKEN_SIMULADOR } from './simulador';

const T = TOKEN_SIMULADOR;

function nova() {
  let agora = 0;
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

it('watchdog: 3 s sem sinal do app pausa a série', () => {
  const { l, passar } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 0 }, T);
  passar(3100);
  expect(l.estado).toBe('PAUSADO');
  expect(l.motivo).toBe('conexao_perdida');
});

it('emergência é absorvente até reiniciar', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 0 }, T);
  expect(l.executar('emergencia', undefined, T)).toBe(200);
  expect(l.executar('desligar', undefined, T)).toBe(409);
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

it('calibrar guarda o duty do alimentador da série medida', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { duracaoMs: 30000, velocidade: { lancador: 120, alimentador: 40 } }, T);
  l.executar('desligar', undefined, T);
  expect(l.executar('calibrar', { msPorBola: 2500 }, T)).toBe(200);
  expect(l.status().alimentadorCalib).toBe(40);
});

it('ligar sem velocidade volta ao duty padrão', () => {
  const { l } = nova();
  l.executar('armar', undefined, T);
  l.executar('ligar', { bolas: 5, velocidade: { lancador: 200, alimentador: 80 } }, T);
  l.executar('desligar', undefined, T);
  l.executar('ligar', { bolas: 5 }, T);
  expect(l.status().lancador).toBe(VELOCIDADE_PADRAO.lancador);
  expect(l.status().alimentador).toBe(VELOCIDADE_PADRAO.alimentador);
});

it('texto do comando BLE segue o formato do firmware', () => {
  expect(argumentoComoTexto({ bolas: 10, velocidade: { lancador: 100, alimentador: 25 } })).toBe('10,l:100,a:25');
  expect(argumentoComoTexto({ duracaoMs: 30000 })).toBe('t:30000');
  expect(argumentoComoTexto({ msPorBola: 2500 })).toBe('2500');
});
