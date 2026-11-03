// Sheet de treino: cria (id = "novo") ou edita um treino existente, inclusive
// os prontos (editar um pronto cria uma versão do praticante, que pode ser
// restaurada).

import { router, useLocalSearchParams } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { descreverTreino } from '@/dominio/treinos';
import { todosOsTreinos, useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import { Campo } from '@/telas/FormPerfil';
import { FormTreino } from '@/telas/FormTreino';
import { Botao, Tela, Texto, Titulo } from '@/ui/componentes';
import { useTema } from '@/ui/tema';

export default function TreinoSheet() {
  const { c } = useTema();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const treinos = useApp((s) => s.treinos);
  const calibracao = useLancadora(useShallow((s) => ({ msPorBola: s.status?.msPorBola, alimentadorCalib: s.status?.alimentadorCalib })));
  const todos = todosOsTreinos(treinos);
  const inicial = id && id !== 'novo' ? todos.find((t) => t.id === id) : undefined;
  const fechar = () => (router.canGoBack() ? router.back() : router.replace('/treinos'));

  if (inicial?.origem === 'plataforma') {
    return (
      <Tela estilo={{ gap: 12 }}>
        <Titulo>Treino da plataforma</Titulo>
        <Texto>Este treino vem da plataforma. Para mudar, use o site.</Texto>
        <Campo rotulo="Nome do treino" value={inicial.nome} editable={false} />
        <Texto>{descreverTreino(inicial)}</Texto>
        <Botao
          titulo="Tirar deste aparelho"
          variante="contorno"
          aoTocar={() => {
            void useApp.getState().apagarTreino(inicial.id).then(fechar);
          }}
        />
        <Botao titulo="Fechar" aoTocar={fechar} />
      </Tela>
    );
  }

  if (id !== 'novo' && !inicial) {
    return (
      <Tela estilo={{ justifyContent: 'center', gap: 12 }}>
        <Titulo>Treino não encontrado</Titulo>
        <Texto cor={c.textoSuave}>Ele pode ter sido apagado. Feche e veja a lista de treinos.</Texto>
        <Botao titulo="Fechar" aoTocar={fechar} />
      </Tela>
    );
  }

  return (
    <FormTreino
      inicial={inicial}
      calibracao={{ msPorBola: calibracao.msPorBola ?? 3000, alimentadorCalib: calibracao.alimentadorCalib ?? 25 }}
      aoSalvar={async (t) => {
        await useApp.getState().salvarTreino(t);
        fechar();
      }}
      aoCancelar={fechar}
      aoApagar={
        inicial && !inicial.padrao
          ? async () => {
              await useApp.getState().apagarTreino(inicial.id);
              fechar();
            }
          : undefined
      }
      aoRestaurar={
        inicial?.padrao && inicial.personalizado
          ? async () => {
              await useApp.getState().restaurarTreino(inicial.id);
              fechar();
            }
          : undefined
      }
    />
  );
}
