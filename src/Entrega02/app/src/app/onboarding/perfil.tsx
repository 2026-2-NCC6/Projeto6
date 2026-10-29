import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRascunho, validarPerfil } from '@/estado/onboarding';
import { Caixa, FormPerfil, FotoPerfil } from '@/telas/FormPerfil';
import { Rodape, TopoOnboarding } from '@/telas/onboarding/Tutorial';
import { Tela, Texto, Titulo } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { haptico } from '@/ui/movimento';
import { useTema } from '@/ui/tema';

export default function OnboardingPerfil() {
  const { c } = useTema();
  const r = useRascunho();
  const [erro, setErro] = useState<string | null>(null);

  const continuar = () => {
    const e = validarPerfil(useRascunho.getState());
    setErro(e);
    if (e) haptico.erro();
    else router.push('/onboarding/palavra');
  };

  return (
    <Tela>
      <KeyboardAvoidingView style={{ flex: 1, gap: 12 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TopoOnboarding passo={4} />
        <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 18, paddingHorizontal: 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <FotoPerfil />
            <View style={{ flex: 1 }}>
              <Titulo>Sobre você</Titulo>
              <Texto tamanho={14} cor={c.textoSuave}>Fica só neste celular. Foto opcional.</Texto>
            </View>
          </View>
          <FormPerfil />
          <Caixa
            marcado={r.aceiteLgpd}
            aoTrocar={() => r.mudar({ aceiteLgpd: !r.aceiteLgpd })}
            texto="Concordo com o uso dos meus dados só neste aparelho. O áudio nunca é gravado (LGPD)."
          />
          {erro && (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: c.perigoSuave, borderRadius: 16, padding: 12 }}>
              <Icone.Alerta cor={c.perigoTexto} tamanho={20} />
              <Texto tamanho={14} peso="semi" cor={c.perigoTexto} estilo={{ flex: 1 }}>{erro}</Texto>
            </View>
          )}
        </ScrollView>
        <Rodape aoTocar={continuar} />
      </KeyboardAvoidingView>
    </Tela>
  );
}
