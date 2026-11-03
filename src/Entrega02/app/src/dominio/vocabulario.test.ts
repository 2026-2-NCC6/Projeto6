import { contemAtivacao, encontrarComando, escolherInterpretacao, interpretar, palavraDeAtivacaoValida, termosDeContexto } from './vocabulario';

const comando = (c: 'ligar' | 'desligar' | 'pausar' | 'retomar' | 'emergencia', ativada = true) => ({ tipo: 'comando', comando: c, ativada });

describe('interpretar', () => {
  it('aceita palavra de ativação e comando na mesma fala', () => {
    expect(interpretar('Nock, liga', 'Nock', false)).toEqual(comando('ligar'));
  });

  it('abre a janela quando ouve só a palavra de ativação', () => {
    expect(interpretar('nock', 'Nock', false)).toEqual({ tipo: 'ativacao' });
  });

  it('aceita comando sozinho dentro da janela', () => {
    expect(interpretar('liga', 'Nock', true)).toEqual(comando('ligar'));
  });

  it('ignora comando sem palavra de ativação fora da janela', () => {
    expect(interpretar('desliga', 'Nock', false)).toEqual({ tipo: 'ignorado', motivo: 'sem_ativacao' });
  });

  it('emergência vale sem palavra de ativação', () => {
    expect(interpretar('Para!', 'Nock', false)).toEqual(comando('emergencia', false));
    expect(interpretar('socorro', 'Nock', false)).toEqual(comando('emergencia', false));
    expect(interpretar('EMERGÊNCIA', 'Nock', false)).toEqual(comando('emergencia', false));
  });

  it('marca se a emergência veio com a palavra de ativação', () => {
    expect(interpretar('Nock, para', 'Nock', false)).toEqual(comando('emergencia', true));
    expect(interpretar('Nock, para', 'Nock', true)).toEqual(comando('emergencia', true));
  });

  it('fala sem comando nem ativação é ignorada', () => {
    expect(interpretar('que bola boa', 'Nock', false)).toEqual({ tipo: 'ignorado', motivo: 'nao_entendi' });
  });

  it('funciona com palavra de ativação personalizada', () => {
    expect(interpretar('arena pausa', 'Arena', false)).toEqual(comando('pausar'));
    expect(interpretar('nock pausa', 'Arena', false)).toEqual({ tipo: 'ignorado', motivo: 'sem_ativacao' });
  });

  it('aceita a ativação grudada no comando, como o reconhecedor às vezes escreve', () => {
    expect(interpretar('nockliga', 'Nock', false)).toEqual(comando('ligar'));
    expect(interpretar('nockdesliga', 'Nock', false)).toEqual(comando('desligar'));
  });

  it('reconhece variações comuns de transcrição dos comandos', () => {
    expect(interpretar('nock disliga', 'Nock', false)).toEqual(comando('desligar'));
  });
});

describe('frases faladas do app', () => {
  it('nenhuma vira comando quando o microfone ouve o alto-falante', () => {
    const frases = [
      'Ligando',
      'Desligado',
      'Pausado',
      'Retomando',
      'Parada segura',
      'Série concluída. Descanse: eu retomo no fim',
      'Série concluída. Descanse',
      'Descanso encerrado',
      'Retomada cancelada',
      'Retomando em 5 segundos',
      'Motores ligados',
      'O aviso de 5 segundos não tocou a tempo. Use o botão da tela.',
      'A lançadora voltou ao repouso. Rearme antes de seguir',
      'Conexão perdida. Motores parados',
      'Treino concluído',
      'A lançadora não respondeu',
      'Sem conexão com a lançadora',
      'Token recusado',
      'Comando inválido',
      'A lançadora está em parada segura',
      'A lançadora ficou pausada',
      'A lançadora não está armada',
      'Não confirmei a parada',
      'Não há nada em andamento',
      'Ela já está ligada',
      'Ela já está desligada',
      'Ela está pausada',
      'Primeiro arme a lançadora',
      'Lançadora bloqueada. Reinicie primeiro',
      'Defina a velocidade do treino',
      'Aguarde o comando anterior',
      'Sem conexão com a lançadora',
      'Não foi possível reconectar',
    ];
    for (const frase of frases) {
      // janela aberta simula o pior caso: o microfone ouve o app logo depois
      // da palavra de ativação.
      expect({ frase, tipo: interpretar(frase, 'Nock', true).tipo }).toEqual({ frase, tipo: 'ignorado' });
    }
  });
});

