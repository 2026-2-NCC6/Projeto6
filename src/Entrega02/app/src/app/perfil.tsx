import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useApp } from '@/estado/app';
import { useRascunho, validarPerfil } from '@/estado/onboarding';
import { FormPerfil, FotoPerfil } from '@/telas/FormPerfil';
import { Botao, Cabecalho, Tela, Texto } from '@/ui/componentes';
import { haptico } from '@/ui/movimento';
import { useTema } from '@/ui/tema';

export default function EditarPerfil() {
  const { c } = useTema();
  const salvarPerfil = useApp((s) => s.salvarPerfil);
  const perfil = useApp((s) => s.perfil);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    const r = useRascunho.getState();
    const e = validarPerfil(r);
    setErro(e);
    if (e) haptico.erro();
    if (e || !perfil) return;
    await salvarPerfil({
      ...perfil,
      nome: r.nome.trim(),
      sobrenome: r.sobrenome.trim(),
      idade: Number(r.idade),
      nivel: r.nivel,
      mao: r.mao,
      objetivos: r.objetivos,
      metaSemanal: r.metaSemanal,
      fotoUri: r.fotoUri,
      cienciaResponsavel: r.cienciaResponsavel,
    });
    haptico.sucesso();
    router.back();
  };

  return (
    <Tela>
      <KeyboardAvoidingView style={{ flex: 1, gap: 12 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Cabecalho titulo="Perfil" />
        <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 18, paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <FotoPerfil tamanho={104} />
          </View>
          <FormPerfil />
          {erro && <Texto tamanho={14} peso="semi" cor={c.perigoTexto}>{erro}</Texto>}
        </ScrollView>
        <Botao titulo="Salvar" aoTocar={salvar} />
      </KeyboardAvoidingView>
    </Tela>
  );
}
