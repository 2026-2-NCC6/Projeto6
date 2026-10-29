// Números de progresso derivados das sessões gravadas (Home, Conquistas).

import { useMemo } from 'react';
import { chaveDia, diasAtivos, diasDaSemana, mapaDeCalor, nivel, sequencia } from '@/dominio/gamificacao';
import { bolasDaSessao } from '@/dominio/tipos';
import { useAgora } from '@/ui/useAgora';
import { resumir, useApp } from './app';

export function useProgresso() {
  const sessoes = useApp((s) => s.sessoes);
  const meta = useApp((s) => s.perfil?.metaSemanal ?? 3);
  const agora = useAgora();
  return useMemo(() => {
    const resumos = sessoes.map(resumir);
    const ativos = diasAtivos(resumos);
    const semana = diasDaSemana(ativos, agora);
    const xpTotal = sessoes.reduce((t, s) => t + s.xp, 0);
    const hoje = chaveDia(agora);
    const seriesDeHoje = sessoes.filter((s) => chaveDia(s.inicio) === hoje).flatMap((s) => s.series);
    return {
      sequencia: sequencia(ativos, agora),
      semana,
      diasNaSemana: semana.filter(Boolean).length,
      meta,
      xpTotal,
      nivel: nivel(xpTotal),
      calor: mapaDeCalor(resumos, agora),
      seriesDeHoje,
      bolasTotal: sessoes.reduce((t, s) => t + bolasDaSessao(s), 0),
    };
  }, [sessoes, meta, agora]);
}
