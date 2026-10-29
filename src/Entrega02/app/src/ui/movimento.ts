// Gramática de movimento do NockHug. Curvas fortes de saída, nada de ease-in,
// e entradas só nos momentos raros (onboarding, resultado). Tudo respeita o
// "Reduzir movimento" do sistema.

import * as Haptics from 'expo-haptics';
import { cubicBezier, Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

// Entrada de um bloco: sobe 14 pt e aparece. Atraso em ms para escalonar.
export const entrada = (atraso = 0, distancia = 14) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: distancia }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
  })
    .duration(520)
    .delay(atraso)
    .reduceMotion(ReduceMotion.System);

// Peça que "pousa": leve escala de 0,94 para 1, sem quicar.
export const pouso = (atraso = 0) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.94 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
  })
    .duration(600)
    .delay(atraso)
    .reduceMotion(ReduceMotion.System);

// Um toque de háptico por ação do praticante, sempre junto de um retorno visual.
export const haptico = {
  selecao: () => void Haptics.selectionAsync().catch(() => undefined),
  leve: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  forte: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined),
  sucesso: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  erro: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined),
};
