// Ilustração do NockHug sobre a quadra: o alimentador (M2) gira devagar, a
// roda do cano (M1) gira rápido e cada bola sai em arco com um rastro curto.
// Parada quando os motores estão parados. Sempre desenhada sobre a superfície
// verde (Quadra), por isso as cores são fixas.
//
// As peças que giram ficam em Animated.View sobre o SVG: rotação animada em
// grupos do react-native-svg não é aplicada pelo Reanimated 4.

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { paleta } from './tema';

const CirculoAnimado = Animated.createAnimatedComponent(Circle);
const LARGURA = 320;
const ALTURA = 160;
const CORPO = '#0A1F07';
const CREME = '#F6F9E8';
const VOO_MS = 1150;

function useGiro(ativo: boolean, ms: number) {
  const a = useSharedValue(0);
  useEffect(() => {
    if (ativo) {
      a.set(0);
      a.set(withRepeat(withTiming(360, { duration: ms, easing: Easing.linear }), -1, false));
    } else {
      cancelAnimation(a);
    }
  }, [ativo, ms, a]);
  return a;
}

function useVoo(ativo: boolean, atraso: number) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (ativo) {
      t.set(0);
      t.set(withDelay(atraso, withRepeat(withTiming(1, { duration: VOO_MS, easing: Easing.bezier(0.2, 0.6, 0.35, 1) }), -1, false)));
    } else {
      cancelAnimation(t);
      t.set(0);
    }
  }, [ativo, atraso, t]);
  return t;
}

// Trajetória da boca do cano até a quadra; termina antes da borda do viewBox.
function ponto(t: number) {
  'worklet';
  return { x: 256 + 54 * t, y: 38 - 44 * t + 38 * t * t };
}

function BolaEmVoo({ t, atraso, raio, opacidade }: { t: SharedValue<number>; atraso: number; raio: number; opacidade: number }) {
  const props = useAnimatedProps(() => {
    const v = Math.max(0, t.get() - atraso);
    const p = ponto(v);
    const vis = t.get() > atraso ? opacidade * interpolate(v, [0, 0.08, 0.75, 1], [0, 1, 1, 0]) : 0;
    return { cx: p.x, cy: p.y, opacity: vis };
  });
  return <CirculoAnimado animatedProps={props} r={raio} fill={paleta.limao} />;
}

function Clarao({ t }: { t: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ opacity: interpolate(t.get(), [0, 0.06, 0.22], [0, 0.55, 0], 'clamp') }));
  return <CirculoAnimado animatedProps={props} cx={252} cy={40} r={16} fill="url(#clarao)" />;
}

