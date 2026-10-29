import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Tutorial } from '@/telas/onboarding/Tutorial';
import { Negrito, Quadra, Tela } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { OrbeVoz } from '@/ui/OrbeVoz';
import { fontes, paleta, useTema } from '@/ui/tema';

// Explicação em ciclo: "Nock," entra, depois "liga!", o sinal atravessa até a
// lançadora e a luz dela acende. Com "Reduzir movimento", fica a cena final.
function CenaVoz() {
  const { c } = useTema();
  const reduzir = useReducedMotion();
  const t = useSharedValue(reduzir ? 0.7 : 0);
  useEffect(() => {
    if (!reduzir) t.set(withRepeat(withTiming(1, { duration: 4600, easing: Easing.linear }), -1, false));
  }, [t, reduzir]);

  const bolha = (de: number, ate: number) => () => {
    'worklet';
    const v = t.get();
    const ent = interpolate(v, [de, ate], [0, 1], 'clamp');
    const saida = interpolate(v, [0.88, 0.98], [1, 0], 'clamp');
    const e = 1 - (1 - ent) ** 3;
    return { opacity: e * saida, transform: [{ translateY: 10 * (1 - e) }, { scale: 0.96 + 0.04 * e }] };
  };
  const b1 = useAnimatedStyle(bolha(0.06, 0.16));
  const b2 = useAnimatedStyle(bolha(0.3, 0.4));
  const linha = useAnimatedStyle(() => {
    const v = interpolate(t.get(), [0.44, 0.58], [0, 1], 'clamp');
    return { transform: [{ scaleX: v }], opacity: interpolate(t.get(), [0.88, 0.98], [1, 0], 'clamp') };
  });
  const luz = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.get(), [0, 0.57, 0.6, 0.9, 1], ['#3A5631', '#3A5631', paleta.limao, paleta.limao, '#3A5631']),
  }));

  return (
    <Quadra estilo={{ height: 244, justifyContent: 'center', padding: 20 }} linhas>
      <View accessibilityLabel="Você diz Nock, liga; o celular entende e a lançadora acende a luz" accessible style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Animated.View style={[{ backgroundColor: c.quadraTexto, borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 16, paddingVertical: 9 }, b1]}>
            <Text style={{ fontFamily: fontes.titulo, fontSize: 24, letterSpacing: -0.6, color: paleta.verde }}>“Nock,</Text>
          </Animated.View>
          <Animated.View style={[{ backgroundColor: paleta.limao, borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 16, paddingVertical: 9, marginTop: 26 }, b2]}>
            <Text style={{ fontFamily: fontes.titulo, fontSize: 24, letterSpacing: -0.6, color: paleta.verde }}>liga!”</Text>
          </Animated.View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View pointerEvents="none">
            <OrbeVoz estado="ouvindo" aoTocar={() => undefined} tamanho={56} rotulo="Microfone" sobreQuadra />
          </View>
          <View style={{ flex: 1, height: 2, marginHorizontal: 4, borderRadius: 1, backgroundColor: 'rgba(246,249,232,0.12)', overflow: 'hidden' }}>
            <Animated.View style={[{ height: 2, backgroundColor: paleta.limao, transformOrigin: 'left' }, linha]} />
          </View>
          <View style={{ paddingHorizontal: 12, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', flexDirection: 'row', gap: 8 }}>
            <Animated.View style={[{ width: 12, height: 12, borderRadius: 6 }, luz]} />
            <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: c.quadraTexto }}>ARMADO</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Icone.Wifi cor={c.quadraTextoSuave} tamanho={14} />
          <Text style={{ fontSize: 13, color: c.quadraTextoSuave }}>Wi-Fi ou Bluetooth · sem tocar na tela</Text>
        </View>
      </View>
    </Quadra>
  );
}

export default function OnboardingVoz() {
  return (
    <Tela>
      <Tutorial passo={2} titulo="Fale." destaque="A lançadora obedece." proximo="/onboarding/seguranca" ilustracao={<CenaVoz />}>
        Primeiro a <Negrito>palavra de ativação</Negrito>, depois o comando: <Negrito>liga, desliga, pausa, retoma</Negrito>. Pode dizer junto (“Nock, liga”) ou em dois tempos.
      </Tutorial>
    </Tela>
  );
}
