// Formulário do perfil (onboarding passo 4 e Configurações › Perfil).

import * as ImagePicker from 'expo-image-picker';
import { type ReactNode, useState } from 'react';
import { Image, TextInput, type TextInputProps, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { Mao, Nivel, Objetivo } from '@/dominio/tipos';
import { useRascunho } from '@/estado/onboarding';
import { Opcao, Passo, Segmentos, Texto, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { CSS_EASE_OUT, haptico } from '@/ui/movimento';
import { useTema } from '@/ui/tema';

export function Campo({ rotulo, largura, ...props }: TextInputProps & { rotulo: string; largura?: number }) {
  const { c } = useTema();
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ gap: 6, flex: largura ? undefined : 1, width: largura }}>
      <Texto tamanho={13} peso="semi" cor={c.textoSuave}>{rotulo}</Texto>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={c.textoFraco}
        selectionColor={c.destaque}
        cursorColor={c.destaque}
        returnKeyType="done"
        {...props}
        onFocus={(e) => {
          setFoco(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          props.onBlur?.(e);
        }}
        style={{ minHeight: 50, borderRadius: 14, borderWidth: 1.5, borderColor: foco ? c.destaque : c.borda, backgroundColor: c.cartao, paddingHorizontal: 14, paddingVertical: 13, fontSize: 17, fontWeight: '500', color: c.texto }}
      />
    </View>
  );
}

const NIVEIS: [Nivel, string][] = [['iniciante', 'Iniciante'], ['intermediario', 'Intermediário'], ['avancado', 'Avançado']];
const MAOS: [Mao, string][] = [['destro', 'Destro'], ['canhoto', 'Canhoto']];
const OBJETIVOS: [Objetivo, string][] = [['golpes', 'Melhorar golpes'], ['condicionamento', 'Condicionamento'], ['lazer', 'Lazer'], ['competir', 'Competir']];

export function FotoPerfil({ tamanho = 72 }: { tamanho?: number }) {
  const { c } = useTema();
  const { fotoUri, mudar } = useRascunho();
  const escolher = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!r.canceled && r.assets[0]) mudar({ fotoUri: r.assets[0].uri });
  };
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={fotoUri ? 'Trocar foto' : 'Adicionar foto (opcional)'}
      onPress={escolher}
      escala={0.94}
      estilo={{ width: tamanho, height: tamanho }}
    >
      <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderWidth: fotoUri ? 0 : 1.5, borderStyle: 'dashed', borderColor: c.bordaForte, backgroundColor: c.sutil, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {fotoUri ? <Image source={{ uri: fotoUri }} style={{ width: tamanho, height: tamanho }} /> : <Icone.Camera cor={c.textoSuave} />}
      </View>
      <View style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: c.limao, borderWidth: 2, borderColor: c.fundo, alignItems: 'center', justifyContent: 'center' }}>
        <Icone.Mais cor={c.limaoTinta} tamanho={14} />
      </View>
    </Toque>
  );
}

function Grupo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const { c } = useTema();
  return (
    <View style={{ gap: 8 }}>
      <Texto tamanho={13} peso="semi" cor={c.textoSuave}>{rotulo}</Texto>
      {children}
    </View>
  );
}

export function FormPerfil() {
  const { c } = useTema();
  const r = useRascunho();
  const idade = Number(r.idade);
  const menor = Number.isInteger(idade) && idade >= 13 && idade < 18;

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Campo rotulo="Nome" value={r.nome} onChangeText={(nome) => r.mudar({ nome })} autoCapitalize="words" textContentType="givenName" />
        <Campo rotulo="Sobrenome" value={r.sobrenome} onChangeText={(sobrenome) => r.mudar({ sobrenome })} autoCapitalize="words" textContentType="familyName" />
      </View>
      <Campo rotulo="Idade" largura={120} value={r.idade} onChangeText={(t) => r.mudar({ idade: t.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" />

      <Grupo rotulo="Nível">
        <Segmentos opcoes={NIVEIS} valor={r.nivel} aoMudar={(nivel) => r.mudar({ nivel })} altura={40} />
      </Grupo>
      <Grupo rotulo="Mão dominante">
        <Segmentos opcoes={MAOS} valor={r.mao} aoMudar={(mao) => r.mudar({ mao })} altura={40} />
      </Grupo>
      <Grupo rotulo="Objetivo de uso">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {OBJETIVOS.map(([v, t]) => (
            <Opcao
              key={v}
              redondo
              texto={t}
              ativo={r.objetivos.includes(v)}
              aoTocar={() => r.mudar({ objetivos: r.objetivos.includes(v) ? r.objetivos.filter((x) => x !== v) : [...r.objetivos, v] })}
            />
          ))}
        </View>
      </Grupo>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.cartao, borderWidth: c.sombra ? 0 : 1, borderColor: c.borda, boxShadow: c.sombra, borderRadius: 20, padding: 10, paddingLeft: 16 }}>
        <View style={{ flex: 1 }}>
          <Texto tamanho={16} peso="negrito">Meta semanal</Texto>
          <Texto tamanho={13} cor={c.textoSuave}>dias de treino por semana</Texto>
        </View>
        <Passo rotulo="meta semanal" valor={r.metaSemanal} aoMenos={() => r.mudar({ metaSemanal: Math.max(1, r.metaSemanal - 1) })} aoMais={() => r.mudar({ metaSemanal: Math.min(7, r.metaSemanal + 1) })} />
      </View>
      {menor && <Caixa marcado={r.cienciaResponsavel} aoTrocar={() => r.mudar({ cienciaResponsavel: !r.cienciaResponsavel })} texto="Meu responsável sabe que vou usar o NockHug e concorda." />}
    </View>
  );
}

export function Caixa({ marcado, aoTrocar, texto }: { marcado: boolean; aoTrocar: () => void; texto: string }) {
  const { c } = useTema();
  return (
    <Toque
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      onPress={() => {
        haptico.selecao();
        aoTrocar();
      }}
      escala={0.99}
      estilo={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, paddingVertical: 4 }}
    >
      <Animated.View
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: marcado ? c.limaoBorda : c.bordaForte,
          backgroundColor: marcado ? c.limao : c.cartao,
          alignItems: 'center',
          justifyContent: 'center',
          transitionProperty: ['backgroundColor', 'borderColor'],
          transitionDuration: 160,
          transitionTimingFunction: CSS_EASE_OUT,
        }}
      >
        {marcado && <Icone.Check cor={c.limaoTinta} tamanho={16} />}
      </Animated.View>
      <Texto tamanho={14} cor={c.textoSuave} estilo={{ flex: 1 }}>{texto}</Texto>
    </Toque>
  );
}
