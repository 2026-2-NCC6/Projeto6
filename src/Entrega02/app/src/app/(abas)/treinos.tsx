// Treinos: os prontos e os criados pelo praticante. Tocar treina; o lápis abre
// o sheet de edição; criar é um botão, nunca um formulário aberto na lista.

import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { descreverTreino, ehLivre } from '@/dominio/treinos';
import type { Treino } from '@/dominio/tipos';
import { todosOsTreinos, useApp } from '@/estado/app';
import { Cartao, FaixaStatus, Numero, Pilula, Rotulo, Texto, Titulo, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { useTema } from '@/ui/tema';

function ItemTreino({ t }: { t: Treino }) {
  const { c } = useTema();
  const livre = ehLivre(t);
  const definida = !!t.velocidade;
  const daPlataforma = t.origem === 'plataforma';
  const editar = () => router.push({ pathname: '/treino/[id]', params: { id: t.id } });

  return (
    <View
      style={{
        backgroundColor: c.cartao,
        borderWidth: c.sombra ? 0 : 1,
        borderColor: c.borda,
        boxShadow: c.sombra,
        borderRadius: 20,
        paddingRight: 6,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Toque
        accessibilityRole="button"
        accessibilityLabel={`${t.nome}. ${descreverTreino(t)}`}
        accessibilityHint="Toque para treinar"
        onPress={() => router.push({ pathname: '/sessao/checklist', params: { treino: t.id } })}
        estilo={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, paddingRight: 4 }}
      >
        <View style={{ width: 60, height: 52, borderRadius: 16, backgroundColor: c.quadra, alignItems: 'center', justifyContent: 'center' }}>
          {livre ? <Icone.Infinito cor={c.limao} tamanho={26} /> : <Numero tamanho={19} cor={c.limao}>{`${t.series}×${t.bolasPorSerie}`}</Numero>}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Texto tamanho={16} peso="negrito" linhas={1} estilo={{ flexShrink: 1 }}>{t.nome}</Texto>
            {!definida ? (
              <Pilula texto="Definir" fundo={c.begeSuave} cor={c.begeTexto} />
            ) : t.personalizado ? (
              <Pilula texto="Editado" fundo={c.sutil} cor={c.textoSuave} />
            ) : null}
          </View>
          <Texto tamanho={13} cor={c.textoSuave} linhas={2}>{descreverTreino(t)}</Texto>
        </View>
      </Toque>
      <Toque
        accessibilityRole="button"
        accessibilityLabel={daPlataforma ? `Ver ${t.nome}` : `Editar ${t.nome}`}
        accessibilityHint={daPlataforma ? 'Treino da plataforma, somente leitura' : 'Abre o formulário do treino'}
        onPress={editar}
        hitSlop={6}
        escala={0.9}
        estilo={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.sutil, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icone.Lapis cor={c.textoSuave} tamanho={18} />
      </Toque>
    </View>
  );
}

export default function Treinos() {
  const { c } = useTema();
  const topo = useSafeAreaInsets().top;
  const salvos = useApp((s) => s.treinos);
  const todos = todosOsTreinos(salvos);
  const prontos = todos.filter((t) => t.padrao);
  const daPlataforma = todos.filter((t) => t.origem === 'plataforma');
  const criados = todos.filter((t) => !t.padrao && t.origem !== 'plataforma');

  const criar = () => router.push({ pathname: '/treino/[id]', params: { id: 'novo' } });

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: topo + 10, gap: 10, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 2, marginBottom: 6 }}>
          <Titulo>Treinos</Titulo>
          <Texto tamanho={14} cor={c.textoSuave}>Toque para treinar. O lápis ajusta bolas, descanso e velocidade.</Texto>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Rotulo>Prontos</Rotulo>
          <Texto tamanho={12} cor={c.textoSuave} estilo={{ marginRight: 4, marginTop: 6 }}>editáveis</Texto>
        </View>
        {prontos.map((t) => <ItemTreino key={t.id} t={t} />)}

        {daPlataforma.length > 0 && (
          <>
            <Rotulo>Da plataforma</Rotulo>
            {daPlataforma.map((t) => <ItemTreino key={t.id} t={t} />)}
          </>
        )}

        <Rotulo>Seus treinos</Rotulo>
        {criados.length === 0 ? (
          <Cartao estilo={{ gap: 4 }}>
            <Texto tamanho={16} peso="negrito">Nenhum treino seu ainda</Texto>
            <Texto tamanho={13} cor={c.textoSuave}>Crie um para treinar um golpe específico, com o número de bolas e o descanso que você quiser.</Texto>
          </Cartao>
        ) : (
          criados.map((t) => <ItemTreino key={t.id} t={t} />)
        )}

        <Toque
          accessibilityRole="button"
          accessibilityLabel="Criar novo treino"
          accessibilityHint="Abre o formulário de treino"
          onPress={criar}
          escala={0.99}
          estilo={{
            marginTop: 6,
            minHeight: 76,
            borderRadius: 20,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: c.bordaForte,
            backgroundColor: 'transparent',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 12,
            paddingRight: 14,
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.limao, alignItems: 'center', justifyContent: 'center' }}>
            <Icone.Mais cor={c.limaoTinta} tamanho={22} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto tamanho={16} peso="negrito">Criar novo treino</Texto>
            <Texto tamanho={13} cor={c.textoSuave}>Nome, bolas, descanso e velocidade.</Texto>
          </View>
          <Icone.Avancar cor={c.textoFraco} />
        </Toque>

      </ScrollView>
      <FaixaStatus />
    </View>
  );
}