describe('escolherInterpretacao', () => {
  it('usa a hipótese principal quando ela entende tudo', () => {
    const r = escolherInterpretacao(['nock liga', 'nock ligar'], 'Nock', false);
    expect(r.texto).toBe('nock liga');
    expect(r.resultado).toEqual(comando('ligar'));
  });

  it('prefere uma parada de qualquer hipótese: parar a mais é seguro', () => {
    expect(escolherInterpretacao(['nock liga', 'nock desliga'], 'Nock', false).resultado).toEqual(comando('desligar'));
    expect(escolherInterpretacao(['nock liga', 'nock para'], 'Nock', false).resultado).toEqual(comando('emergencia'));
  });

  it('uma alternativa "para" sem ativação não transforma um desliga em emergência', () => {
    expect(escolherInterpretacao(['nock desliga', 'para'], 'Nock', false).resultado).toEqual(comando('desligar'));
    expect(escolherInterpretacao(['nock pausa', 'para'], 'Nock', false).resultado).toEqual(comando('pausar'));
  });

  it('a alternativa ainda salva o "Para!" quando a principal não entendeu', () => {
    expect(escolherInterpretacao(['que bola', 'para'], 'Nock', false).resultado).toEqual(comando('emergencia', false));
  });

  it('"Nock, para" na alternativa vale como emergência com ativação', () => {
    expect(escolherInterpretacao(['nock desliga', 'nock para'], 'Nock', false).resultado).toEqual(comando('emergencia', true));
  });

  it('não liga os motores a partir de uma hipótese alternativa', () => {
    expect(escolherInterpretacao(['nock', 'nock liga'], 'Nock', false).resultado).toEqual({ tipo: 'ativacao' });
    expect(escolherInterpretacao(['que bola', 'nock liga'], 'Nock', false).resultado).toEqual({ tipo: 'ignorado', motivo: 'nao_entendi' });
  });

  it('aceita uma parada vinda só da alternativa', () => {
    expect(escolherInterpretacao(['que bola', 'nock desliga'], 'Nock', false).resultado).toEqual(comando('desligar'));
  });

  it('sem texto, devolve ignorado', () => {
    expect(escolherInterpretacao([], 'Nock', false).resultado).toEqual({ tipo: 'ignorado', motivo: 'nao_entendi' });
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
    expect(contemAtivacao('nock hug liga', 'Nock')).toBe(true);
    expect(contemAtivacao('nockhug liga', 'Nock')).toBe(true);
  });

  it('tolera uma letra de diferença em palavras longas', () => {
    expect(contemAtivacao('arenna liga', 'Arena')).toBe(true);
  });

  it('não confunde palavras parecidas curtas', () => {
    expect(contemAtivacao('bom liga', 'Bola')).toBe(false);
  });
});

describe('termosDeContexto', () => {
  it('entrega a ativação, os comandos e as grafias conhecidas', () => {
    const termos = termosDeContexto('Nock');
    expect(termos).toContain('Nock');
    expect(termos).toContain('desliga');
    expect(termos).toContain('nockhug');
    expect(new Set(termos).size).toBe(termos.length);
  });
});

describe('palavraDeAtivacaoValida', () => {
  it('recusa assistentes comerciais', () => {
    expect(palavraDeAtivacaoValida('Alexa').ok).toBe(false);
    expect(palavraDeAtivacaoValida('Ok Google').ok).toBe(false);
  });

  it('recusa comandos como palavra de ativação', () => {
    expect(palavraDeAtivacaoValida('liga').ok).toBe(false);
    expect(palavraDeAtivacaoValida('stop').ok).toBe(false);
  });

  it('aceita a padrão', () => {
    expect(palavraDeAtivacaoValida('Nock').ok).toBe(true);
  });
});
