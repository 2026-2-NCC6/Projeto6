import { router } from 'expo-router';
import { View } from 'react-native';
import { bolasDaSessao, type Sessao } from '@/dominio/tipos';
import { useApp } from '@/estado/app';
import { Numero, Texto, Toque } from '@/ui/componentes';
import { dia, hora, minutos } from '@/ui/formato';
import * as Icone from '@/ui/icones';
import { useTema } from '@/ui/tema';

export function ItemSessao({ s, comData = true }: { s: Sessao; comData?: boolean }) {
  const { c } = useTema();
  const envio = useApp((st) => st.envios[s.id]);
  const bolas = bolasDaSessao(s);
  const nuvem = envio === 'enviada' ? ' · na nuvem' : envio === 'pendente' ? ' · neste aparelho' : envio === 'conflito' ? ' · conflito ao enviar' : '';
  const parada = s.encerradaPor === 'parada_segura' || s.series.some((x) => x.motivo === 'emergencia');
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={`${s.treino.nome}, ${bolas} bolas, ${dia(s.inicio)}${parada ? ', parada segura' : ''}`}
      onPress={() => router.push({ pathname: '/resultado/[id]', params: { id: s.id, origem: 'historico' } })}
      estilo={{ backgroundColor: c.cartao, borderWidth: c.sombra ? 0 : 1, borderColor: c.borda, boxShadow: c.sombra, borderRadius: 20, padding: 12, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: parada ? c.perigoSuave : c.quadra, alignItems: 'center', justifyContent: 'center' }}>
        <Numero tamanho={20} cor={parada ? c.perigoTexto : c.limao}>{bolas}</Numero>
        <Texto tamanho={10} peso="semi" cor={parada ? c.perigoTexto : c.quadraTextoSuave} estilo={{ marginTop: -3 }}>bolas</Texto>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Texto tamanho={16} peso="negrito" linhas={1} estilo={{ flexShrink: 1 }}>{s.treino.nome}</Texto>
          {parada && <Icone.Alerta cor={c.perigo} tamanho={15} />}
        </View>
        <Texto tamanho={13} cor={c.textoSuave} linhas={1}>
          {comData ? `${dia(s.inicio)}, ` : ''}
          {hora(s.inicio)} · {s.series.length} {s.series.length === 1 ? 'série' : 'séries'} · {minutos(s.fim - s.inicio)}
        </Texto>
        <Texto tamanho={12} cor={c.textoFraco} linhas={1}>
          {s.transporte === 'ble' ? 'Bluetooth' : s.transporte === 'simulada' ? 'Simulada' : 'Wi-Fi'}{parada ? ' · parada segura' : ''}{nuvem}
        </Texto>
      </View>
      <View style={{ paddingHorizontal: 9, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: c.begeSuave }}>
        <Texto tamanho={13} peso="negrito" cor={c.begeTexto} estilo={{ fontVariant: ['tabular-nums'] }}>+{s.xp} XP</Texto>
      </View>
    </Toque>
  );
}