export function Lancadora({ girando, altura = 128, rotulos = false }: { girando: boolean; altura?: number; rotulos?: boolean }) {
  const reduzir = useReducedMotion();
  const ativo = girando && !reduzir;
  const [largura, setLargura] = useState(0);
  const alimentador = useGiro(ativo, 3000);
  const roda = useGiro(ativo, 360);
  const b1 = useVoo(ativo, 0);
  const b2 = useVoo(ativo, VOO_MS / 2);

  const giroAlim = useAnimatedStyle(() => ({ transform: [{ rotate: `${alimentador.get()}deg` }] }));
  const giroRoda = useAnimatedStyle(() => ({ transform: [{ rotate: `${roda.get()}deg` }] }));

  // Mesma escala do viewBox (meet, centralizado), para alinhar as peças.
  const s = largura ? Math.min(largura / LARGURA, altura / ALTURA) : 0;
  const dx = (largura - LARGURA * s) / 2;
  const dy = (altura - ALTURA * s) / 2;
  const caixa = (cx: number, cy: number, r: number) => ({ position: 'absolute' as const, left: dx + (cx - r) * s, top: dy + (cy - r) * s, width: 2 * r * s, height: 2 * r * s });

  return (
    <View style={{ height: altura }} onLayout={(e) => setLargura(e.nativeEvent.layout.width)} accessibilityLabel={girando ? 'Lançadora disparando' : 'Lançadora parada'}>
      <Svg width="100%" height={altura} viewBox={`0 0 ${LARGURA} ${ALTURA}`}>
        <Defs>
          <LinearGradient id="corpo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#163A10" />
            <Stop offset="1" stopColor={CORPO} />
          </LinearGradient>
          <LinearGradient id="cano" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#97AE91" />
            <Stop offset="0.45" stopColor={paleta.verdeSec} />
            <Stop offset="1" stopColor="#3F573B" />
          </LinearGradient>
          <RadialGradient id="disco" cx="40%" cy="35%" r="70%">
            <Stop offset="0" stopColor="#F3E3AE" />
            <Stop offset="1" stopColor="#C9AE5C" />
          </RadialGradient>
          <RadialGradient id="clarao" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={paleta.limao} stopOpacity={1} />
            <Stop offset="1" stopColor={paleta.limao} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="sombra" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#000" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Line x1={8} y1={150} x2={312} y2={150} stroke={CREME} strokeOpacity={0.22} strokeWidth={2} strokeLinecap="round" />
        <Rect x={22} y={140} width={150} height={14} rx={7} fill="url(#sombra)" />

        <G transform="rotate(-20 100 96)">
          <Rect x={96} y={84} width={156} height={24} rx={12} fill="url(#cano)" />
          <Rect x={104} y={87} width={136} height={3} rx={1.5} fill={paleta.amarelo} opacity={0.4} />
        </G>
        <Rect x={26} y={98} width={140} height={46} rx={15} fill="url(#corpo)" />
        <Rect x={36} y={102} width={120} height={2} rx={1} fill={CREME} opacity={0.12} />
        <Circle cx={52} cy={146} r={6} fill={CORPO} stroke="#2D5223" strokeWidth={2} />
        <Circle cx={140} cy={146} r={6} fill={CORPO} stroke="#2D5223" strokeWidth={2} />
        <Circle cx={74} cy={84} r={33} fill="url(#disco)" stroke={CORPO} strokeWidth={3} />
        <Circle cx={74} cy={84} r={22} fill="none" stroke={CORPO} strokeOpacity={0.25} strokeWidth={1.5} />

        <Clarao t={b1} />
        <Clarao t={b2} />
        {[b1, b2].map((t, i) => (
          <G key={i}>
            <BolaEmVoo t={t} atraso={0.1} raio={4} opacidade={0.18} />
            <BolaEmVoo t={t} atraso={0.05} raio={5.5} opacidade={0.38} />
            <BolaEmVoo t={t} atraso={0} raio={7} opacidade={1} />
          </G>
        ))}

        {rotulos && (
          <>
            <SvgText x={96} y={127} textAnchor="middle" fontSize={10} fontWeight="700" fill={CREME} opacity={0.85}>M2 · 20 RPM</SvgText>
            <SvgText x={196} y={20} textAnchor="middle" fontSize={10} fontWeight="700" fill={paleta.limao}>M1 · 14 000 RPM</SvgText>
          </>
        )}
      </Svg>
      {s > 0 && (
        <>
          <Animated.View pointerEvents="none" style={[caixa(74, 84, 28), giroAlim]}>
            <Svg width="100%" height="100%" viewBox="46 56 56 56">
              {[
                [74, 65],
                [90.5, 93.5],
                [57.5, 93.5],
              ].map(([x, y]) => (
                <G key={`${x}`}>
                  <Circle cx={x} cy={y} r={7.5} fill={paleta.limao} />
                  <Path d={`M${x - 4.5} ${y - 5.5}c2.5 1.8 3.4 3.6 3.4 5.5s-.9 3.7-3.4 5.5`} stroke={paleta.amarelo} strokeWidth={1.4} fill="none" strokeLinecap="round" />
                </G>
              ))}
              <Circle cx={74} cy={84} r={4.5} fill={CORPO} />
            </Svg>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[caixa(246, 46, 17), giroRoda]}>
            <Svg width="100%" height="100%" viewBox="229 29 34 34">
              <Circle cx={246} cy={46} r={16} fill={CORPO} stroke="#2D5223" strokeWidth={2} />
              <Path d="M246 33v26M233 46h26" stroke={paleta.limao} strokeWidth={3} strokeLinecap="round" />
              <Circle cx={246} cy={46} r={3.5} fill={paleta.limao} />
            </Svg>
          </Animated.View>
          {ativo && (
            <View pointerEvents="none" style={[caixa(246, 46, 21), { borderRadius: 999, borderWidth: 2, borderColor: 'rgba(223,255,79,0.28)', borderStyle: 'dashed' }]} />
          )}
        </>
      )}
    </View>
  );
}
