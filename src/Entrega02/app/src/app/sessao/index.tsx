// Tela de sessão: o núcleo do app (PRD §9.3). Voz, botões, emergência,
// contagem de bolas estimadas e descanso entre séries.

import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, ScrollView, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ehLivre } from '@/dominio/treinos';
import type { Comando } from '@/dominio/vocabulario';
import { useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import type { EstadoLancadora } from '@/lancadora/contrato';
import { useSessao } from '@/sessao/sessao';
import { Barra, Botao, BotaoEmergencia, Cabecalho, Cartao, Negrito, Numero, Pilula, Quadra, Tela, Texto, Titulo, Toque } from '@/ui/componentes';
import { cronometro } from '@/ui/formato';
import * as Icone from '@/ui/icones';
import { Lancadora } from '@/ui/Lancadora';
import { OrbeVoz } from '@/ui/OrbeVoz';
import { type Cores, paleta, useTema } from '@/ui/tema';
import { useAgora } from '@/ui/useAgora';
import { useVoz } from '@/voz/useVoz';

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

// Rótulo, fundo e cor do estado, sempre sobre a quadra.
function rotuloEstado(e: EstadoLancadora | undefined, c: Cores): [string, string, string] {
  switch (e) {
    case 'ARMADO': return ['Armado', 'rgba(223,255,79,0.16)', paleta.limao];
    case 'LANCANDO': return ['Lançando', paleta.limao, paleta.verde];
    case 'PAUSADO': return ['Pausado', paleta.bege, paleta.verde];
    case 'PARADA_SEGURA': return ['Parada segura', c.perigo, '#FFFFFF'];
    case 'REPOUSO': return ['Repouso', 'rgba(246,249,232,0.1)', c.quadraTextoSuave];
    default: return ['Sem conexão', 'rgba(246,249,232,0.1)', c.quadraTextoSuave];
  }
}

// O anel esvazia continuamente na thread de UI; o número muda a cada segundo.
function Descanso({ ate, total }: { ate: number; total: number }) {
  const { c } = useTema();
  const agora = useAgora(250);
  const resta = Math.max(0, Math.ceil((ate - agora) / 1000));
  const r = 66;
  const comp = 2 * Math.PI * r;
  const fracao = useSharedValue(Math.max(0, (ate - agora) / (total * 1000)));
  useEffect(() => {
    const ms = Math.max(0, ate - Date.now());
    fracao.set(ms / (total * 1000));
    fracao.set(withTiming(0, { duration: ms, easing: Easing.linear }));
  }, [ate, total, fracao]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: comp * (1 - Math.min(1, fracao.get())) }));

  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 4 }}>
      <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${resta} segundos de descanso restantes`}>
        <Svg width={160} height={160} style={{ position: 'absolute' }}>
          <Circle cx={80} cy={80} r={r} stroke="rgba(246,249,232,0.12)" strokeWidth={10} fill="none" />
          <CirculoAnimado cx={80} cy={80} r={r} stroke={resta ? paleta.bege : paleta.limao} strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={`${comp}`} animatedProps={props} rotation={-90} originX={80} originY={80} />
        </Svg>
        {resta ? <Numero tamanho={58} cor={c.quadraTexto}>{resta}</Numero> : <Icone.Check cor={paleta.limao} tamanho={48} espessura={3} />}
        <Texto tamanho={12} peso="semi" cor={c.quadraTextoSuave}>{resta ? 'descanso' : 'pronto'}</Texto>
      </View>
      <Texto tamanho={14} cor={c.quadraTextoSuave} estilo={{ textAlign: 'center' }}>
        A próxima série <Negrito cor={c.quadraTexto}>não começa sozinha</Negrito>: diga “liga”.
      </Texto>
    </View>
  );
}

export default function Sessao() {
  useKeepAwake();
  const { c } = useTema();
  const config = useApp((s) => s.config);
  const { status, conexao, alvo, reconectar } = useLancadora();
  const s = useSessao();
  const [feedback, setFeedback] = useState<{ texto: string; ok: boolean; n: number } | null>(null);
  const anunciouDescanso = useRef(false);
  const falarRef = useRef<(texto: string, sucesso: boolean) => void>(() => undefined);
  const mostrar = (texto: string, ok: boolean) => setFeedback((f) => ({ texto, ok, n: (f?.n ?? 0) + 1 }));

  const aoComando = useCallback(
    async (cmd: Comando, transcricao: string, origem: 'voz' | 'botao' = 'voz') => {
      const r = await useSessao.getState().executar(cmd, origem, transcricao);
      mostrar(r.frase, r.aceito);
      falarRef.current(r.frase, r.aceito);
    },
    [],
  );
  const voz = useVoz({
    palavra: config.palavraAtivacao,
    retornoFalado: config.retornoFalado,
    aoComando: (cmd, t) => void aoComando(cmd, t),
    aoIgnorado: (_, motivo) => motivo === 'sem_ativacao' && mostrar(`Sem “${config.palavraAtivacao}”`, false),
  });
  useEffect(() => {
    falarRef.current = voz.falar;
  }, [voz.falar]);

  // O status da lançadora fecha séries, abre o descanso e anuncia.
  useEffect(
    () =>
      useLancadora.subscribe((atual, anterior) => {
        if (!atual.status || atual.status === anterior.status) return;
        const frase = useSessao.getState().aoStatus(atual.status);
        if (frase) {
          // Queda de conexão é alerta, não confirmação: cor e vibração de erro.
          const ok = atual.status.motivo !== 'conexao_perdida';
          mostrar(frase, ok);
          falarRef.current(frase, ok);
        }
      }),
    [],
  );

  const desligarVoz = voz.desligar;
  useEffect(() => {
    if (s.fase === 'parada') {
      desligarVoz();
      router.replace('/parada');
    }
    if (s.fase !== 'descanso') anunciouDescanso.current = false;
  }, [s.fase, desligarVoz]);

  // Fim do descanso: só anuncia. Nada liga sozinho.
  useEffect(() => {
    if (s.fase !== 'descanso' || !s.descansoAte) return;
    const t = setTimeout(() => {
      if (!anunciouDescanso.current) {
        anunciouDescanso.current = true;
        falarRef.current('Pronto. Próxima série quando quiser', true);
      }
    }, Math.max(0, s.descansoAte - Date.now()));
    return () => clearTimeout(t);
  }, [s.fase, s.descansoAte]);

  const treino = s.treino;
  const concluido = !!treino && !ehLivre(treino) && s.series.length >= treino.series;

  const encerrar = useCallback(() => {
    const fazer = async () => {
      voz.desligar();
      const id = await useSessao.getState().encerrar(concluido ? 'concluida' : 'praticante');
      if (id) router.replace({ pathname: '/resultado/[id]', params: { id } });
      else router.replace('/inicio');
    };
    if (concluido) return void fazer();
    const { series, fase } = useSessao.getState();
    if (series.length === 0 && fase !== 'lancando' && fase !== 'pausada') {
      Alert.alert('Sair sem treinar?', 'Nenhuma série foi feita, então nada é gravado. A lançadora é desarmada.', [
        { text: 'Ficar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => void fazer() },
      ]);
      return;
    }
    Alert.alert('Encerrar a sessão?', 'Os motores param e o resultado é gravado.', [
      { text: 'Continuar treinando', style: 'cancel' },
      { text: 'Encerrar', style: 'destructive', onPress: () => void fazer() },
    ]);
  }, [concluido, voz]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      encerrar();
      return true;
    });
    return () => sub.remove();
  }, [encerrar]);

  if (!treino) {
    return (
      <Tela estilo={{ justifyContent: 'center' }}>
        <Titulo>Nenhuma sessão</Titulo>
        <Botao titulo="Voltar ao início" aoTocar={() => router.replace('/inicio')} />
      </Tela>
    );
  }

  const estado = conexao === 'desconectada' ? undefined : status?.estado;
  const [rotulo, fundo, cor] = rotuloEstado(estado, c);
  const alvoBolas = treino.bolasPorSerie;
  const bolas = status && (estado === 'LANCANDO' || estado === 'PAUSADO') ? status.bolasEstimadas : 0;
  // A série em andamento ou a próxima; depois da última, a última.
  const serieAtual = Math.min(s.series.length + 1, treino.series);
  const micInfo = {
    desligada: ['Microfone desligado', 'Toque na bola para começar a ouvir'],
    esperando: [`Esperando “${config.palavraAtivacao}”`, `Diga “${config.palavraAtivacao}” e depois o comando`],
    ouvindo_comando: ['Ouvindo comando…', 'liga · desliga · pausa · retoma'],
  }[voz.estado];
  const IconeConexao = alvo?.simulado ? Icone.Simulada : alvo?.tipo === 'ble' ? Icone.Bluetooth : Icone.Wifi;

  const cmd = (k: Comando) => () => void aoComando(k, `[botão] ${k}`, 'botao');

  return (
    <Tela estilo={{ gap: 12 }}>
      <Cabecalho
        titulo={treino.nome}
        sub={ehLivre(treino) ? 'Livre · até “desliga”' : `${treino.series} séries × ${treino.bolasPorSerie} bolas · descanso ${treino.descansoS} s`}
        aoVoltar={encerrar}
        direita={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, height: 34, borderRadius: 17, backgroundColor: conexao === 'conectada' ? c.limaoSuave : c.sutil }}>
            <IconeConexao cor={conexao === 'conectada' ? c.destaque : c.textoFraco} tamanho={15} />
            <Texto tamanho={13} peso="semi" cor={conexao === 'conectada' ? c.destaque : c.textoSuave}>{alvo?.simulado ? 'Simulada' : alvo?.tipo === 'ble' ? 'BLE' : 'Wi-Fi'}</Texto>
          </View>
        }
      />

      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
        {(conexao === 'perdida' || s.conexaoPerdida) && (
          <Toque onPress={() => void reconectar()} accessibilityRole="button" estilo={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: c.perigoSuave, borderRadius: 18, padding: 14 }}>
            <Icone.Alerta cor={c.perigoTexto} />
            <Texto tamanho={14} peso="medio" cor={c.perigoTexto} estilo={{ flex: 1 }}>Conexão perdida. A lançadora parou os motores. Toque para reconectar.</Texto>
          </Toque>
        )}

        <Quadra estilo={{ gap: 12, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pilula texto={concluido && estado === 'ARMADO' ? 'Treino concluído' : s.fase === 'descanso' ? 'Descanso' : rotulo} fundo={concluido && estado === 'ARMADO' ? paleta.limao : fundo} cor={concluido && estado === 'ARMADO' ? paleta.verde : cor} />
            {!ehLivre(treino) && (
              <Texto tamanho={14} cor={c.quadraTextoSuave}>
                Série <Negrito cor={c.quadraTexto}>{serieAtual}</Negrito> de {treino.series}
              </Texto>
            )}
          </View>

          {s.fase === 'descanso' && s.descansoAte ? <Descanso ate={s.descansoAte} total={treino.descansoS} /> : <Lancadora girando={estado === 'LANCANDO'} altura={124} />}

          {s.fase !== 'descanso' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View>
                  <Numero tamanho={60} cor={paleta.limao}>
                    {bolas}
                    {alvoBolas > 0 && <Numero tamanho={26} cor={c.quadraTextoSuave}> / {alvoBolas}</Numero>}
                  </Numero>
                  <Texto tamanho={13} cor={c.quadraTextoSuave}>
                    bolas estimadas
                    {status && !status.calibrado ? <Texto tamanho={13} peso="semi" cor={paleta.bege}> · não calibrado</Texto> : null}
                  </Texto>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Numero tamanho={30} cor={c.quadraTexto}>{cronometro(estado === 'LANCANDO' || estado === 'PAUSADO' ? (status?.tempoMs ?? 0) : 0)}</Numero>
                  <Texto tamanho={13} cor={c.quadraTextoSuave}>nesta série</Texto>
                </View>
              </View>
              {alvoBolas > 0 && <Barra fracao={bolas / alvoBolas} cor={paleta.limao} trilho="rgba(246,249,232,0.12)" />}
            </>
          )}
        </Quadra>

        <Cartao estilo={{ gap: 12, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <OrbeVoz
              estado={voz.estado === 'desligada' ? 'desligada' : voz.estado === 'ouvindo_comando' ? 'ouvindo' : 'esperando'}
              rotulo={voz.estado === 'desligada' ? 'Ligar microfone' : 'Desligar microfone'}
              aoTocar={() => (voz.estado === 'desligada' ? void voz.ligar() : voz.desligar())}
              tamanho={64}
            />
            <View style={{ flex: 1 }}>
              <Texto tamanho={17} peso="negrito">{micInfo[0]}</Texto>
              <Texto tamanho={13} cor={voz.erro ? c.perigoTexto : c.textoSuave}>{voz.erro ?? micInfo[1]}{voz.modo === 'aparelho' && !voz.erro ? ' · no aparelho' : ''}</Texto>
            </View>
          </View>
          <View style={{ backgroundColor: c.sutil, borderRadius: 14, paddingHorizontal: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
            <Icone.Fala cor={c.textoFraco} tamanho={16} />
            <Texto tamanho={14} cor={voz.ultimaFala ? c.texto : c.textoFraco} linhas={1} estilo={{ flex: 1, fontStyle: voz.ultimaFala ? 'italic' : 'normal' }}>{voz.ultimaFala ? `“${voz.ultimaFala}”` : 'Nada ouvido ainda'}</Texto>
            {feedback && (
              <Animated.View key={feedback.n} entering={FadeIn.duration(150)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 28, borderRadius: 14, backgroundColor: feedback.ok ? c.limaoSuave : c.perigoSuave, maxWidth: '58%' }}>
                {feedback.ok ? <Icone.Check cor={c.destaque} tamanho={14} /> : <Icone.Alerta cor={c.perigoTexto} tamanho={14} />}
                <Texto tamanho={13} peso="negrito" cor={feedback.ok ? c.destaque : c.perigoTexto} linhas={1} estilo={{ flexShrink: 1 }}>{feedback.texto}</Texto>
              </Animated.View>
            )}
          </View>
        </Cartao>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Botao titulo="Ligar" altura={54} tamanhoTexto={17} estilo={{ flex: 1, paddingHorizontal: 8 }} icone={<Icone.Play cor={c.limaoTinta} tamanho={18} />} aoTocar={cmd('ligar')} />
          <Botao
            titulo={estado === 'PAUSADO' ? 'Retomar' : 'Pausar'}
            variante="contorno"
            altura={54}
            tamanhoTexto={17}
            estilo={{ flex: 1, paddingHorizontal: 8 }}
            icone={estado === 'PAUSADO' ? <Icone.Play cor={c.texto} tamanho={18} /> : <Icone.Pausa cor={c.texto} tamanho={18} />}
            aoTocar={cmd(estado === 'PAUSADO' ? 'retomar' : 'pausar')}
          />
          <Botao titulo="Desligar" variante="quadra" altura={54} tamanhoTexto={17} estilo={{ flex: 1, paddingHorizontal: 8 }} icone={<Icone.Quadrado cor={c.quadraTexto} tamanho={16} />} aoTocar={cmd('desligar')} />
        </View>
      </ScrollView>

      <View style={{ gap: 8 }}>
        {(concluido || s.series.length > 0) && estado !== 'LANCANDO' && (
          <Botao titulo={concluido ? 'Ver resultado' : 'Encerrar sessão'} variante={concluido ? 'primario' : 'suave'} altura={50} tamanhoTexto={17} aoTocar={encerrar} />
        )}
        <BotaoEmergencia aoTocar={cmd('emergencia')} />
      </View>
    </Tela>
  );
}
