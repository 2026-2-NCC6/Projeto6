// Transporte Wi-Fi: o celular entra no Access Point da lançadora e fala HTTP
// com 192.168.4.1. O status chega por polling.
//
// O ESP32 atende uma requisição por vez e o app também faz heartbeat. As
// requisições entram numa fila local, e o polling não compete com um comando:
// era essa concorrência que fazia um "armar" parecer que "não armou".
//
// No Android, a rede da lançadora não tem internet, e com os dados móveis
// ligados o sistema manda as requisições do app pela rede celular, onde
// 192.168.4.1 não existe: tudo estoura o tempo. O app se prende ao Wi-Fi
// enquanto a lançadora estiver conectada (vincularAoWifi).

import { Platform } from 'react-native';
import { desvincularWifi, vincularAoWifi } from '@/plataforma/nativo';
import {
  type Argumento,
  type Operacao,
  type Resposta,
  type StatusLancadora,
  type Transporte,
  lerStatus,
  TIMEOUT_COMANDO_MS,
  TIMEOUT_MS,
  WIFI_HOST,
  WIFI_SSID,
} from './contrato';

const POLL_MS = 600;

export class TransporteWifi implements Transporte {
  readonly tipo = 'wifi' as const;
  private ouvintes = new Set<(s: StatusLancadora) => void>();
  private ouvintesQueda = new Set<() => void>();
  private poll: ReturnType<typeof setInterval> | null = null;
  private falhasSeguidas = 0;
  private fila: Promise<unknown> = Promise.resolve();
  private comandosEmVoo = 0;
  private pollando = false;

  constructor(private token: string, private host = WIFI_HOST) {}

  private enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
    const proxima = this.fila.then(tarefa, tarefa);
    this.fila = proxima.then(
      () => undefined,
      () => undefined,
    );
    return proxima;
  }

  private async requisitar(caminho: string, timeoutMs = TIMEOUT_MS): Promise<Resposta> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`${this.host}${caminho}`, { signal: ctrl.signal });
      const texto = await r.text();
      const status = lerStatus(texto);
      if (status) this.emitir(status);
      this.falhasSeguidas = 0;
      if (!status) {
        // Um 200 sem JSON de status não confirma comando nenhum.
        return { codigo: 0, status: null, falha: 'resposta_invalida' };
      }
      return { codigo: r.status as Resposta['codigo'], status };
    } catch (e) {
      this.falhasSeguidas++;
      // Três falhas seguidas (~2 s) = conexão perdida. O firmware para os
      // motores sozinho em 4 s, então o app só precisa avisar.
      if (this.falhasSeguidas === 3) this.ouvintesQueda.forEach((cb) => cb());
      const abortou = e instanceof Error && (e.name === 'AbortError' || /\babort/i.test(e.message));
      return { codigo: 0, status: null, falha: abortou ? 'timeout' : 'rede' };
    } finally {
      clearTimeout(t);
    }
  }

  private emitir(s: StatusLancadora) {
    this.ouvintes.forEach((cb) => cb(s));
  }

  async conectar(): Promise<StatusLancadora> {
    this.falhasSeguidas = 0;
    const presoAoWifi = Platform.OS === 'android' && vincularAoWifi();
    const r = await this.requisitar('/status');
    if (!r.status) {
      if (presoAoWifi) desvincularWifi();
      throw new Error(
        r.falha === 'resposta_invalida'
          ? 'A lançadora respondeu num formato desconhecido. Confira a versão do firmware.'
          : Platform.OS === 'android' && !presoAoWifi
            ? `Lançadora não encontrada. Conecte o celular à rede ${WIFI_SSID} (se o Android avisar que ela não tem internet, escolha manter a conexão).`
            : `Lançadora não encontrada. O celular está na rede ${WIFI_SSID}?`,
      );
    }
    this.poll = setInterval(() => {
      if (this.comandosEmVoo > 0 || this.pollando) return;
      this.pollando = true;
      void this.enfileirar(() => this.requisitar('/status')).finally(() => {
        this.pollando = false;
      });
    }, POLL_MS);
    return r.status;
  }

  async desconectar(): Promise<void> {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    if (Platform.OS === 'android') desvincularWifi();
  }

  enviar(op: Operacao, arg?: Argumento, urgente = false): Promise<Resposta> {
    const q = new URLSearchParams();
    if (op !== 'status') q.set('token', this.token);
    if (arg && 'bolas' in arg) q.set('bolas', String(arg.bolas));
    if (arg && 'duracaoMs' in arg) q.set('duracaoMs', String(arg.duracaoMs));
    if (arg && 'msPorBola' in arg) {
      q.set('msPorBola', String(arg.msPorBola));
      if (arg.alimentador != null) q.set('alimentador', String(arg.alimentador));
    }
    if (arg && 'velocidade' in arg && arg.velocidade) {
      q.set('lancador', String(arg.velocidade.lancador));
      q.set('alimentador', String(arg.velocidade.alimentador));
    }
    const timeout = op === 'status' || op === 'ping' ? TIMEOUT_MS : TIMEOUT_COMANDO_MS;
    const caminho = `/${op}?${q.toString()}`;
    // Emergência não espera o polling nem um comando em curso no app. O ESP32
    // ainda atende uma requisição por vez, mas a nossa fila não a segura.
    if (urgente) return this.requisitar(caminho, timeout);
    this.comandosEmVoo++;
    return this.enfileirar(() => this.requisitar(caminho, timeout)).finally(() => {
      this.comandosEmVoo--;
    });
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
