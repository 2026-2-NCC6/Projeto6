import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bolasDaSessao } from '@/dominio/tipos';
import { useApp } from '@/estado/app';
import { ItemSessao } from '@/telas/ItemSessao';
import { FaixaStatus, Cartao, Numero, Opcao, Quadra, Rotulo, Segmentos, Texto, Titulo } from '@/ui/componentes';
import { dia, milhar } from '@/ui/formato';
import * as Icone from '@/ui/icones';
import { useTema } from '@/ui/tema';
import { useAgora } from '@/ui/useAgora';

const PERIODOS = { '7': 7, '30': 30, tudo: Infinity } as const;
type Periodo = keyof typeof PERIODOS;

export default function Historico() {
  const { c } = useTema();
  const topo = useSafeAreaInsets().top;
  const sessoes = useApp((s) => s.sessoes);
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [treino, setTreino] = useState<string | null>(null);

  const agora = useAgora();
  const nomes = useMemo(() => [...new Set(sessoes.map((s) => s.treino.nome))], [sessoes]);
  const filtradas = useMemo(() => {
    const desde = agora - PERIODOS[periodo] * 86_400_000;
    return sessoes.filter((s) => s.inicio >= desde && (!treino || s.treino.nome === treino));
  }, [sessoes, periodo, treino, agora]);

  const bolas = filtradas.reduce((t, s) => t + bolasDaSessao(s), 0);
  const horas = filtradas.reduce((t, s) => t + (s.fim - s.inicio), 0) / 3_600_000;
  const grupos = filtradas.reduce<[string, typeof filtradas][]>((acc, s) => {
    const d = dia(s.inicio);
    const ultimo = acc[acc.length - 1];
    if (ultimo && ultimo[0] === d) ultimo[1].push(s);
    else acc.push([d, [s]]);
    return acc;
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: topo + 10, gap: 12, paddingBottom: 32 }}>
        <Titulo estilo={{ marginBottom: 4 }}>Histórico</Titulo>
        <Segmentos opcoes={[['7', '7 dias'], ['30', '30 dias'], ['tudo', 'Tudo']]} valor={periodo} aoMudar={setPeriodo} />
        {nomes.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
            <Opcao redondo texto="Todos" ativo={!treino} aoTocar={() => setTreino(null)} />
            {nomes.map((n) => <Opcao key={n} redondo texto={n} ativo={treino === n} aoTocar={() => setTreino(n)} />)}
          </ScrollView>
        )}
        <Quadra estilo={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 6 }} linhas={false}>
          {(
            [
              [String(filtradas.length), filtradas.length === 1 ? 'sessão' : 'sessões'],
              [milhar(bolas), 'bolas estimadas'],
              [`${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`, 'em quadra'],
            ] as const
          ).map(([v, r], i) => (
            <View key={r} style={{ flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: i ? 1 : 0, borderLeftColor: 'rgba(246,249,232,0.12)' }}>
              <Numero tamanho={28} cor={i === 1 ? c.limao : c.quadraTexto}>{v}</Numero>
              <Texto tamanho={12} cor={c.quadraTextoSuave}>{r}</Texto>
            </View>
          ))}
        </Quadra>
        {grupos.length === 0 && (
          <Cartao estilo={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
            <Icone.Relogio cor={c.textoFraco} tamanho={30} />
            <Texto tamanho={15} cor={c.textoSuave}>Nenhuma sessão neste período.</Texto>
          </Cartao>
        )}
        {grupos.map(([d, ss]) => (
          <View key={d} style={{ gap: 8 }}>
            <Rotulo>{d}</Rotulo>
            {ss.map((s) => <ItemSessao key={s.id} s={s} comData={false} />)}
          </View>
        ))}
      </ScrollView>
      <FaixaStatus />
    </View>
  );
}
