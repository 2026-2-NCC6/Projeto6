// Resultado da sessão (PRD RE-1 e RE-3). Também é o detalhe de uma sessão do
// histórico.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { CONQUISTAS, diasAtivos, sequencia, XP_POR_SESSAO } from '@/dominio/gamificacao';
import { bolasDaSessao } from '@/dominio/tipos';
import { resumir, useApp } from '@/estado/app';
import { useSessao } from '@/sessao/sessao';
import { Botao, Cartao, Negrito, Numero, Quadra, Rotulo, Tela, Texto, Titulo, Voltar } from '@/ui/componentes';
import { cronometro, dia, hora } from '@/ui/formato';
import * as Icone from '@/ui/icones';
import { EASE_OUT, entrada, haptico, pouso } from '@/ui/movimento';
import { fontes, paleta, useTema } from '@/ui/tema';
import { useAgora } from '@/ui/useAgora';

const TextoAnimado = Animated.createAnimatedComponent(TextInput);

// O XP sobe de 0 até o total na thread de UI; sem re-render por quadro.
function ContagemXP({ valor, animar }: { valor: number; animar: boolean }) {
  const reduzir = useReducedMotion();
  const n = useSharedValue(animar && !reduzir ? 0 : valor);
  useEffect(() => {
    if (animar && !reduzir) n.set(withDelay(350, withTiming(valor, { duration: 1100, easing: EASE_OUT })));
  }, [animar, reduzir, valor, n]);
  const props = useAnimatedProps(() => ({ text: `+${Math.round(n.get())}`, defaultValue: `+${valor}` }) as never);
  return (
    <TextoAnimado
      editable={false}
      accessibilityLabel={`${valor} XP`}
      animatedProps={props}
      defaultValue={`+${valor}`}
      maxFontSizeMultiplier={1.2}
      style={{ fontFamily: fontes.titulo, fontSize: 64, lineHeight: 68, letterSpacing: -2, color: paleta.limao, padding: 0, fontVariant: ['tabular-nums'] }}
    />
  );
}

