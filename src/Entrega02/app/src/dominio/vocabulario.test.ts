import { contemAtivacao, encontrarComando, interpretar, palavraDeAtivacaoValida } from './vocabulario';

describe('interpretar', () => {
  it('aceita palavra de ativação e comando na mesma fala', () => {
    expect(interpretar('Nock, liga', 'Nock', false)).toEqual({ tipo: 'comando', comando: 'ligar' });
  });

  it('abre a janela quando ouve só a palavra de ativação', () => {
    expect(interpretar('nock', 'Nock', false)).toEqual({ tipo: 'ativacao' });
  });

  it('aceita comando sozinho dentro da janela', () => {
    expect(interpretar('liga', 'Nock', true)).toEqual({ tipo: 'comando', comando: 'ligar' });
  });

  it('ignora comando sem palavra de ativação fora da janela', () => {
    expect(interpretar('desliga', 'Nock', false)).toEqual({ tipo: 'ignorado', motivo: 'sem_ativacao' });
  });

  it('emergência vale sem palavra de ativação', () => {
    expect(interpretar('Para!', 'Nock', false)).toEqual({ tipo: 'comando', comando: 'emergencia' });
    expect(interpretar('socorro', 'Nock', false)).toEqual({ tipo: 'comando', comando: 'emergencia' });
    expect(interpretar('EMERGÊNCIA', 'Nock', false)).toEqual({ tipo: 'comando', comando: 'emergencia' });
  });

  it('fala sem comando nem ativação é ignorada', () => {
    expect(interpretar('que bola boa', 'Nock', false)).toEqual({ tipo: 'ignorado', motivo: 'nao_entendi' });
  });

  it('funciona com palavra de ativação personalizada', () => {
    expect(interpretar('arena pausa', 'Arena', false)).toEqual({ tipo: 'comando', comando: 'pausar' });
    expect(interpretar('nock pausa', 'Arena', false)).toEqual({ tipo: 'ignorado', motivo: 'sem_ativacao' });
  });
});

describe('prioridade do lado seguro', () => {
  it('"desliga" nunca é lido como "liga"', () => {
    expect(encontrarComando('nock desliga')).toBe('desligar');
  });

  it('frase com ligar e desligar resulta em desligar', () => {
    expect(encontrarComando('liga não, desliga')).toBe('desligar');
  });

  it('emergência vence qualquer outro comando na frase', () => {
    expect(encontrarComando('nock liga, não, para')).toBe('emergencia');
  });

  it('"ligando", que o próprio app fala, não é comando', () => {
    expect(encontrarComando('ligando')).toBeNull();
    expect(encontrarComando('parada segura')).toBeNull();
  });
});

describe('contemAtivacao', () => {
  it('aceita grafias comuns de "Nock"', () => {
    expect(contemAtivacao('knock liga', 'Nock')).toBe(true);
    expect(contemAtivacao('nok liga', 'Nock')).toBe(true);
  });

  it('tolera uma letra de diferença em palavras longas', () => {
    expect(contemAtivacao('arenna liga', 'Arena')).toBe(true);
  });

  it('não confunde palavras parecidas curtas', () => {
    expect(contemAtivacao('bom liga', 'Bola')).toBe(false);
  });
});

describe('palavraDeAtivacaoValida', () => {
  it('recusa assistentes comerciais', () => {
    expect(palavraDeAtivacaoValida('Alexa').ok).toBe(false);
    expect(palavraDeAtivacaoValida('Ok Google').ok).toBe(false);
  });

  it('recusa comandos como palavra de ativação', () => {
    expect(palavraDeAtivacaoValida('liga').ok).toBe(false);
  });

  it('aceita a padrão', () => {
    expect(palavraDeAtivacaoValida('Nock').ok).toBe(true);
  });
});
