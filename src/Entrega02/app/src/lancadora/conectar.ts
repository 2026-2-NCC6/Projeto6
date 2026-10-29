// Conecta à lançadora salva nas configurações (transporte padrão + token).

import { PermissionsAndroid, Platform } from 'react-native';
import { lerToken } from '@/dados/segredos';
import type { TipoTransporte } from '@/dominio/tipos';
import { useApp } from '@/estado/app';
import { useLancadora } from './cliente';
import { TOKEN_SIMULADOR } from './simulador';

export async function pedirPermissaoBluetooth(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // no iOS o pedido sai na primeira busca
  const r = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

export async function temPermissaoBluetooth(): Promise<boolean> {
  if (Platform.OS !== 'android') return false; // no iOS só se sabe depois da primeira busca
  const r = await Promise.all([PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN), PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)]);
  return r.every(Boolean);
}

export async function conectarPadrao(tipo?: TipoTransporte): Promise<boolean> {
  const { config } = useApp.getState();
  const cliente = useLancadora.getState();
  if (config.modoDemonstracao) {
    return cliente.conectar({ tipo: 'wifi', token: TOKEN_SIMULADOR, nome: 'Lançadora simulada', simulado: true });
  }
  const token = await lerToken();
  if (!token) {
    useLancadora.setState({ erro: 'Informe o token da lançadora em Configurações.' });
    return false;
  }
  const t = tipo ?? config.transportePadrao;
  if (t === 'ble') {
    if (!config.dispositivoBle) {
      useLancadora.setState({ erro: 'Nenhuma lançadora Bluetooth pareada.' });
      return false;
    }
    if (!(await pedirPermissaoBluetooth())) {
      useLancadora.setState({ erro: 'Sem permissão de Bluetooth.' });
      return false;
    }
    return cliente.conectar({ tipo: 'ble', token, bleId: config.dispositivoBle.id, nome: config.dispositivoBle.nome });
  }
  return cliente.conectar({ tipo: 'wifi', token, nome: 'NockHug (Wi-Fi)' });
}
