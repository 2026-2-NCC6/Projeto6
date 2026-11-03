// Transporte Bluetooth Low Energy (ADR 0001).
//
// GATT da lançadora: característica de comando (write, "token|operacao|arg") e
// de status (read + notify, o mesmo JSON do Wi-Fi). Com o MTU 517 o JSON de
// status (até ~300 B com op/erro) cabe inteiro numa notificação; a leitura
// completa continua sendo o caminho seguro se uma notificação chegar cortada.

import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';
import {
  type Argumento,
  type Operacao,
  type Resposta,
  type StatusLancadora,
  type Transporte,
  argumentoComoTexto,
  BLE_CMD,
  BLE_SERVICE,
  BLE_STATUS,
  lerStatus,
  TIMEOUT_COMANDO_MS,
  TIMEOUT_MS,
} from './contrato';

let gerenciador: BleManager | null = null;
export function bleManager(): BleManager {
  if (!gerenciador) gerenciador = new BleManager();
  return gerenciador;
}

const paraBase64 = (s: string) => btoa(s);
const deBase64 = (s: string) => atob(s);

export type LancadoraEncontrada = { id: string; nome: string; rssi: number | null };

// Procura lançadoras pelo UUID do serviço. Devolve a função que para a busca.
export function procurarLancadoras(aoEncontrar: (l: LancadoraEncontrada) => void, aoFalhar: (msg: string) => void): () => void {
  const m = bleManager();
  void m.startDeviceScan([BLE_SERVICE], null, (erro, d) => {
    if (erro) {
      aoFalhar(erro.message);
      return;
    }
    if (d) aoEncontrar({ id: d.id, nome: d.localName ?? d.name ?? 'NockHug', rssi: d.rssi });
  });
  return () => void m.stopDeviceScan();
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Uma leitura de característica que trava não pode travar a fila do app para
// sempre: vira erro depois de TIMEOUT_MS.
async function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promessa,
      new Promise<T>((_, rejeitar) => {
        timer = setTimeout(() => rejeitar(new Error('Tempo esgotado na leitura BLE')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class TransporteBle implements Transporte {
  readonly tipo = 'ble' as const;
  private device: Device | null = null;
  private ouvintes = new Set<(s: StatusLancadora) => void>();
  private ouvintesQueda = new Set<() => void>();
  private subs: Subscription[] = [];
  private ultimoSeq = -1;
  private fila: Promise<unknown> = Promise.resolve();

  constructor(private token: string, private deviceId: string) {}

  private emitir(s: StatusLancadora) {
    this.ultimoSeq = Math.max(this.ultimoSeq, s.seq);
    this.ouvintes.forEach((cb) => cb(s));
  }

  private async lerStatusCompleto(): Promise<StatusLancadora | null> {
    if (!this.device) return null;
    const c = await comTimeout(this.device.readCharacteristicForService(BLE_SERVICE, BLE_STATUS), TIMEOUT_MS);
    const s = c.value ? lerStatus(deBase64(c.value)) : null;
    if (s) this.emitir(s);
    return s;
  }

  async conectar(): Promise<StatusLancadora> {
    const m = bleManager();
    const d = await m.connectToDevice(this.deviceId, { requestMTU: 517, timeout: 8000 });
    await d.discoverAllServicesAndCharacteristics();
    this.device = d;

    this.subs.push(
      m.onDeviceDisconnected(this.deviceId, () => {
        this.device = null;
        this.ouvintesQueda.forEach((cb) => cb());
      }),
    );
    this.subs.push(
      d.monitorCharacteristicForService(BLE_SERVICE, BLE_STATUS, (erro, c) => {
        if (erro || !c?.value) return;
        const s = lerStatus(deBase64(c.value));
        if (s) this.emitir(s);
        else void this.lerStatusCompleto().catch(() => undefined);
      }),
    );

    const s = await this.lerStatusCompleto();
    if (!s) throw new Error('A lançadora respondeu em um formato desconhecido.');
    return s;
  }

  async desconectar(): Promise<void> {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    const id = this.deviceId;
    this.device = null;
    await bleManager().cancelDeviceConnection(id).catch(() => undefined);
  }

  // Um comando por vez: o firmware descarta escritas enquanto processa outra.
  enviar(op: Operacao, arg?: Argumento, urgente = false): Promise<Resposta> {
    if (urgente) return this.enviarUrgenteAgora(op, arg);
    const tarefa = this.fila.then(() => this.enviarAgora(op, arg));
    this.fila = tarefa.catch(() => undefined);
    return tarefa;
  }

  // A emergência fura a fila: o firmware a processa antes do comando pendente
  // (processarBle tem um caminho próprio para ela). A leitura confirma se ela
  // chegou a PARADA_SEGURA.
  private async enviarUrgenteAgora(op: Operacao, arg?: Argumento): Promise<Resposta> {
    if (!this.device) return { codigo: 0, status: null, falha: 'rede' };
    try {
      await this.device.writeCharacteristicWithResponseForService(
        BLE_SERVICE,
        BLE_CMD,
        paraBase64(`${this.token}|${op}|${argumentoComoTexto(arg)}`),
      );
      // Não basta a escrita ter voltado: confirma que a máquina chegou em
      // PARADA_SEGURA. Sem confirmação, é falha (nunca "parada segura" falsa).
      let ultimo: StatusLancadora | null = null;
      const limite = Date.now() + TIMEOUT_MS;
      while (Date.now() < limite) {
        await espera(100);
        const s = await this.lerStatusCompleto().catch(() => null);
        if (s) {
          ultimo = s;
          if (s.estado === 'PARADA_SEGURA') return { codigo: 200, status: s };
        }
      }
      return { codigo: 0, status: ultimo, falha: 'timeout' };
    } catch {
      return { codigo: 0, status: null, falha: 'rede' };
    }
  }

  private async enviarAgora(op: Operacao, arg?: Argumento): Promise<Resposta> {
    if (!this.device) return { codigo: 0, status: null, falha: 'rede' };
    if (op === 'status') {
      const s = await this.lerStatusCompleto().catch(() => null);
      return s ? { codigo: 200, status: s } : { codigo: 0, status: null, falha: 'timeout' };
    }
    const antes = this.ultimoSeq;
    const inicio = Date.now();
    try {
      await this.device.writeCharacteristicWithResponseForService(
        BLE_SERVICE,
        BLE_CMD,
        paraBase64(`${this.token}|${op}|${argumentoComoTexto(arg)}`),
      );
      // O ping só precisa chegar ao firmware (ele alimenta o watchdog); não
      // espera o ack, para o heartbeat não ser confundido com um comando.
      if (op === 'ping') return { codigo: 200, status: null };
      // O firmware executa no loop(); o seq sobe quando o comando foi processado.
      const limite = TIMEOUT_COMANDO_MS;
      while (Date.now() - inicio < limite) {
        await espera(40);
        const s = await this.lerStatusCompleto();
        if (s && s.seq > antes && (!s.op || s.op === op)) {
          const codigo = s.resultado === 'ok' ? 200 : s.resultado === 'nao_autorizado' ? 401 : s.resultado === 'estado_invalido' ? 409 : s.resultado === 'limite' ? 429 : 400;
          return { codigo, status: s };
        }
      }
      return { codigo: 0, status: null, falha: 'timeout' };
    } catch {
      return { codigo: 0, status: null, falha: 'rede' };
    }
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
