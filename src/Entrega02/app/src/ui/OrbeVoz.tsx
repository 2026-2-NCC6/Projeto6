// O botão de voz é a bola da logo: em espera ela respira devagar, ouvindo um
// comando ela emite as ondas de som da marca. Desligada, fica apagada.

import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Toque } from './componentes';
import * as Icone from './icones';
import { EASE_IN_OUT } from './movimento';
import { paleta, useTema } from './tema';

export type EstadoOrbe = 'desligada' | 'esperando' | 'ouvindo';

const CaminhoAnimado = Animated.createAnimatedComponent(Path);

function Onda({ t, i, raio, cor, espessura }: { t: SharedValue<number>; i: number; raio: number; cor: string; espessura: number }) {
  const props = useAnimatedProps(() => {
    const fase = (t.get() - i * 0.18 + 1) % 1;
    return { opacity: interpolate(fase, [0, 0.15, 0.55, 1], [0.15, 1, 0.25, 0.15]) };
  });
  const a = (Math.PI / 180) * 38;
  const x1 = Math.cos(-a) * raio;
  const y1 = Math.sin(-a) * raio;
  return <CaminhoAnimado animatedProps={props} d={`M${x1} ${y1} A${raio} ${raio} 0 0 1 ${x1} ${-y1}`} stroke={cor} strokeWidth={espessura} strokeLinecap="round" fill="none" />;
}

export function OrbeVoz({ estado, aoTocar, tamanho = 76, rotulo, sobreQuadra }: { estado: EstadoOrbe; aoTocar: () => void; tamanho?: number; rotulo: string; sobreQuadra?: boolean }) {
  const { c, escuro } = useTema();
  const reduzir = useReducedMotion();
  const respiro = useSharedValue(0);
  const ondas = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(respiro);
    cancelAnimation(ondas);
    if (reduzir) {
      respiro.set(estado === 'desligada' ? 0 : 1);
      ondas.set(0.2);
      return;
    }
    if (estado === 'esperando') {
      respiro.set(withRepeat(withTiming(1, { duration: 2200, easing: EASE_IN_OUT }), -1, true));
    } else {
      respiro.set(withTiming(estado === 'ouvindo' ? 1 : 0, { duration: 260 }));
    }
    if (estado === 'ouvindo') ondas.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false));
    else ondas.set(0);
  }, [estado, reduzir, respiro, ondas]);

  const halo = useAnimatedStyle(() => ({
    opacity: estado === 'desligada' ? 0 : interpolate(respiro.get(), [0, 1], [0.18, estado === 'ouvindo' ? 0.42 : 0.3]),
    transform: [{ scale: interpolate(respiro.get(), [0, 1], [1, estado === 'ouvindo' ? 1.22 : 1.12]) }],
  }));

  const corOnda = sobreQuadra || escuro ? paleta.limao : c.quadra;
  const ladoOndas = tamanho * 0.42;

  return (
    <View style={{ width: tamanho + ladoOndas, height: tamanho + 16, justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: 0, top: 8, width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: paleta.limao }, halo]}
      />
      <Toque
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        onPress={aoTocar}
        escala={0.94}
        estilo={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, alignItems: 'center', justifyContent: 'center', boxShadow: estado === 'desligada' ? '' : '0px 10px 24px -10px rgba(170,210,20,0.7)' }}
      >
        {estado === 'desligada' ? (
          <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: sobreQuadra ? c.quadraAlta : c.sutil, borderWidth: 1.5, borderColor: sobreQuadra ? 'rgba(246,249,232,0.18)' : c.borda, alignItems: 'center', justifyContent: 'center' }}>
            <Icone.MicrofoneMudo cor={sobreQuadra ? c.quadraTextoSuave : c.textoSuave} tamanho={tamanho * 0.38} />
          </View>
        ) : (
          <>
            <View style={{ position: 'absolute' }}>
              <Icone.Bola tamanho={tamanho} id="orbe" />
            </View>
            <Icone.Microfone cor={paleta.verde} tamanho={tamanho * 0.4} />
          </>
        )}
      </Toque>
      <Svg
        pointerEvents="none"
        width={tamanho + ladoOndas}
        height={tamanho}
        viewBox={`${-tamanho / 2} ${-tamanho / 2} ${tamanho + ladoOndas} ${tamanho}`}
        style={{ position: 'absolute', left: 0, top: 8, opacity: estado === 'ouvindo' ? 1 : 0 }}
      >
        {[0, 1, 2].map((i) => (
          <Onda key={i} t={ondas} i={i} raio={tamanho * (0.57 + i * 0.095)} cor={corOnda} espessura={Math.max(2.4, tamanho * 0.036)} />
        ))}
      </Svg>
    </View>
  );
}
