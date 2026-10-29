import { Tabs } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import * as Icone from '@/ui/icones';
import { useTema } from '@/ui/tema';

type ComponenteIcone = (p: { cor: string; tamanho?: number }) => ReactNode;

export default function LayoutAbas() {
  const { c } = useTema();
  const ativo = c.destaque;
  const icone = (Comp: ComponenteIcone) =>
    function IconeDaAba({ focused }: { focused: boolean }) {
      return <Comp cor={focused ? ativo : c.textoFraco} tamanho={24} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Abas são pares, não hierarquia: trocar de aba não anima.
        animation: 'none',
        tabBarActiveTintColor: ativo,
        tabBarInactiveTintColor: c.textoFraco,
        tabBarStyle: { backgroundColor: c.cartao, borderTopColor: c.borda, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.fundo },
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: 'Início', tabBarIcon: icone(Icone.Casa) }} />
      <Tabs.Screen name="treinos" options={{ title: 'Treinos', tabBarIcon: icone(Icone.Series) }} />
      <Tabs.Screen name="historico" options={{ title: 'Histórico', tabBarIcon: icone(Icone.Relogio) }} />
      <Tabs.Screen name="conquistas" options={{ title: 'Conquistas', tabBarIcon: icone(Icone.Trofeu) }} />
    </Tabs>
  );
}
