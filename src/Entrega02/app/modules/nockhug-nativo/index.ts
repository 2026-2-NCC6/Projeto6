// Ponte para o módulo nativo do NockHug (modules/nockhug-nativo). Opcional:
// num build antigo, sem o módulo, cada função vira uma operação vazia e o app
// continua abrindo (só sem escuta em segundo plano no Android).

import { requireOptionalNativeModule } from 'expo';

export type TipoEntrada = 'fone_bt' | 'fone_fio' | 'celular';
export type EntradaDeAudio = { tipo: TipoEntrada; nome: string | null };

type Modulo = {
  iniciarEscuta(titulo: string, texto: string): boolean;
  pararEscuta(): void;
  vincularAoWifi(): boolean;
  desvincularWifi(): void;
  usarMicrofoneDoFone(ligar: boolean): string | null;
  entradaDeAudio(): EntradaDeAudio;
  foneBluetoothDisponivel(): string | null;
  preferirMicrofoneDoCelular(ligar: boolean): void;
};

const nativo = requireOptionalNativeModule<Modulo>('NockhugNativo');

function seguro<T>(f: () => T, padrao: T): T {
  if (!nativo) return padrao;
  try {
    return f();
  } catch {
    return padrao;
  }
}

export const moduloNativoDisponivel = !!nativo;

export function iniciarEscutaEmSegundoPlano(titulo: string, texto: string): boolean {
  return seguro(() => nativo!.iniciarEscuta(titulo, texto), false);
}

export function pararEscutaEmSegundoPlano(): void {
  seguro(() => nativo!.pararEscuta(), undefined);
}

export function vincularAoWifi(): boolean {
  return seguro(() => nativo!.vincularAoWifi(), false);
}

export function desvincularWifi(): void {
  seguro(() => nativo!.desvincularWifi(), undefined);
}

export function usarMicrofoneDoFone(ligar: boolean): string | null {
  return seguro(() => nativo!.usarMicrofoneDoFone(ligar), null);
}

export function entradaDeAudio(): EntradaDeAudio {
  const e = seguro<EntradaDeAudio | null>(() => nativo!.entradaDeAudio(), null);
  return e && (e.tipo === 'fone_bt' || e.tipo === 'fone_fio' || e.tipo === 'celular') ? { tipo: e.tipo, nome: e.nome ?? null } : { tipo: 'celular', nome: null };
}

// Nome do fone Bluetooth com microfone conectado agora, sem passar a usá-lo.
export function foneBluetoothDisponivel(): string | null {
  return seguro(() => nativo!.foneBluetoothDisponivel() ?? null, null);
}

// Força o microfone do celular mesmo com um fone conectado (ou devolve a
// escolha ao sistema, com false).
export function preferirMicrofoneDoCelular(ligar: boolean): void {
  seguro(() => nativo!.preferirMicrofoneDoCelular(ligar), undefined);
}
