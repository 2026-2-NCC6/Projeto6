// Checklist de preparação (PRD SE-1 a SE-3). Concluir arma a lançadora.
//
// A velocidade dos motores é definida aqui na primeira vez de cada treino
// pronto (e pode ser trocada depois). O armar fica travado enquanto ela não
// existir. Se a lançadora recusar, o cartão de falha explica o motivo e oferece
// reparo, reconexão ou reinício.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { descreverTreino, TREINOS_PRONTOS } from '@/dominio/treinos';
import type { PresetVelocidade, Velocidade } from '@/dominio/tipos';
import { descreverVelocidade } from '@/dominio/velocidade';
import { todosOsTreinos, useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import { conectarPadrao } from '@/lancadora/conectar';
import { msPorBolaCom } from '@/lancadora/contrato';
import type { FalhaLancadora } from '@/lancadora/falhas';
import { repararLancadora } from '@/lancadora/manutencao';
import { useSessao } from '@/sessao/sessao';
import { CartaoFalha } from '@/telas/CartaoFalha';
import { SeletorVelocidade } from '@/telas/SeletorVelocidade';
import { Barra, Botao, BotaoEmergencia, Cabecalho, Cartao, Negrito, Opcao, Rotulo, Tela, Texto, Titulo, Toque } from '@/ui/componentes';
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
  const reduzir = useReducedMotion();
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
          borderColor: marcado ? c.limaoBorda : c.textoFraco,
          transform: [{ scale: marcado || reduzir ? 1 : 0.92 }],
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
  const params = useLocalSearchParams<{ treino?: string | string[]; rearmar?: string | string[] }>();
  const paramTreino = Array.isArray(params.treino) ? params.treino[0] : params.treino;
  const paramRearmar = Array.isArray(params.rearmar) ? params.rearmar[0] : params.rearmar;
  const salvos = useApp((s) => s.treinos);
  const treinos = todosOsTreinos(salvos);
  const sessao = useSessao();
  const rearmar = paramRearmar === '1' && !!sessao.treino;
  const [treinoId, setTreinoId] = useState(rearmar ? sessao.treino!.id : (paramTreino ?? TREINOS_PRONTOS[1].id));
  const treino = rearmar ? sessao.treino! : (treinos.find((t) => t.id === treinoId) ?? TREINOS_PRONTOS[1]);
  const treinoNaoEncontrado = !rearmar && !!paramTreino && !treinos.some((t) => t.id === paramTreino);
  const [marcados, setMarcados] = useState([false, false, false, false]);
  const [erro, setErro] = useState<string | null>(null);
  const [erroVelocidade, setErroVelocidade] = useState<string | null>(null);
  const [falha, setFalha] = useState<FalhaLancadora | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  const [armando, setArmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [abrirVelocidade, setAbrirVelocidade] = useState(!treino.velocidade);
  const [mostrarReinicio, setMostrarReinicio] = useState(false);
  const { conexao, erroConexao, estado, enviar, reconectar, msPorBola, alimentadorCalib } = useLancadora(
    useShallow((s) => ({
      conexao: s.conexao,
      erroConexao: s.erro,
      estado: s.status?.estado,
      enviar: s.enviar,
      reconectar: s.reconectar,
      msPorBola: s.status?.msPorBola,
      alimentadorCalib: s.status?.alimentadorCalib,
    })),
  );
  const conectada = conexao === 'conectada';
  // A sessão anterior pode ter terminado em parada segura: a lançadora só sai
  // dela por reinício explícito.
  const bloqueada = !rearmar && ((conectada && estado === 'PARADA_SEGURA') || mostrarReinicio);
  const faseAtiva = sessao.fase === 'lancando' || sessao.fase === 'pausada' || sessao.fase === 'descanso';
  const feitos = marcados.filter(Boolean).length;
  const faltam = ITENS.length - feitos;
  const semVelocidade = !treino.velocidade;
  const msDoTreino = treino.velocidade && msPorBola
    ? msPorBolaCom({ msPorBola, alimentadorCalib: alimentadorCalib ?? 25 }, treino.velocidade.alimentador)
    : null;

  const aplicarVelocidade = async (v: Velocidade, preset: PresetVelocidade) => {
    setErro(null);
    setErroVelocidade(null);
    setFalha(null);
    try {
      await useApp.getState().salvarTreino({
        ...treino,
        velocidade: v,
        preset,
        ...(treino.padrao ? { personalizado: true } : {}),
      });
      if (rearmar) useSessao.getState().definirVelocidadeSessao(v);
      setAbrirVelocidade(false);
      haptico.sucesso();
    } catch {
      setErroVelocidade('Não foi possível salvar a velocidade. Tente de novo.');
    }
  };

  const armar = async (confirmado = false) => {
    setErro(null);
    setErroVelocidade(null);
    setFalha(null);
    setAviso(null);
    if (!treino.velocidade) {
      setAbrirVelocidade(true);
      setErro('Escolha a velocidade dos motores antes de armar.');
      haptico.erro();
      return;
    }
    // Só uma sessão nova descarta o que já foi feito. Se a sessão atual tem
    // séries, o praticante confirma antes de perder o progresso.
    if (!rearmar && !confirmado && sessao.id && sessao.fase !== 'encerrada' && sessao.series.length > 0) {
      Alert.alert('Sessão em andamento', `Você já fez ${sessao.series.length} série(s) nesta sessão. Começar de novo descarta esse progresso.`, [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Descartar e armar', style: 'destructive', onPress: () => void armar(true) },
      ]);
      return;
    }
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
      setFalha(r.falha ?? null);
      if (r.falha?.acao === 'reiniciar') setMostrarReinicio(true);
    }
  };

  const reparar = async () => {
    setOcupado(true);
    const r = await repararLancadora();
    setOcupado(false);
    if (r.ok) {
      setFalha(null);
      setErro(null);
      setMostrarReinicio(false);
      setAviso({ texto: `${r.relato} Toque em Armar de novo.`, ok: true });
      haptico.sucesso();
    } else {
      haptico.erro();
      setFalha(r.falha ?? null);
      if (r.falha?.acao === 'reiniciar') setMostrarReinicio(true);
    }
  };

  const reconectarAgora = async () => {
    setOcupado(true);
    const ok = await reconectar();
    setOcupado(false);
    if (ok) {
      setFalha(null);
      setErro(null);
      setMostrarReinicio(false);
      setAviso({ texto: 'Lançadora reconectada. Toque em Armar de novo.', ok: true });
      haptico.sucesso();
    } else {
      haptico.erro();
      setErro(useLancadora.getState().erro ?? 'Não foi possível reconectar.');
    }
  };

  const reiniciar = async () => {
    setErro(null);
    const r = await enviar('reiniciar');
    if (r.codigo === 200) {
      haptico.sucesso();
      setMostrarReinicio(false);
      setFalha(null);
      setAviso({ texto: 'Lançadora reiniciada e em repouso.', ok: true });
    } else {
      haptico.erro();
      setErro(r.codigo === 409 ? 'A lançadora não está em parada segura.' : 'A lançadora não respondeu. Tente de novo.');
    }
  };

  const pararTudo = async () => {
    const r = await useSessao.getState().executar('emergencia', 'botao', 'botão Parar tudo', false);
    if (r.aceito) router.replace('/parada');
    else Alert.alert('Não confirmei a parada', r.frase);
  };

  const trocarTreino = (id: string) => {
    haptico.selecao();
    const alvo = treinos.find((t) => t.id === id);
    setTreinoId(id);
    setAbrirVelocidade(!alvo?.velocidade);
    setErro(null);
    setErroVelocidade(null);
    setFalha(null);
    setAviso(null);
    setMostrarReinicio(false);
  };

  const voltar = () => {
    // No rearme, voltar leva de volta à sessão, não à aba de treinos.
    if (rearmar) router.replace('/sessao');
    else if (router.canGoBack()) router.back();
    else router.replace('/inicio');
  };

  return (
    <Tela>
      <Cabecalho titulo={rearmar ? 'Rearmar' : 'Nova sessão'} sub={rearmar ? 'Depois da parada segura' : descreverTreino(treino)} aoVoltar={voltar} />
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{ gap: 6 }}>
          <Titulo>Antes de armar</Titulo>
          <Texto cor={c.textoSuave}>A lançadora só aceita “liga” depois deste checklist. Ele vale para toda a sessão.</Texto>
        </View>

        {!rearmar && (
          <>
            <Rotulo>Treino</Rotulo>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
              {treinos.map((t) => <Opcao key={t.id} redondo texto={t.nome} ativo={t.id === treino.id} aoTocar={() => trocarTreino(t.id)} />)}
            </ScrollView>
            {treinoNaoEncontrado && (
              <Texto tamanho={13} peso="semi" cor={c.perigoTexto}>
                O treino pedido não existe mais. Escolha outro abaixo.
              </Texto>
            )}
          </>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Rotulo>Velocidade dos motores</Rotulo>
          {treino.velocidade && (
            <Toque
              accessibilityRole="button"
              accessibilityLabel={abrirVelocidade ? 'Fechar a escolha de velocidade' : 'Alterar a velocidade do treino'}
              onPress={() => {
                haptico.selecao();
                setAbrirVelocidade((a) => !a);
              }}
              hitSlop={8}
              estilo={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
            >
              <Texto tamanho={14} peso="semi" cor={c.destaque}>{abrirVelocidade ? 'Fechar' : 'Alterar'}</Texto>
            </Toque>
          )}
        </View>
        <Cartao destaque={semVelocidade ? c.bege : undefined} estilo={{ gap: 10 }}>
          {semVelocidade ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.begeSuave, alignItems: 'center', justifyContent: 'center' }}>
                  <Icone.Raio cor={c.begeTexto} tamanho={18} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto tamanho={16} peso="negrito">Defina a velocidade</Texto>
                  <Texto tamanho={13} cor={c.textoSuave}>
                    É a primeira vez deste treino. Escolha Forte, Médio ou Fraco — ou personalize cada motor. A escolha fica gravada no treino.
                  </Texto>
                </View>
              </View>
              <SeletorVelocidade valor={treino.velocidade} aoMudar={(v, p) => void aplicarVelocidade(v, p)} msPorBola={msDoTreino} compacto />
            </>
          ) : abrirVelocidade ? (
            <SeletorVelocidade valor={treino.velocidade} aoMudar={(v, p) => void aplicarVelocidade(v, p)} msPorBola={msDoTreino} compacto />
          ) : (
            <Toque
              accessibilityRole="button"
              accessibilityLabel={`Velocidade ${treino.velocidade ? descreverVelocidade(treino.velocidade) : ''}. Alterar`}
              onPress={() => setAbrirVelocidade(true)}
              escala={0.99}
              estilo={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.limaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                <Icone.Raio cor={c.destaque} tamanho={20} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Texto tamanho={16} peso="negrito">{treino.velocidade ? descreverVelocidade(treino.velocidade) : ''}</Texto>
                <Texto tamanho={13} cor={c.textoSuave}>
                  {msDoTreino ? `1 bola a cada ${(msDoTreino / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : 'Toque em Alterar para trocar'}
                </Texto>
              </View>
              <Icone.Lapis cor={c.textoFraco} tamanho={17} />
            </Toque>
          )}
          {erroVelocidade && <Texto tamanho={13} peso="semi" cor={c.perigoTexto}>{erroVelocidade}</Texto>}
        </Cartao>

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
            Se o app for fechado ou perder a conexão, a lançadora <Negrito>para sozinha em 4 s</Negrito>. Antes de os motores ligarem tocam <Negrito>5 bips</Negrito>, e no fim do descanso a próxima série começa sozinha — diga “Nock, desliga” para cancelar.
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
            <Segurar titulo="Segure 2 s para reiniciar" cor={c.perigoTexto} preenchimento={c.perigoSuave} altura={52} acessibilidade="Segure por 2 segundos para reiniciar a lançadora" aoConcluir={() => void reiniciar()} />
          </Cartao>
        )}

        {falha && (
          <CartaoFalha
            falha={falha}
            ocupado={ocupado}
            onReparar={() => void reparar()}
            onReconectar={() => void reconectarAgora()}
            onReiniciar={() => {
              setMostrarReinicio(true);
              Alert.alert('Reiniciar a lançadora', 'Ela está em parada segura. Role até o cartão vermelho e segure o botão de reiniciar por 2 segundos.');
            }}
            onToken={() => router.push('/lancadora')}
            onRearmar={() => void armar()}
            onTentar={() => void armar()}
            onDiagnostico={() => router.push('/lancadora')}
            onFechar={() => {
              setFalha(null);
              setErro(null);
            }}
          />
        )}

        {aviso && (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: aviso.ok ? c.limaoSuave : c.perigoSuave, borderRadius: 16, padding: 12 }}>
            {aviso.ok ? <Icone.Check cor={c.destaque} tamanho={18} /> : <Icone.Alerta cor={c.perigoTexto} tamanho={18} />}
            <Texto tamanho={14} peso="semi" cor={aviso.ok ? c.destaque : c.perigoTexto} estilo={{ flex: 1 }}>{aviso.texto}</Texto>
          </View>
        )}

        {erro && !falha && <Texto tamanho={14} peso="semi" cor={c.perigoTexto}>{erro}</Texto>}
      </ScrollView>

      <View style={{ gap: 8 }}>
        {faltam > 0 ? (
          <Botao titulo={faltam === 1 ? 'Falta 1 item' : `Faltam ${faltam} itens`} desabilitado />
        ) : semVelocidade ? (
          <Botao titulo="Defina a velocidade" desabilitado icone={<Icone.Raio cor={c.textoFraco} tamanho={18} />} />
        ) : (
          <Botao titulo="Confirmo os itens · Armar" icone={<Icone.Escudo cor={c.limaoTinta} tamanho={20} />} desabilitado={!conectada || !!bloqueada} carregando={armando} aoTocar={armar} />
        )}
        {faseAtiva && <BotaoEmergencia aoTocar={() => void pararTudo()} altura={54} />}
      </View>
    </Tela>
  );
}
