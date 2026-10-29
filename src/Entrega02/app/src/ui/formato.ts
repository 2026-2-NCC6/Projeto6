import { chaveDia } from '@/dominio/gamificacao';

export const hora = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function dia(ts: number): string {
  const hoje = Date.now();
  if (chaveDia(ts) === chaveDia(hoje)) return 'Hoje';
  if (chaveDia(ts) === chaveDia(hoje - 86_400_000)) return 'Ontem';
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function cronometro(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const minutos = (ms: number) => `${Math.max(1, Math.round(ms / 60000))} min`;

export const milhar = (n: number) => n.toLocaleString('pt-BR');

export function saudacao(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Boa noite,' : h < 12 ? 'Bom dia,' : h < 18 ? 'Boa tarde,' : 'Boa noite,';
}
