import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { palavraDeAtivacaoValida } from '@/dominio/vocabulario';
import { useRascunho } from '@/estado/onboarding';
import { EscolhaPalavra } from '@/telas/EscolhaPalavra';
import { Rodape, TopoOnboarding } from '@/telas/onboarding/Tutorial';
import { Negrito, Tela, Texto, Titulo } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { useTema } from '@/ui/tema';

export default function OnboardingPalavra() {
  const { c } = useTema();
  const { palavra, mudar } = useRascunho();
  return (
    <Tela>
      <TopoOnboarding passo={5} />
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 18, paddingHorizontal: 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Titulo>Sua palavra de ativação</Titulo>
          <Texto cor={c.textoSuave}>É ela que faz o app prestar atenção. Escolha algo curto, que você não diga por acaso em quadra.</Texto>
        </View>
        <EscolhaPalavra palavra={palavra} aoMudar={(p) => mudar({ palavra: p })} />
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: c.perigoSuave, borderRadius: 18, padding: 14 }}>
          <Icone.Parar cor={c.perigoTexto} tamanho={22} />
          <Texto tamanho={14} cor={c.perigoTexto} estilo={{ flex: 1 }}>
            <Negrito>“Para!”</Negrito> funciona sem a palavra de ativação: é a sua parada de emergência por voz.
          </Texto>
        </View>
      </ScrollView>
      <Rodape desabilitado={!palavraDeAtivacaoValida(palavra).ok} aoTocar={() => router.push('/onboarding/permissoes')} />
    </Tela>
  );
}
