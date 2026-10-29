import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { finalizarOnboarding } from '@/estado/onboarding';
import { ConectarLancadora } from '@/telas/ConectarLancadora';
import { LinkTopo, TopoOnboarding } from '@/telas/onboarding/Tutorial';
import { Tela, Texto, Titulo } from '@/ui/componentes';
import { useTema } from '@/ui/tema';

export default function OnboardingConectar() {
  const { c } = useTema();
  const concluir = async () => {
    await finalizarOnboarding();
    router.replace('/inicio');
  };
  return (
    <Tela>
      <TopoOnboarding passo={7} direita={<LinkTopo texto="Fazer depois" aoTocar={() => void concluir()} />} />
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 18, paddingHorizontal: 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Titulo>Conectar a lançadora</Titulo>
          <Texto cor={c.textoSuave}>Ligue o NockHug na tomada e escolha como o celular vai falar com ele.</Texto>
        </View>
        <ConectarLancadora rotulo="Conectar e começar" aoConectar={concluir} />
      </ScrollView>
    </Tela>
  );
}
