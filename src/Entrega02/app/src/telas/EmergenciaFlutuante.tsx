// Emergência sempre à mão: quando há uma sessão com motores possíveis, o
// "Parar tudo" acompanha qualquer tela que não seja a própria sessão ou a
// parada segura. Sem isso, abrir a configuração da lançadora no meio de uma
// série deixaria o único controle de parada uma tela atrás.

import { router, usePathname } from 'expo-router';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessao } from '@/sessao/sessao';
import { BotaoEmergencia } from '@/ui/componentes';
import { useTema } from '@/ui/tema';

export function EmergenciaFlutuante() {
  const { c } = useTema();
  const fase = useSessao((s) => s.fase);
  const caminho = usePathname();
  const insets = useSafeAreaInsets();
  const ativa = fase === 'lancando' || fase === 'pausada' || fase === 'descanso';
  if (!ativa || caminho === '/sessao' || caminho === '/sessao/checklist' || caminho.startsWith('/parada')) return null;

  const parar = async () => {
    const r = await useSessao.getState().executar('emergencia', 'botao', 'botão Parar tudo', false);
    if (r.aceito) {
      router.replace('/parada');
      return;
    }
    Alert.alert('Não confirmei a parada', r.frase);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        elevation: 50,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: Math.max(insets.bottom, 12),
        experimental_backgroundImage: `linear-gradient(to bottom, ${c.fundo}00 0%, ${c.fundo} 62%)`,
      }}
    >
      <BotaoEmergencia aoTocar={() => void parar()} altura={56} />
    </View>
  );
}
