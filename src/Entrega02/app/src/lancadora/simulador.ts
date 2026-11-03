// Lançadora simulada em software: a mesma máquina de estados do firmware v2,
// rodando dentro do app. Serve para desenvolver e demonstrar sem o ESP32 e
// para testar o cliente. Não substitui o teste com a lançadora real.

import {
  type Argumento,
  type EstadoLancadora,
  type MotivoLancadora,
  type Operacao,
  type Resposta,
  type StatusLancadora,
  type Transporte,
  msPorBolaCom,
  VELOCIDADE_PADRAO,
} from './contrato';

export const TOKEN_SIMULADOR = 'simulador';
const WATCHDOG_MS = 4000;
const LIMITE_MS = 1000;
const JANELA_NEGADOS_MS = 60_000;

const OPS_VALIDAS = new Set([
  'status', 'ping', 'armar', 'desarmar', 'ligar', 'desligar',
  'pausar', 'retomar', 'emergencia', 'reiniciar', 'resetar', 'calibrar',
]);

const OPS_LIMITADAS = new Set([
  'armar', 'desarmar', 'ligar', 'retomar', 'calibrar', 'resetar', 'reiniciar',
]);

// Subtração no estilo millis() (32 bits). Um relógio que anda para trás
// não aperta a janela: Date.now() no app e o relógio injetado nos testes.
function passou(agora: number, desde: number): number {
  const d = agora - desde;
  return d >= 0 ? d : d + 2 ** 32;
}

export class LancadoraSimulada {
  estado: EstadoLancadora = 'REPOUSO';
  motivo: MotivoLancadora | null = null;
  bolasAlvo = 0;
  duracaoAlvoMs = 0;
  tempoMs = 0;
  msPorBola = 3000;
  calibrado = false;
  lancador = VELOCIDADE_PADRAO.lancador;
  alimentador = VELOCIDADE_PADRAO.alimentador;
  alimentadorCalib = VELOCIDADE_PADRAO.alimentador;
  seq = 0;
  resultado: StatusLancadora['resultado'] = null;
  ultimaOp: string | null = null;
  erro: string | null = null;
  ultimoContato = 0;
  negados = 0;
  negadosJanela = 0;
  ultimoNegadoVia: 'wifi' | 'ble' | null = null;
  ultimoNegadoMs: number | null = null;
  private inicioJanela = 0;
  // 0 (ausente) = esta op ainda não teve um aceite 200.
  private aceites = new Map<string, number>();

  constructor(private relogio: () => number = Date.now) {}

  status(): StatusLancadora {
    this.rolarJanela();
    return {
      estado: this.estado,
      motivo: this.motivo,
      bolasAlvo: this.bolasAlvo,
      bolasEstimadas: this.bolas(),
      tempoMs: this.tempoMs,
      msPorBola: this.msPorBola,
      calibrado: this.calibrado,
      lancador: this.lancador,
      alimentador: this.alimentador,
      alimentadorCalib: this.alimentadorCalib,
      transporte: 'wifi',
      seq: this.seq,
      resultado: this.resultado,
      op: this.ultimaOp,
      erro: this.erro,
      fw: 'simulador',
      negados: this.negados,
      negadosJanela: this.negadosJanela,
      ultimoNegadoVia: this.ultimoNegadoVia,
      ultimoNegadoMs: this.ultimoNegadoMs,
    };
  }

  private rolarJanela(agora = this.relogio()) {
    if (this.inicioJanela === 0) return;
    if (passou(agora, this.inicioJanela) >= JANELA_NEGADOS_MS) {
      this.negadosJanela = 0;
      this.inicioJanela = agora;
    }
  }

  private registrarNegado(via: 'wifi' | 'ble', agora = this.relogio()) {
    if (this.inicioJanela === 0 || passou(agora, this.inicioJanela) >= JANELA_NEGADOS_MS) {
      this.negadosJanela = 0;
      this.inicioJanela = agora;
    }
    this.negados += 1;
    this.negadosJanela += 1;
    this.ultimoNegadoVia = via;
    this.ultimoNegadoMs = agora;
  }

