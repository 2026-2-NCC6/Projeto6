import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configurarBips, prepararAudio } from '@/audio/sons';
import { useApp } from '@/estado/app';
import { EmergenciaFlutuante } from '@/telas/EmergenciaFlutuante';
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
  const bips = useApp((s) => s.config.bips);
  const { c, escuro } = useTema();

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Sessão de áudio uma única vez: o reconhecedor de fala troca a categoria
  // quando começa a ouvir, e reconfigurar no meio derrubaria o microfone.
  useEffect(() => {
    void prepararAudio();
  }, []);
  useEffect(() => {
    configurarBips(bips);
  }, [bips]);

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
        <Stack.Screen name="sessao/checklist" options={{ gestureEnabled: false }} />
        <Stack.Screen name="treino/[id]" options={{ presentation: 'modal', gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="microfone" />
        <Stack.Screen name="parada" options={{ gestureEnabled: false, animation: 'fade', contentStyle: { backgroundColor: c.perigoFundo } }} />
        <Stack.Screen name="resultado/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
      <EmergenciaFlutuante />
    </SafeAreaProvider>
  );
}
