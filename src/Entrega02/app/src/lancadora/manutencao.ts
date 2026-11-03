// Reparo da lançadora: zera os motores e deixa a máquina em repouso para o
// checklist armar de novo. É a saída para o caso mais comum do "não armou
// agora": uma sessão anterior (ou o watchdog, com a tela apagada) deixou a
// máquina ligada ou em PAUSADO, e o "armar" só vale em REPOUSO/ARMADO.
//
// Firmware 2.3+ faz tudo numa só ida ("resetar"). Num firmware antigo, que
// responde 400, o app faz o caminho longo: desligar, desarmar.

import { useLancadora } from './cliente';
import type { Resposta } from './contrato';
import { classificarFalha, type FalhaLancadora } from './falhas';

export type ResultadoReparo = {
  ok: boolean;
  relato: string;
  falha?: FalhaLancadora;
};

const NOME: Record<string, string> = {
  REPOUSO: 'em repouso',
  ARMADO: 'armada',
  LANCANDO: 'ligada',
  PAUSADO: 'pausada',
};

function respostaDe(codigo: Resposta['codigo'], status: Resposta['status']): Resposta {
  return { codigo, status };
}

const PARADA_SEGURA: ResultadoReparo['relato'] = 'Ela está em parada segura. O reinício só sai segurando o botão por 2 segundos.';

async function caminhoLongo(estadoInicial: string): Promise<ResultadoReparo> {
  const lanc = useLancadora.getState();
  const passos: string[] = [];
  let estado = estadoInicial;

  if (estado === 'LANCANDO' || estado === 'PAUSADO') {
    const r = await lanc.enviar('desligar');
    if (r.codigo !== 200) return { ok: false, relato: 'Não foi possível desligar os motores.', falha: classificarFalha('desligar', r, useLancadora.getState().status) ?? undefined };
    passos.push('motores desligados');
    estado = r.status?.estado ?? 'ARMADO';
  }

  if (estado === 'ARMADO') {
    const r = await lanc.enviar('desarmar');
    if (r.codigo !== 200) return { ok: false, relato: 'Não foi possível desarmar a lançadora.', falha: classificarFalha('desarmar', r, useLancadora.getState().status) ?? undefined };
    passos.push('lançadora desarmada');
  }

  const final = await lanc.enviar('status');
  const nome = NOME[final.status?.estado ?? 'REPOUSO'] ?? final.status?.estado;
  return {
    ok: true,
    relato: passos.length ? `${passos.join(', ')}. Agora ela está ${nome}.` : `Ela já estava ${nome}; nada a reparar.`,
  };
}

export async function repararLancadora(): Promise<ResultadoReparo> {
  const lanc = useLancadora.getState();
  const diagnostico = await lanc.enviar('status');
  const status = diagnostico.status ?? useLancadora.getState().status;

  if (!status) {
    return {
      ok: false,
      relato: 'A lançadora não respondeu ao diagnóstico.',
      falha: classificarFalha('status', diagnostico, null) ?? undefined,
    };
  }

  if (status.estado === 'PARADA_SEGURA') {
    return { ok: false, relato: PARADA_SEGURA, falha: classificarFalha('reiniciar', respostaDe(409, status), status) ?? undefined };
  }
  if (status.estado === 'REPOUSO') return { ok: true, relato: 'Ela já estava em repouso; nada a reparar.' };

  const antes = NOME[status.estado] ?? status.estado;
  let r = await lanc.enviar('resetar');
  // Resposta perdida: o status diz se o reset chegou.
  if (r.codigo === 0) {
    const s = await lanc.enviar('status');
    if (s.status?.estado === 'REPOUSO') r = { ...s, codigo: 200 };
  }
  if (r.codigo === 200) return { ok: true, relato: `Estava ${antes}: motores zerados e lançadora em repouso.` };
  // Firmware anterior ao 2.3 não conhece "resetar": pelo BLE responde 400;
  // pelo Wi-Fi o servidor devolve um 404 em texto (resposta_invalida).
  if (r.codigo === 400 || (r.codigo === 0 && r.falha === 'resposta_invalida')) return caminhoLongo(status.estado);
  if (r.codigo === 409 && r.status?.estado === 'PARADA_SEGURA') {
    return { ok: false, relato: PARADA_SEGURA, falha: classificarFalha('reiniciar', r, r.status) ?? undefined };
  }
  return { ok: false, relato: 'Não foi possível resetar a lançadora.', falha: classificarFalha('resetar', r, useLancadora.getState().status) ?? undefined };
}