  // Como no firmware: sem velocidade no "ligar", vale o padrão. O lançador
  // aceita 0 (o app permite; só alimenta sem arremessar) e o alimentador tem
  // piso de 10/255 para não parar em LANCANDO.
  private definirVelocidade(arg: Argumento) {
    const v = arg && 'velocidade' in arg && arg.velocidade ? arg.velocidade : VELOCIDADE_PADRAO;
    this.lancador = Math.max(0, Math.min(255, Math.round(v.lancador)));
    // 10/255 de piso e 40% (102/255) de teto, como o firmware 2.2.
    this.alimentador = Math.max(10, Math.min(102, Math.round(v.alimentador)));
  }

  private bolas(): number {
    // Com a roda parada nenhuma bola sai; não credita o que ficou preso.
    if (this.lancador <= 0) return 0;
    return Math.floor(this.tempoMs / msPorBolaCom(this, this.alimentador));
  }

  private mudar(e: EstadoLancadora, m: MotivoLancadora) {
    this.estado = e;
    this.motivo = m;
  }

  // Avança o tempo da série; chamado a cada tick.
  avancar(dtMs: number) {
    if (this.estado !== 'LANCANDO') return;
    this.tempoMs += dtMs;
    if (this.relogio() - this.ultimoContato > WATCHDOG_MS) {
      this.mudar('PAUSADO', 'conexao_perdida');
      return;
    }
    const bolas = this.bolas();
    if (this.bolasAlvo > 0 && bolas >= this.bolasAlvo) this.mudar('ARMADO', 'serie_concluida');
    else if (this.duracaoAlvoMs > 0 && this.tempoMs >= this.duracaoAlvoMs) this.mudar('ARMADO', 'tempo_concluido');
  }

