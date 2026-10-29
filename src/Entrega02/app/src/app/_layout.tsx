import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useApp } from '@/estado/app';
import { useTema } from '@/ui/tema';

void SplashScreen.preventAutoHideAsync();

export default function Raiz() {
  const [fontesProntas] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const carregado = useApp((s) => s.carregado);
  const carregar = useApp((s) => s.carregar);
  const { c, escuro } = useTema();

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const pronto = fontesProntas && carregado;
  useEffect(() => {
    if (pronto) void SplashScreen.hideAsync();
  }, [pronto]);

  if (!pronto) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fundo }, animation: 'default' }}>
        <Stack.Screen name="sessao/index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="parada" options={{ gestureEnabled: false, animation: 'fade', contentStyle: { backgroundColor: c.perigoFundo } }} />
        <Stack.Screen name="resultado/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
