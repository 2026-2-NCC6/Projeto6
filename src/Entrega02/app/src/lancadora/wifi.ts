// Transporte Wi-Fi: o celular entra no Access Point da lançadora e fala HTTP
// com 192.168.4.1. O status chega por polling.

import {
  type Argumento,
  type Operacao,
  type Resposta,
  type StatusLancadora,
  type Transporte,
  lerStatus,
  TIMEOUT_MS,
  WIFI_HOST,
} from './contrato';

const POLL_MS = 500;

export class TransporteWifi implements Transporte {
  readonly tipo = 'wifi' as const;
  private ouvintes = new Set<(s: StatusLancadora) => void>();
  private ouvintesQueda = new Set<() => void>();
  private poll: ReturnType<typeof setInterval> | null = null;
  private falhasSeguidas = 0;

  constructor(private token: string, private host = WIFI_HOST) {}

  private async requisitar(caminho: string): Promise<Resposta> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`${this.host}${caminho}`, { signal: ctrl.signal });
      const status = lerStatus(await r.text());
      if (status) this.emitir(status);
      this.falhasSeguidas = 0;
      return { codigo: r.status as Resposta['codigo'], status };
    } catch {
      this.falhasSeguidas++;
      // Três falhas seguidas (~1,5 s) = conexão perdida. O firmware para os
      // motores sozinho em 3 s, então o app só precisa avisar.
      if (this.falhasSeguidas === 3) this.ouvintesQueda.forEach((cb) => cb());
      return { codigo: 0, status: null };
    } finally {
      clearTimeout(t);
    }
  }

  private emitir(s: StatusLancadora) {
    this.ouvintes.forEach((cb) => cb(s));
  }

  async conectar(): Promise<StatusLancadora> {
    const r = await this.requisitar('/status');
    if (!r.status) throw new Error('Lançadora não encontrada. O celular está na rede ESP32_Voz_Direta?');
    this.poll = setInterval(() => void this.requisitar('/status'), POLL_MS);
    return r.status;
  }

  async desconectar(): Promise<void> {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  enviar(op: Operacao, arg?: Argumento): Promise<Resposta> {
    const q = new URLSearchParams();
    if (op !== 'status') q.set('token', this.token);
    if (arg && 'bolas' in arg) q.set('bolas', String(arg.bolas));
    if (arg && 'duracaoMs' in arg) q.set('duracaoMs', String(arg.duracaoMs));
    if (arg && 'msPorBola' in arg) q.set('msPorBola', String(arg.msPorBola));
    if (arg && 'velocidade' in arg && arg.velocidade) {
      q.set('lancador', String(arg.velocidade.lancador));
      q.set('alimentador', String(arg.velocidade.alimentador));
    }
    return this.requisitar(`/${op}?${q.toString()}`);
  }

  aoMudarStatus(cb: (s: StatusLancadora) => void) {
    this.ouvintes.add(cb);
    return () => this.ouvintes.delete(cb);
  }

  aoDesconectar(cb: () => void) {
    this.ouvintesQueda.add(cb);
    return () => this.ouvintesQueda.delete(cb);
  }
}
