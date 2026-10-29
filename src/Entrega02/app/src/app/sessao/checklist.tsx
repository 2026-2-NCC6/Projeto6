// Checklist de preparação (PRD SE-1 a SE-3). Concluir arma a lançadora.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { descreverTreino, TREINOS_PRONTOS } from '@/dominio/treinos';
import { todosOsTreinos, useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import { conectarPadrao } from '@/lancadora/conectar';
import { useSessao } from '@/sessao/sessao';
import { Barra, Botao, Cabecalho, Cartao, Negrito, Opcao, Rotulo, Tela, Texto, Titulo, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { CSS_EASE_OUT, haptico } from '@/ui/movimento';
import { Segurar } from '@/ui/Segurar';
import { useTema } from '@/ui/tema';

const ITENS = [
  ['Área à frente livre', 'Ninguém entre a lançadora e a quadra'],
  ['Óculos de proteção', 'Bola a 14 000 RPM machuca'],
  ['Bolas carregadas', 'Alimentador cheio e sem bola presa no cano'],
  ['Lançadora apontada', 'Cano virado para a quadra, base firme'],
] as const;

function ItemChecklist({ titulo, descricao, marcado, aoTocar }: { titulo: string; descricao: string; marcado: boolean; aoTocar: () => void }) {
  const { c } = useTema();
  return (
    <Toque
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      accessibilityLabel={`${titulo}. ${descricao}`}
      onPress={() => {
        haptico.selecao();
        aoTocar();
      }}
      estilo={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 20,
        minHeight: 68,
        backgroundColor: marcado ? c.limaoSuave : c.cartao,
        borderWidth: 1.5,
        borderColor: marcado ? c.limaoBorda : c.sombra ? 'transparent' : c.borda,
        boxShadow: marcado ? '' : c.sombra,
        transitionProperty: ['backgroundColor', 'borderColor'],
        transitionDuration: 180,
      }}
    >
      <Animated.View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: marcado ? c.limao : 'transparent',
          borderWidth: 2,
          borderColor: marcado ? c.limaoBorda : c.bordaForte,
          transform: [{ scale: marcado ? 1 : 0.92 }],
          transitionProperty: ['backgroundColor', 'borderColor', 'transform'],
          transitionDuration: 220,
          transitionTimingFunction: CSS_EASE_OUT,
        }}
      >
        {marcado && <Icone.Check cor={c.limaoTinta} tamanho={18} />}
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Texto tamanho={16} peso="negrito">{titulo}</Texto>
        <Texto tamanho={14} cor={c.textoSuave}>{descricao}</Texto>
      </View>
    </Toque>
  );
}

