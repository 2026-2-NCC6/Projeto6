// Moldura das telas de tutorial do onboarding (passos 1 a 3).

import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Botao, PontosOnboarding, Texto, Titulo, TituloDestaque, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { entrada, pouso } from '@/ui/movimento';
import { useTema } from '@/ui/tema';

export const MARCA = require('../../../assets/marca.png');

export function Rodape({ proximo, rotulo = 'Continuar', voltar = true, desabilitado, aoTocar }: { proximo?: Href; rotulo?: string; voltar?: boolean; desabilitado?: boolean; aoTocar?: () => void }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 'auto' }}>
      {voltar && (
        <Toque
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          estilo={{ width: 58, height: 58, borderRadius: 22, borderWidth: 1.5, borderColor: c.bordaForte, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icone.Voltar cor={c.texto} />
        </Toque>
      )}
      <Botao titulo={rotulo} estilo={{ flex: 1 }} desabilitado={desabilitado} aoTocar={aoTocar ?? (() => proximo && router.push(proximo))} />
    </View>
  );
}

// Topo comum do onboarding: o selo da marca e o progresso.
export function TopoOnboarding({ passo, direita }: { passo: number; direita?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Image source={MARCA} style={{ width: 34, height: 34 }} accessibilityIgnoresInvertColors accessible={false} />
        <PontosOnboarding atual={passo} />
      </View>
      {direita}
    </View>
  );
}

export function LinkTopo({ texto, aoTocar }: { texto: string; aoTocar: () => void }) {
  const { c } = useTema();
  return (
    <Pressable accessibilityRole="link" onPress={aoTocar} hitSlop={10} style={{ paddingVertical: 10, paddingLeft: 10 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: c.destaque }}>{texto}</Text>
    </Pressable>
  );
}

export function Tutorial({
  passo,
  titulo,
  destaque,
  children,
  ilustracao,
  proximo,
  rotulo,
}: {
  passo: number;
  titulo: string;
  destaque: string;
  children: ReactNode;
  ilustracao: ReactNode;
  proximo: Href;
  rotulo?: string;
}) {
  const { c } = useTema();
  return (
    <View style={{ flex: 1, gap: 20 }}>
      <TopoOnboarding passo={passo} direita={<LinkTopo texto="Pular tutorial" aoTocar={() => router.push('/onboarding/perfil')} />} />
      <View style={{ flex: 1, justifyContent: 'center', gap: 26 }}>
        <Animated.View entering={pouso()}>{ilustracao}</Animated.View>
        <Animated.View entering={entrada(140)} style={{ flexShrink: 0 }}>
          <Titulo tamanho={40}>{titulo}</Titulo>
          <TituloDestaque>{destaque}</TituloDestaque>
          <View style={{ marginTop: 14 }}>
            <Texto tamanho={17} cor={c.textoSuave}>{children}</Texto>
          </View>
        </Animated.View>
      </View>
      <Rodape proximo={proximo} rotulo={rotulo} voltar={passo > 1} />
    </View>
  );
}
