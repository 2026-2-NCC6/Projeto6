import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { CONQUISTAS, XP_POR_DIA_NA_SEQUENCIA, XP_POR_SESSAO } from '@/dominio/gamificacao';
import { useApp } from '@/estado/app';
import { useProgresso } from '@/estado/progresso';
import { FaixaStatus, Barra, Numero, Quadra, Texto, Titulo } from '@/ui/componentes';
import { milhar } from '@/ui/formato';
import * as Icone from '@/ui/icones';
import { fontes, paleta, useTema } from '@/ui/tema';

function Anel({ fracao, nivel }: { fracao: number; nivel: number }) {
  const { c } = useTema();
  const r = 44;
  const comp = 2 * Math.PI * r;
  return (
    <View style={{ width: 108, height: 108, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Nível ${nivel}, ${Math.round(fracao * 100)}% do caminho para o próximo`}>
      <Svg width={108} height={108} style={{ position: 'absolute' }}>
        <Circle cx={54} cy={54} r={r} stroke="rgba(246,249,232,0.12)" strokeWidth={9} fill="none" />
        <Circle cx={54} cy={54} r={r} stroke={paleta.limao} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={`${comp}`} strokeDashoffset={comp * (1 - fracao)} rotation={-90} originX={54} originY={54} />
      </Svg>
      <Numero tamanho={40} cor={c.quadraTexto}>{nivel}</Numero>
    </View>
  );
}

export default function Conquistas() {
  const { c } = useTema();
  const topo = useSafeAreaInsets().top;
  const p = useProgresso();
  const desbloqueadas = useApp((s) => s.conquistas);
  const total = CONQUISTAS.filter((k) => desbloqueadas.get(k.id)).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: topo + 10, gap: 14, paddingBottom: 32 }}>
        <Titulo estilo={{ marginBottom: 4 }}>Conquistas</Titulo>
        <Quadra estilo={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Anel fracao={p.nivel.xpNoNivel / p.nivel.xpDoNivel} nivel={p.nivel.nivel} />
            <View style={{ flex: 1, gap: 4 }}>
              <Titulo tamanho={26} cor={c.quadraTexto}>Nível {p.nivel.nivel}</Titulo>
              <Texto tamanho={14} cor={c.quadraTextoSuave}>
                <Texto tamanho={14} peso="negrito" cor={c.limao}>{p.nivel.xpNoNivel}</Texto> de {p.nivel.xpDoNivel} XP · faltam {p.nivel.xpDoNivel - p.nivel.xpNoNivel} para o nível {p.nivel.nivel + 1}
              </Texto>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {[`1 XP por bola`, `+${XP_POR_SESSAO} por sessão`, `+${XP_POR_DIA_NA_SEQUENCIA} por dia de sequência`].map((t) => (
              <View key={t} style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: 'rgba(246,249,232,0.08)' }}>
                <Texto tamanho={12} peso="semi" cor={c.quadraTextoSuave}>{t}</Texto>
              </View>
            ))}
          </View>
        </Quadra>
  
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
          <Titulo tamanho={20}>Medalhas</Titulo>
          <Texto tamanho={14} cor={c.textoSuave} estilo={{ fontVariant: ['tabular-nums'] }}>{total} de {CONQUISTAS.length}</Texto>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CONQUISTAS.map((k) => {
            const em = desbloqueadas.get(k.id);
            const alvo = k.id === 'bolas_1000' ? 1000 : k.id === 'bolas_100' ? 100 : null;
            return (
              <View
                key={k.id}
                accessibilityLabel={`${k.titulo}: ${em ? 'desbloqueada' : 'bloqueada'}`}
                style={{
                  width: '48%',
                  flexGrow: 1,
                  minHeight: 150,
                  backgroundColor: em ? c.cartao : 'transparent',
                  borderWidth: em ? (c.sombra ? 0 : 1) : 1.5,
                  borderStyle: em ? 'solid' : 'dashed',
                  borderColor: em ? c.borda : c.bordaForte,
                  boxShadow: em ? c.sombra : '',
                  borderRadius: 22,
                  padding: 14,
                  gap: 8,
                }}
              >
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: em ? c.bege : c.sutil, alignItems: 'center', justifyContent: 'center', borderWidth: em ? 3 : 0, borderColor: c.amarelo }}>
                  {em ? (
                    <Texto tamanho={16} cor={c.quadra} estilo={{ fontFamily: fontes.titulo, letterSpacing: -0.3 }}>{k.sigla}</Texto>
                  ) : (
                    <Icone.Cadeado cor={c.textoFraco} tamanho={22} />
                  )}
                </View>
                <Texto tamanho={15} peso="negrito" cor={em ? c.texto : c.textoSuave}>{k.titulo}</Texto>
                {em ? (
                  <Texto tamanho={12} cor={c.begeTexto} peso="semi">Desbloqueada em {new Date(em).toLocaleDateString('pt-BR')}</Texto>
                ) : alvo ? (
                  <View style={{ gap: 6, marginTop: 'auto' }}>
                    <Texto tamanho={12} cor={c.textoSuave} estilo={{ fontVariant: ['tabular-nums'] }}>{milhar(Math.min(p.bolasTotal, alvo))} de {milhar(alvo)}</Texto>
                    <Barra fracao={p.bolasTotal / alvo} altura={6} />
                  </View>
                ) : (
                  <Texto tamanho={12} cor={c.textoSuave}>{k.dica}</Texto>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <FaixaStatus />
    </View>
  );
}
