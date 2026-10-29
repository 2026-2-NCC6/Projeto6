import { Stack } from 'expo-router';
import { useTema } from '@/ui/tema';

export default function LayoutOnboarding() {
  const { c } = useTema();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fundo }, animation: 'default' }} />;
}