export default function Resultado() {
  const { c } = useTema();
  const { id, origem } = useLocalSearchParams<{ id: string; origem?: string }>();
  const sessoes = useApp((s) => s.sessoes);
  const conquistas = useApp((s) => s.conquistas);
  const s = sessoes.find((x) => x.id === id);
  const doHistorico = origem === 'historico';
  const anima = !doHistorico;

  const novas = useMemo(() => (s ? CONQUISTAS.filter((k) => (conquistas.get(k.id) ?? 0) >= s.fim) : []), [s, conquistas]);
  const agora = useAgora();
  const seq = useMemo(() => sequencia(diasAtivos(sessoes.map(resumir)), agora), [sessoes, agora]);
  const limpou = useRef(false);
  useEffect(() => {
    if (!doHistorico && !limpou.current) {
      limpou.current = true;
      useSessao.getState().descartar();
      if (s?.encerradaPor !== 'parada_segura') haptico.sucesso();
    }
  }, [doHistorico, s?.encerradaPor]);

  if (!s) {
    return (
      <Tela estilo={{ justifyContent: 'center' }}>
        <Titulo>Sessão não encontrada</Titulo>
        <Botao titulo="Voltar ao início" aoTocar={() => router.replace('/inicio')} />
      </Tela>
    );
  }

  const parada = s.encerradaPor === 'parada_segura';
  const bolas = bolasDaSessao(s);
  const bonusSeq = s.xp - bolas - XP_POR_SESSAO;
  const maxBolas = Math.max(1, ...s.series.map((x) => x.bolas));
  const aceitos = s.comandos.filter((x) => x.aceito).length;
  const comVoz = s.comandos.filter((x) => x.origem === 'voz');
  const latencias = s.comandos.filter((x) => x.latenciaMs != null).map((x) => x.latenciaMs!);
  const latenciaMedia = latencias.length ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length) : null;
  const e = (atraso: number) => (anima ? entrada(atraso) : undefined);

  return (
    <Tela>
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingBottom: 12 }}>
        {doHistorico && <Voltar />}

        <Animated.View entering={anima ? pouso() : undefined}>
          <Quadra estilo={{ gap: 14, paddingTop: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: parada ? c.perigo : paleta.limao }}>
                {parada ? <Icone.Cadeado cor="#FFFFFF" tamanho={28} /> : <Icone.Trofeu cor={paleta.verde} tamanho={28} />}
              </View>
              <View style={{ flex: 1 }}>
                <Titulo tamanho={26} cor={c.quadraTexto}>{parada ? 'Parada segura' : s.encerradaPor === 'concluida' ? 'Sessão concluída' : 'Sessão encerrada'}</Titulo>
                <Texto tamanho={14} cor={c.quadraTextoSuave} linhas={1}>{s.treino.nome} · {dia(s.inicio).toLowerCase()}, {hora(s.inicio)} – {hora(s.fim)}</Texto>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <ContagemXP valor={s.xp} animar={anima} />
              <Texto tamanho={18} peso="negrito" cor={c.quadraTextoSuave} estilo={{ marginBottom: 10 }}>XP</Texto>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[`${bolas} bolas`, `+${XP_POR_SESSAO} sessão`, ...(bonusSeq > 0 ? [`+${bonusSeq} sequência`] : [])].map((t) => (
                <View key={t} style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: 'rgba(246,249,232,0.09)' }}>
                  <Texto tamanho={13} peso="semi" cor={c.quadraTexto}>{t}</Texto>
                </View>
              ))}
            </View>
          </Quadra>
        </Animated.View>

        <Animated.View entering={e(140)}>
          <Cartao estilo={{ flexDirection: 'row', paddingHorizontal: 4 }}>
            {(
              [
                [String(bolas), 'bolas estimadas'],
                [s.treino.series ? `${s.series.length}/${s.treino.series}` : String(s.series.length), 'séries'],
                [cronometro(s.fim - s.inicio), 'duração'],
              ] as const
            ).map(([v, r], i) => (
              <View key={r} style={{ flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.borda }}>
                <Numero tamanho={30}>{v}</Numero>
                <Texto tamanho={12} cor={c.textoSuave}>{r}</Texto>
              </View>
            ))}
          </Cartao>
        </Animated.View>

        {!doHistorico && (
          <Animated.View entering={e(220)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.begeSuave, borderRadius: 20, padding: 14 }}>
            <Icone.Fogo tamanho={32} cor={c.bege} miolo={c.amarelo} />
            <Texto tamanho={15} cor={c.begeTexto} estilo={{ flex: 1 }}>
              <Negrito>Sequência: {seq} {seq === 1 ? 'dia' : 'dias'}.</Negrito> {parada ? 'Parar quando precisa também é treinar.' : 'Volte amanhã para manter o foguinho.'}
            </Texto>
          </Animated.View>
        )}

        {novas.length > 0 && (
          <View style={{ gap: 8 }}>
            <Rotulo>{novas.length === 1 ? 'Conquista desbloqueada' : 'Conquistas desbloqueadas'}</Rotulo>
            {novas.map((k, i) => (
              <Animated.View key={k.id} entering={anima ? pouso(500 + i * 120) : undefined}>
                <Cartao destaque={c.bege} estilo={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.bege, borderWidth: 3, borderColor: c.amarelo, alignItems: 'center', justifyContent: 'center' }}>
                    <Texto tamanho={16} cor={paleta.verde} estilo={{ fontFamily: fontes.titulo }}>{k.sigla}</Texto>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Texto tamanho={16} peso="negrito">{k.titulo}</Texto>
                    <Texto tamanho={13} cor={c.textoSuave}>{k.dica}</Texto>
                  </View>
                </Cartao>
              </Animated.View>
            ))}
          </View>
        )}

        <Animated.View entering={e(300)}>
          <Cartao estilo={{ gap: 12 }}>
            <Titulo tamanho={18}>Bolas por série</Titulo>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 104 }}>
              {s.series.map((x) => (
                <View key={x.indice} style={{ flex: 1, maxWidth: 60, alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%' }}>
                  <Texto tamanho={12} peso="semi" cor={c.textoSuave}>{x.bolas}</Texto>
                  <View style={{ width: '100%', height: Math.max(6, (x.bolas / maxBolas) * 62), borderRadius: 8, backgroundColor: x.motivo === 'emergencia' ? c.perigo : c.progresso }} />
                  <Texto tamanho={12} cor={c.textoFraco}>S{x.indice}</Texto>
                </View>
              ))}
            </View>
            <Texto tamanho={13} cor={c.textoSuave}>
              {s.comandos.length} comandos ({comVoz.length} por voz) · {aceitos} aceitos · {s.comandos.length - aceitos} recusados{latenciaMedia != null ? ` · resposta média ${latenciaMedia} ms` : ''}
            </Texto>
          </Cartao>
        </Animated.View>

        <Animated.View entering={e(360)}>
          <Cartao estilo={{ gap: 2 }}>
            <Titulo tamanho={18} estilo={{ marginBottom: 6 }}>Registro de comandos</Titulo>
            {s.comandos.length === 0 && <Texto tamanho={14} cor={c.textoSuave}>Nenhum comando registrado.</Texto>}
            {s.comandos.map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: c.sutil }}>
                <Texto tamanho={13} cor={c.textoFraco} estilo={{ width: 64, fontVariant: ['tabular-nums'] }}>{new Date(x.ts).toLocaleTimeString('pt-BR')}</Texto>
                {x.origem === 'voz' ? <Icone.Microfone cor={c.textoFraco} tamanho={14} /> : x.origem === 'auto' ? <Icone.Relogio cor={c.textoFraco} tamanho={14} /> : <Icone.Alvo cor={c.textoFraco} tamanho={14} />}
                <Texto tamanho={14} linhas={1} estilo={{ flex: 1, fontStyle: x.origem === 'voz' ? 'italic' : 'normal' }}>{x.origem === 'voz' ? `“${x.transcricao}”` : x.origem === 'auto' ? `automático ${x.comando}` : `botão ${x.comando}`}</Texto>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {x.aceito && <Icone.Check cor={c.destaque} tamanho={13} />}
                  <Texto tamanho={13} peso="negrito" cor={x.aceito ? c.destaque : c.perigoTexto}>{x.aceito ? (x.motivo ?? x.comando) : (x.motivo ?? 'recusado')}</Texto>
                </View>
              </View>
            ))}
          </Cartao>
        </Animated.View>
      </ScrollView>
      {!doHistorico && <Botao titulo="Voltar ao início" aoTocar={() => router.replace('/inicio')} />}
    </Tela>
  );
}
