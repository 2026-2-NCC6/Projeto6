// Botão de segurar: só confirma depois de 2 s pressionado. O preenchimento
// corre na thread de UI e volta rápido se o dedo sair antes da hora.

import { Pressable, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { EASE_OUT, haptico } from './movimento';
import { fontes } from './tema';

export function Segurar({
  titulo,
  aoConcluir,
  cor,
  preenchimento,
  ms = 2000,
  altura = 64,
  acessibilidade,
}: {
  titulo: string;
  aoConcluir: () => void;
  cor: string;
  preenchimento: string;
  ms?: number;
  altura?: number;
  acessibilidade?: string;
}) {
  const p = useSharedValue(0);
  const concluir = () => {
    haptico.sucesso();
    aoConcluir();
  };
  const barra = useAnimatedStyle(() => ({ transform: [{ scaleX: p.get() }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={acessibilidade ?? titulo}
      onPressIn={() => {
        haptico.leve();
        cancelAnimation(p);
        p.set(
          withTiming(1, { duration: ms * (1 - p.get()), easing: Easing.linear }, (fim) => {
            if (fim) scheduleOnRN(concluir);
          }),
        );
      }}
      onPressOut={() => {
        if (p.get() < 1) p.set(withTiming(0, { duration: 280, easing: EASE_OUT }));
      }}
      style={{ height: altura, borderRadius: altura / 2.8, borderWidth: 2, borderColor: cor, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: preenchimento, transformOrigin: 'left' }, barra]} />
      </View>
      <Text style={{ fontFamily: fontes.tituloForte, fontSize: 18, letterSpacing: -0.2, color: cor }}>{titulo}</Text>
    </Pressable>
  );
}
