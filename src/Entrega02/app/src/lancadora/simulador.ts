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
const WATCHDOG_MS = 3000;

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
  ultimoContato = 0;

  constructor(private relogio: () => number = Date.now) {}

  status(): StatusLancadora {
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
      fw: 'simulador',
    };
  }

  // Como no firmware: sem velocidade no "ligar", vale o padrão; duty entre 10 e 255.
  private definirVelocidade(arg: Argumento) {
    const v = arg && 'velocidade' in arg && arg.velocidade ? arg.velocidade : VELOCIDADE_PADRAO;
    const limitar = (d: number) => Math.max(10, Math.min(255, Math.round(d)));
    this.lancador = limitar(v.lancador);
    this.alimentador = limitar(v.alimentador);
  }

  private bolas(): number {
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

  executar(op: Operacao, arg: Argumento, token: string): number {
    this.seq++;
    if (op === 'status') return this.fim(200);
    if (token !== TOKEN_SIMULADOR) return this.fim(401);
    this.ultimoContato = this.relogio();
    if (op === 'ping') return this.fim(200);

    const e = this.estado;
    if (op === 'emergencia') { this.mudar('PARADA_SEGURA', 'emergencia'); return this.fim(200); }
    if (e === 'PARADA_SEGURA') {
      if (op === 'reiniciar') { this.mudar('REPOUSO', 'reiniciada'); return this.fim(200); }
      return this.fim(409);
    }
    switch (op) {
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
        this.msPorBola = ms;
        this.alimentadorCalib = this.alimentador;
        this.calibrado = true;
        return this.fim(200);
      }
      default:
        return this.fim(400);
    }
  }

  private fim(codigo: number): number {
    this.resultado = codigo === 200 ? 'ok' : codigo === 401 ? 'nao_autorizado' : codigo === 409 ? 'estado_invalido' : 'invalido';
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

  async enviar(op: Operacao, arg?: Argumento): Promise<Resposta> {
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
