import type { Resposta, StatusLancadora } from './contrato';
import { classificarFalha, comandoAplicado, detalheTecnico } from './falhas';

function status(cambios: Partial<StatusLancadora> = {}): StatusLancadora {
  return {
    estado: 'ARMADO',
    motivo: 'checklist',
    bolasAlvo: 0,
    bolasEstimadas: 0,
    tempoMs: 0,
    msPorBola: 3000,
    calibrado: false,
    transporte: 'wifi',
    seq: 7,
    resultado: 'ok',
    fw: '2.2.0',
    ...cambios,
  };
}

const resposta = (codigo: Resposta['codigo'], s: StatusLancadora | null, extra: Partial<Resposta> = {}): Resposta => ({ codigo, status: s, ...extra });

test('200 não é falha', () => {
  expect(classificarFalha('armar', resposta(200, status()))).toBeNull();
});

test('sem resposta, tempo esgotado e rede fora têm mensagens diferentes', () => {
  const semRede = classificarFalha('armar', resposta(0, null, { falha: 'rede' }));
  expect(semRede?.titulo).toBe('Sem conexão com a lançadora');
  expect(semRede?.acao).toBe('reconectar');

  const lento = classificarFalha('armar', resposta(0, null, { falha: 'timeout' }));
  expect(lento?.titulo).toContain('não respondeu');
  expect(lento?.acao).toBe('reconectar');

  const estranho = classificarFalha('armar', resposta(0, null, { falha: 'resposta_invalida' }));
  expect(estranho?.acao).toBe('diagnostico');
});

test('401 manda conferir o token', () => {
  const f = classificarFalha('armar', resposta(401, status({ estado: 'REPOUSO', resultado: 'nao_autorizado' })));
  expect(f?.titulo).toBe('Token recusado');
  expect(f?.acao).toBe('token');
});

test('409 em PAUSADO é o caso do reparo', () => {
  const f = classificarFalha(
    'armar',
    resposta(409, status({ estado: 'PAUSADO', motivo: 'conexao_perdida', resultado: 'estado_invalido' }), { latenciaMs: 123 }),
    status({ estado: 'PAUSADO', motivo: 'conexao_perdida', resultado: 'estado_invalido' }),
  );
  expect(f?.titulo).toContain('pausada');
  expect(f?.acao).toBe('reparar');
  expect(f?.tecnico).toContain('estado=PAUSADO');
  expect(f?.tecnico).toContain('motivo=conexao_perdida');
  expect(f?.tecnico).toContain('123 ms');
});

test('409 em LANCANDO também pede reparo', () => {
  expect(classificarFalha('armar', resposta(409, status({ estado: 'LANCANDO' })))?.acao).toBe('reparar');
});

test('409 em PARADA_SEGURA manda reiniciar segurando o botão', () => {
  const f = classificarFalha('armar', resposta(409, status({ estado: 'PARADA_SEGURA', motivo: 'emergencia' })));
  expect(f?.acao).toBe('reiniciar');
  expect(f?.corpo).toContain('2 segundos');
});

test('409 em REPOUSO manda voltar ao checklist', () => {
  const f = classificarFalha('ligar', resposta(409, status({ estado: 'REPOUSO' })));
  expect(f?.acao).toBe('rearmar');
});

test('400 é comando inválido', () => {
  expect(classificarFalha('calibrar', resposta(400, status()))?.acao).toBe('tentar');
});

test('429 pede para aguardar e não manda reparar', () => {
  const f = classificarFalha('armar', resposta(429, status({ estado: 'REPOUSO', resultado: 'limite', erro: 'limite' })));
  expect(f?.titulo).toBe('Muitos comandos seguidos');
  expect(f?.corpo).toContain('1 s');
  expect(f?.acao).toBe('tentar');
});

test('o detalhe técnico mostra estado, motivo, resultado, firmware e transporte', () => {
  const t = detalheTecnico('armar', resposta(409, status({ estado: 'PAUSADO', motivo: 'pausar', resultado: 'estado_invalido', erro: 'estado:PAUSADO' })), null);
  expect(t).toContain('armar');
  expect(t).toContain('HTTP 409');
  expect(t).toContain('estado=PAUSADO');
  expect(t).toContain('motivo=pausar');
  expect(t).toContain('resultado=estado_invalido');
  expect(t).toContain('erro=estado:PAUSADO');
  expect(t).toContain('transporte=wifi');
  expect(t).toContain('fw=2.2.0');
});

test('um ligar que estourou o tempo mas ligou é reconhecido pelo status', () => {
  expect(comandoAplicado('ligar', resposta(0, status({ estado: 'LANCANDO' })))).toBe(true);
  expect(comandoAplicado('ligar', resposta(0, status({ estado: 'ARMADO' })))).toBe(false);
  expect(comandoAplicado('desligar', resposta(0, status({ estado: 'ARMADO' })))).toBe(true);
  expect(comandoAplicado('retomar', resposta(0, status({ estado: 'LANCANDO' })))).toBe(true);
  expect(comandoAplicado('retomar', resposta(0, status({ estado: 'PAUSADO' })))).toBe(false);
});
