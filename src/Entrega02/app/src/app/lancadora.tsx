import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useLancadora } from '@/lancadora/cliente';
import { ConectarLancadora } from '@/telas/ConectarLancadora';
import { DiagnosticoLancadora } from '@/telas/DiagnosticoLancadora';
import { Botao, Cabecalho, Tela } from '@/ui/componentes';

export default function Lancadora() {
  const { conexao, desconectar } = useLancadora(useShallow((s) => ({ conexao: s.conexao, desconectar: s.desconectar })));
  return (
    <Tela>
      <Cabecalho titulo="Lançadora" sub={conexao === 'conectada' ? 'Conectada' : 'Escolha como conectar'} />
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <ConectarLancadora rotulo={conexao === 'conectada' ? 'Reconectar' : 'Conectar'} aoConectar={() => router.back()} />
        {conexao === 'conectada' && <Botao titulo="Desconectar" variante="contorno" altura={50} tamanhoTexto={16} aoTocar={() => void desconectar()} />}
        <DiagnosticoLancadora />
      </ScrollView>
    </Tela>
  );
}