  executar(op: string, arg: Argumento, token: string, via: 'wifi' | 'ble' = 'wifi'): number {
    const opValida = OPS_VALIDAS.has(op);
    const agora = this.relogio();

    if (!opValida && token !== TOKEN_SIMULADOR) {
      this.registrarNegado(via, agora);
      return 400;
    }

    // Status não apaga o diagnóstico, não sobe seq e não alimenta o watchdog.
    if (op === 'status') return 200;

    if (token !== TOKEN_SIMULADOR) {
      this.registrarNegado(via, agora);
      return 401;
    }

    const aceite = OPS_LIMITADAS.has(op) ? (this.aceites.get(op) ?? 0) : 0;
    if (OPS_LIMITADAS.has(op) && aceite !== 0 && passou(agora, aceite) < LIMITE_MS) {
      this.seq += 1;
      this.ultimaOp = op;
      this.erro = 'limite';
      this.resultado = 'limite';
      this.registrarNegado(via, agora);
      return 429;
    }

    this.seq += 1;
    if (!opValida) {
      this.ultimaOp = 'invalida';
      this.resultado = 'invalido';
      this.erro = 'parametro';
      return 400;
    }

    // Ping autenticado renova o watchdog e preserva op/erro.
    this.ultimoContato = agora;
    if (op === 'ping') return 200;
    this.ultimaOp = op;

    const e = this.estado;
    if (op === 'emergencia') { this.mudar('PARADA_SEGURA', 'emergencia'); return this.fim(200); }
    if (e === 'PARADA_SEGURA') {
      if (op === 'reiniciar') { this.mudar('REPOUSO', 'reiniciada'); return this.fim(200); }
      return this.fim(409);
    }
    switch (op) {
      case 'resetar':
        this.bolasAlvo = 0;
        this.duracaoAlvoMs = 0;
        this.tempoMs = 0;
        this.mudar('REPOUSO', 'resetada');
        return this.fim(200);
      case 'armar':
        if (e === 'REPOUSO') this.mudar('ARMADO', 'checklist');
        return this.fim(e === 'REPOUSO' || e === 'ARMADO' ? 200 : 409);
      case 'desarmar':
        if (e !== 'ARMADO') return this.fim(409);
        this.mudar('REPOUSO', 'desarmada');
        return this.fim(200);
      case 'ligar':
        if (e !== 'ARMADO') return this.fim(409);
        this.bolasAlvo = arg && 'bolas' in arg ? arg.bolas : 0;
        this.duracaoAlvoMs = arg && 'duracaoMs' in arg ? arg.duracaoMs : 0;
        this.definirVelocidade(arg);
        this.tempoMs = 0;
        this.mudar('LANCANDO', 'ligar');
        return this.fim(200);
      case 'desligar':
        if (e !== 'LANCANDO' && e !== 'PAUSADO') return this.fim(409);
        this.mudar('ARMADO', 'desligar');
        return this.fim(200);
      case 'pausar':
        if (e !== 'LANCANDO') return this.fim(409);
        this.mudar('PAUSADO', 'pausar');
        return this.fim(200);
      case 'retomar':
        if (e !== 'PAUSADO') return this.fim(409);
        this.mudar('LANCANDO', 'retomar');
        return this.fim(200);
      case 'calibrar': {
        if (e === 'LANCANDO') return this.fim(409);
        const ms = arg && 'msPorBola' in arg ? arg.msPorBola : 0;
        if (ms < 300 || ms > 20000) return this.fim(400);
        const alim = arg && 'msPorBola' in arg && arg.alimentador != null ? arg.alimentador : this.alimentador;
        this.msPorBola = ms;
        this.alimentadorCalib = Math.max(10, Math.min(102, Math.round(alim)));
        this.calibrado = true;
        return this.fim(200);
      }
      default:
        return this.fim(400);
    }
  }

  private fim(codigo: number): number {
    this.resultado = codigo === 200 ? 'ok' : codigo === 409 ? 'estado_invalido' : 'invalido';
    this.erro = codigo === 200 ? null : codigo === 409 ? `estado:${this.estado}` : 'parametro';
    // Só o 200 grava. 0 = nunca aceita: a recusa seguinte não é limitada
    // e a própria recusa (429/409/400) não empurra a janela.
    if (codigo === 200 && this.ultimaOp && OPS_LIMITADAS.has(this.ultimaOp)) {
      this.aceites.set(this.ultimaOp, this.relogio());
    }
    return codigo;
  }
}

export class TransporteSimulado implements Transporte {
  readonly tipo = 'wifi' as const;
  readonly simulado = true;
  private l = new LancadoraSimulada();
  private ouvintes = new Set<(s: StatusLancadora) => void>();
  private tick: ReturnType<typeof setInterval> | null = null;

  constructor(private token: string) {}

  async conectar(): Promise<StatusLancadora> {
    let anterior = Date.now();
    this.tick = setInterval(() => {
      const agora = Date.now();
      this.l.avancar(agora - anterior);
      anterior = agora;
      const s = this.l.status();
      this.ouvintes.forEach((cb) => cb(s));
    }, 250);
    return this.l.status();
  }

  async desconectar(): Promise<void> {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  async enviar(op: Operacao, arg?: Argumento, _urgente?: boolean): Promise<Resposta> {
    await new Promise((r) => setTimeout(r, 30));
    const codigo = this.l.executar(op, arg, this.token) as Resposta['codigo'];
    const s = this.l.status();
    this.ouvintes.forEach((cb) => cb(s));
    return { codigo, status: s };
  }

  aoMudarStatus(cb: (s: StatusLancadora) => void) {
    this.ouvintes.add(cb);
    return () => this.ouvintes.delete(cb);
  }

  aoDesconectar() {
    return () => undefined;
  }
}
