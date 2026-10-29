import { Redirect } from 'expo-router';
import { useApp } from '@/estado/app';

export default function Inicio() {
  const perfil = useApp((s) => s.perfil);
  return <Redirect href={perfil ? '/inicio' : '/onboarding'} />;
}
