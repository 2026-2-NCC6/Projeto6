import { Image, View } from 'react-native';
import { MARCA, Tutorial } from '@/telas/onboarding/Tutorial';
import { Negrito, Quadra, Tela } from '@/ui/componentes';
import { Lancadora } from '@/ui/Lancadora';

export default function OnboardingLancadora() {
  return (
    <Tela>
      <Tutorial
        passo={1}
        titulo="Conheça o"
        destaque="NockHug"
        proximo="/onboarding/voz"
        ilustracao={
          <View>
            <Quadra estilo={{ paddingTop: 54, paddingHorizontal: 10, paddingBottom: 16 }}>
              <Lancadora girando altura={170} rotulos />
            </Quadra>
            <Image source={MARCA} accessible={false} style={{ position: 'absolute', top: -18, left: 14, width: 84, height: 84, transform: [{ rotate: '-7deg' }] }} />
          </View>
        }
      >
        Uma base giratória leva cada bola até o cano, e uma roda a <Negrito>14 000 RPM</Negrito> arremessa a bola por atrito. Você
        controla tudo pelo celular, sem sair da quadra.
      </Tutorial>
    </Tela>
  );
}
