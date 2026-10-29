import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Rodape, TopoOnboarding } from '@/telas/onboarding/Tutorial';
import { Quadra, Tela, Texto, Titulo, TituloDestaque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { entrada, pouso } from '@/ui/movimento';
import { paleta, useTema } from '@/ui/tema';

export default function OnboardingSeguranca() {
  const { c } = useTema();
  const itens: { t: string; d: string; icone: ReactNode; fundo: string }[] = [
    { t: 'Só liga depois de armar', d: 'Um checklist rápido no início de cada sessão. Sem ele, “liga” é recusado.', icone: <Icone.Escudo cor={paleta.verde} tamanho={22} />, fundo: paleta.limao },
    { t: '“Para!” vale sempre', d: 'Sem palavra de ativação, a qualquer momento. O botão vermelho também.', icone: <Icone.Parar cor="#FFFFFF" tamanho={22} />, fundo: c.perigo },
    { t: 'Perdeu o celular? Ela para', d: 'Sem sinal do app por 3 segundos, a lançadora desliga os motores sozinha.', icone: <Icone.Wifi cor={paleta.verde} tamanho={22} />, fundo: paleta.bege },
  ];

  return (
    <Tela>
      <TopoOnboarding passo={3} />
      <View style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
        <Animated.View entering={entrada(0)}>
          <Titulo tamanho={40}>Parar é sempre</Titulo>
          <TituloDestaque>mais fácil que ligar</TituloDestaque>
        </Animated.View>
        <Animated.View entering={pouso(120)}>
          <Quadra estilo={{ gap: 4, paddingVertical: 10 }}>
            {itens.map((it, i) => (
              <Animated.View key={it.t} entering={entrada(240 + i * 90, 10)} style={{ flexDirection: 'row', gap: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(246,249,232,0.1)' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: it.fundo, alignItems: 'center', justifyContent: 'center' }}>{it.icone}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto tamanho={16} peso="negrito" cor={c.quadraTexto}>{it.t}</Texto>
                  <Texto tamanho={14} cor={c.quadraTextoSuave}>{it.d}</Texto>
                </View>
              </Animated.View>
            ))}
          </Quadra>
        </Animated.View>
      </View>
      <Rodape proximo="/onboarding/perfil" rotulo="Entendi" />
    </Tela>
  );
}
