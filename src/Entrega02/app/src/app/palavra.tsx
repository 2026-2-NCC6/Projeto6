import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { palavraDeAtivacaoValida } from '@/dominio/vocabulario';
import { useApp } from '@/estado/app';
import { EscolhaPalavra } from '@/telas/EscolhaPalavra';
import { Botao, Cabecalho, Tela } from '@/ui/componentes';

export default function EditarPalavra() {
  const config = useApp((s) => s.config);
  const atualizarConfig = useApp((s) => s.atualizarConfig);
  const [palavra, setPalavra] = useState(config.palavraAtivacao);
  return (
    <Tela>
      <Cabecalho titulo="Palavra de ativação" />
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <EscolhaPalavra palavra={palavra} aoMudar={setPalavra} />
      </ScrollView>
      <Botao
        titulo="Salvar"
        haptico="sucesso"
        desabilitado={!palavraDeAtivacaoValida(palavra).ok}
        aoTocar={async () => {
          await atualizarConfig({ palavraAtivacao: palavra.trim() });
          router.back();
        }}
      />
    </Tela>
  );
}