export default function Checklist() {
  const { c } = useTema();
  const params = useLocalSearchParams<{ treino?: string; rearmar?: string }>();
  const criados = useApp((s) => s.treinos);
  const treinos = todosOsTreinos(criados);
  const sessao = useSessao();
  const rearmar = params.rearmar === '1' && sessao.treino;
  const [treinoId, setTreinoId] = useState(rearmar ? sessao.treino!.id : (params.treino ?? TREINOS_PRONTOS[1].id));
  const treino = rearmar ? sessao.treino! : (treinos.find((t) => t.id === treinoId) ?? TREINOS_PRONTOS[1]);
  const [marcados, setMarcados] = useState([false, false, false, false]);
  const [erro, setErro] = useState<string | null>(null);
  const [armando, setArmando] = useState(false);
  const { conexao, erroConexao, estado, enviar } = useLancadora(useShallow((s) => ({ conexao: s.conexao, erroConexao: s.erro, estado: s.status?.estado, enviar: s.enviar })));
  const conectada = conexao === 'conectada';
  // A sessão anterior pode ter terminado em parada segura: a lançadora só sai
  // dela por reinício explícito.
  const bloqueada = conectada && estado === 'PARADA_SEGURA' && !rearmar;
  const feitos = marcados.filter(Boolean).length;
  const faltam = ITENS.length - feitos;

  const armar = async () => {
    setErro(null);
    setArmando(true);
    if (!rearmar) sessao.descartar();
    const r = await sessao.armar(treino);
    setArmando(false);
    if (r.ok) {
      haptico.sucesso();
      router.replace('/sessao');
    } else {
      haptico.erro();
      setErro(r.erro ?? 'Não foi possível armar.');
    }
  };

  return (
    <Tela>
      <Cabecalho titulo={rearmar ? 'Rearmar' : 'Nova sessão'} sub={rearmar ? 'Depois da parada segura' : descreverTreino(treino)} />
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{ gap: 6 }}>
          <Titulo>Antes de armar</Titulo>
          <Texto cor={c.textoSuave}>A lançadora só aceita “liga” depois deste checklist. Ele vale para toda a sessão.</Texto>
        </View>

        {!rearmar && (
          <>
            <Rotulo>Treino</Rotulo>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
              {treinos.map((t) => <Opcao key={t.id} redondo texto={t.nome} ativo={t.id === treino.id} aoTocar={() => setTreinoId(t.id)} />)}
            </ScrollView>
          </>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <Rotulo>Segurança</Rotulo>
          <Texto tamanho={13} peso="semi" cor={c.textoSuave} estilo={{ marginTop: 6, fontVariant: ['tabular-nums'] }}>{feitos} de {ITENS.length}</Texto>
        </View>
        <Barra fracao={feitos / ITENS.length} altura={6} />
        <View style={{ gap: 8 }}>
          {ITENS.map(([t, d], i) => (
            <ItemChecklist key={t} titulo={t} descricao={d} marcado={marcados[i]} aoTocar={() => setMarcados((m) => m.map((x, j) => (j === i ? !x : x)))} />
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, backgroundColor: c.begeSuave, borderRadius: 18, padding: 14, alignItems: 'flex-start' }}>
          <Icone.Escudo cor={c.begeTexto} tamanho={22} />
          <Texto tamanho={14} cor={c.begeTexto} estilo={{ flex: 1 }}>
            Se o app for fechado ou perder a conexão, a lançadora <Negrito>para sozinha em 3 s</Negrito>. A tela fica acesa durante a sessão.
          </Texto>
        </View>

        {!conectada && (
          <Cartao estilo={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.textoFraco }} />
              <Texto tamanho={16} peso="negrito">Lançadora desconectada</Texto>
            </View>
            {erroConexao && <Texto tamanho={14} cor={c.perigoTexto}>{erroConexao}</Texto>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Botao titulo="Conectar" variante="quadra" altura={48} tamanhoTexto={16} estilo={{ flex: 1 }} carregando={conexao === 'conectando'} aoTocar={() => void conectarPadrao()} />
              <Botao titulo="Configurar" variante="contorno" altura={48} tamanhoTexto={16} estilo={{ flex: 1 }} aoTocar={() => router.push('/lancadora')} />
            </View>
          </Cartao>
        )}
        {bloqueada && (
          <Cartao destaque={c.perigo} estilo={{ gap: 10 }}>
            <Texto tamanho={16} peso="negrito" cor={c.perigoTexto}>A lançadora está em parada segura</Texto>
            <Texto tamanho={14} cor={c.textoSuave}>Ela ignora qualquer comando até ser reiniciada. Segure o botão por 2 segundos.</Texto>
            <Segurar titulo="Segure 2 s para reiniciar" cor={c.perigoTexto} preenchimento={c.perigoSuave} altura={52} acessibilidade="Segure por 2 segundos para reiniciar a lançadora" aoConcluir={() => void enviar('reiniciar')} />
          </Cartao>
        )}
        {erro && <Texto tamanho={14} peso="semi" cor={c.perigoTexto}>{erro}</Texto>}
      </ScrollView>

      {faltam > 0 ? (
        <Botao titulo={faltam === 1 ? 'Falta 1 item' : `Faltam ${faltam} itens`} desabilitado />
      ) : (
        <Botao titulo="Aceito o risco · Armar" icone={<Icone.Escudo cor={c.limaoTinta} tamanho={20} />} desabilitado={!conectada || !!bloqueada} carregando={armando} aoTocar={armar} />
      )}
    </Tela>
  );
}
