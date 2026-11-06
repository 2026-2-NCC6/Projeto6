// Tela de sessão: o núcleo do app (PRD §9.3). Voz, botões, emergência,
// contagem de bolas estimadas e descanso entre séries.
//
// Nenhum motor liga sem aviso: "liga", "retoma" e o fim do descanso abrem uma
// contagem de 5 s com um bip por segundo, cancelável com "Nock, desliga" ou
// "Nock, para". O tempo de descanso pode ser ajustado em qualquer momento da
// sessão. Tudo o que pode dar errado na lançadora vira um cartão com o que
// fazer e o detalhe técnico.

import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, ScrollView, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedProps, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { segundosRestantes, situacaoDescanso } from '@/dominio/descanso';
import { fraseSegura } from '@/dominio/frases';
import { CONTAGEM_MS, type Partida } from '@/dominio/partida';
import { ehLivre, LIMITES } from '@/dominio/treinos';
import { bolasDaSessao, type OrigemComando } from '@/dominio/tipos';
import type { Comando } from '@/dominio/vocabulario';
import { descreverVelocidade, pct } from '@/dominio/velocidade';
import { useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import type { EstadoLancadora } from '@/lancadora/contrato';
import { repararLancadora } from '@/lancadora/manutencao';
import { useSessao, type MotivoSemRetomada } from '@/sessao/sessao';
import { useAvisosDaSerie } from '@/sessao/useAvisos';
import { contagemEmCurso, usePartidaAgendada } from '@/sessao/usePartida';
import { CartaoFalha } from '@/telas/CartaoFalha';
import { Barra, Botao, BotaoEmergencia, Cabecalho, Cartao, Negrito, Numero, Passo, Pilula, Pulso, Quadra, Tela, Texto, Titulo, Toque } from '@/ui/componentes';
import { cronometro } from '@/ui/formato';
import * as Icone from '@/ui/icones';
import { Lancadora } from '@/ui/Lancadora';
import { OrbeVoz } from '@/ui/OrbeVoz';
import { type Cores, paleta, useTema } from '@/ui/tema';
import { useAgora } from '@/ui/useAgora';
import { reconhecedor } from '@/voz/reconhecedor';
import { useVoz } from '@/voz/useVoz';

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

// Mantém a tela acesa só enquanto a sessão existe e o praticante quer.
function ManterAcordado() {
  useKeepAwake('nockhug-sessao');
  return null;
}

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

const MOTIVO_SEM_RETOMADA: Record<MotivoSemRetomada, string> = {
  configuracao: 'A retomada automática está desligada nas Configurações.',
  desligou: 'Você desligou a série. Diga “Nock, liga” quando quiser.',
  cancelada: 'Você cancelou a retomada. O descanso continua.',
  falha: 'Não consegui retomar. Diga “Nock, liga” ou toque em Ligar.',
  concluido: '',
};

// O anel esvazia continuamente na thread de UI; o número muda a cada segundo.
function Descanso({
  ate,
  total,
  autoRetomar,
  motivo,
  proximaBolas,
  velocidade,
  aoCancelar,
  aoLigarAgora,
  aoAjustar,
}: {
  ate: number;
  total: number;
  autoRetomar: boolean;
  motivo: MotivoSemRetomada | null;
  proximaBolas: number;
  velocidade?: { lancador: number; alimentador: number };
  aoCancelar: () => void;
  aoLigarAgora: () => void;
  aoAjustar: (delta: number) => void;
}) {
  const { c } = useTema();
  const agora = useAgora(250);
  const resta = segundosRestantes(ate, agora);
  const situacao = situacaoDescanso(ate - agora, autoRetomar);
  const avisando = situacao === 'avisando';
  const r = 66;
  const comp = 2 * Math.PI * r;
  const fracao = useSharedValue(Math.max(0, (ate - agora) / (total * 1000)));

  useEffect(() => {
    const ms = Math.max(0, ate - Date.now());
    fracao.set(ms / Math.max(1, total * 1000));
    fracao.set(withTiming(0, { duration: ms, easing: Easing.linear }));
  }, [ate, total, fracao]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: comp * (1 - Math.min(1, fracao.get())) }));

  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 2 }}>
      <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={160} height={160} style={{ position: 'absolute' }}>
          <Circle cx={80} cy={80} r={r} stroke="rgba(246,249,232,0.12)" strokeWidth={10} fill="none" />
          <CirculoAnimado
            cx={80}
            cy={80}
            r={r}
            stroke={avisando ? paleta.limao : paleta.bege}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${comp}`}
            animatedProps={props}
            rotation={-90}
            originX={80}
            originY={80}
          />
        </Svg>
        {resta ? (
          <Pulso ativo={avisando} escala={1.08}>
            <Numero tamanho={58} cor={c.quadraTexto}>{resta}</Numero>
          </Pulso>
        ) : (
          <Icone.Check cor={paleta.limao} tamanho={48} espessura={3} />
        )}
        <Texto tamanho={12} peso="semi" cor={c.quadraTextoSuave}>{resta ? (avisando ? 'ligando' : 'descanso') : 'pronto'}</Texto>
      </View>

      <View style={{ alignItems: 'center', gap: 3 }}>
        <Texto tamanho={15} peso={avisando ? 'negrito' : 'semi'} cor={avisando ? paleta.limao : c.quadraTexto} estilo={{ textAlign: 'center' }}>
          {autoRetomar ? (avisando ? 'Motores ligam em instantes' : 'Retomo sozinho no fim do descanso') : 'Retomada automática desligada'}
        </Texto>
        {autoRetomar ? (
          <Texto tamanho={13} cor={c.quadraTextoSuave} estilo={{ textAlign: 'center' }}>
            Diga “Nock, desliga” ou “Nock, para” para cancelar
          </Texto>
        ) : motivo && MOTIVO_SEM_RETOMADA[motivo] ? (
          <Texto tamanho={13} cor={c.quadraTextoSuave} estilo={{ textAlign: 'center' }}>{MOTIVO_SEM_RETOMADA[motivo]}</Texto>
        ) : null}
        {proximaBolas > 0 && (
          <Texto tamanho={13} cor={c.quadraTextoSuave} estilo={{ textAlign: 'center' }}>
            Próxima série: <Negrito cor={c.quadraTexto}>{proximaBolas} bolas</Negrito>
            {velocidade ? ` · lançador ${pct(velocidade.lancador)}%` : ''}
          </Texto>
        )}
      </View>

      {resta > 0 && autoRetomar ? (
        <View style={{ alignSelf: 'stretch', gap: 4 }}>
          <Botao titulo="Cancelar retomada" variante="vidro" altura={54} tamanhoTexto={17} icone={<Icone.Pausa cor={c.quadraTexto} tamanho={18} />} aoTocar={aoCancelar} />
          <Toque
            accessibilityRole="button"
            accessibilityLabel="Pular o descanso. Os motores ligam depois da contagem de 5 segundos"
            onPress={aoLigarAgora}
            hitSlop={6}
            estilo={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Icone.Play cor={paleta.limao} tamanho={14} />
            <Texto tamanho={14} peso="semi" cor={paleta.limao}>Pular descanso</Texto>
          </Toque>
        </View>
      ) : (
        <Botao
          titulo="Ligar"
          altura={54}
          tamanhoTexto={17}
          icone={<Icone.Play cor={c.limaoTinta} tamanho={18} />}
          aoTocar={aoLigarAgora}
          estilo={{ alignSelf: 'stretch' }}
        />
      )}

      <AjusteDescanso total={total} aoAjustar={aoAjustar} />
    </View>
  );
}

// O tempo de descanso da sessão, sempre à mão sobre a quadra: durante a série
// vale para o próximo descanso; no descanso, muda o que está correndo.
function AjusteDescanso({ total, aoAjustar }: { total: number; aoAjustar: (delta: number) => void }) {
  const { c } = useTema();
  return (
    <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(246,249,232,0.12)' }}>
      <View style={{ flexShrink: 1 }}>
        <Texto tamanho={15} peso="medio" cor={c.quadraTexto}>Descanso</Texto>
        <Texto tamanho={12} cor={c.quadraTextoSuave}>Entre séries · só nesta sessão</Texto>
      </View>
      <Passo
        escuro
        rotulo="tempo de descanso entre séries"
        valor={`${total} s`}
        minimo={LIMITES.descansoS.min}
        maximo={LIMITES.descansoS.max}
        aoMenos={() => aoAjustar(-LIMITES.descansoS.passo)}
        aoMais={() => aoAjustar(LIMITES.descansoS.passo)}
      />
    </View>
  );
}

// A contagem antes de os motores ligarem: o anel se fecha em 5 s, o número
// bate a cada bip e cancelar é o maior alvo da quadra.
function Contagem({ partida, aoCancelar }: { partida: Partida; aoCancelar: () => void }) {
  const { c } = useTema();
  const agora = useAgora(100);
  const resta = Math.max(0, partida.em - agora);
  const segundo = Math.max(1, Math.ceil(resta / 1000));
  const r = 66;
  const comp = 2 * Math.PI * r;
  const fracao = useSharedValue(Math.min(1, resta / CONTAGEM_MS));

  useEffect(() => {
    const ms = Math.max(0, partida.em - Date.now());
    fracao.set(Math.min(1, ms / CONTAGEM_MS));
    fracao.set(withTiming(0, { duration: ms, easing: Easing.linear }));
  }, [partida.em, fracao]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: comp * (1 - fracao.get()) }));
  const acao = partida.comando === 'retomar' ? 'Retomando' : 'Motores ligam';
  // O leitor de tela fala este rótulo em voz alta: nada de "Nock, desliga"
  // aqui, que o microfone tomaria por comando.
  const rotulo = `${acao} em ${segundo} segundos. O botão Cancelar está logo abaixo.`;

  return (
    <View
      style={{ alignItems: 'center', gap: 12, paddingVertical: 2 }}
      accessible
      accessibilityLiveRegion="assertive"
      accessibilityLabel={rotulo}
    >
      <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={160} height={160} style={{ position: 'absolute' }}>
          <Circle cx={80} cy={80} r={r} stroke="rgba(246,249,232,0.12)" strokeWidth={10} fill="none" />
          <CirculoAnimado
            cx={80}
            cy={80}
            r={r}
            stroke={paleta.limao}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${comp}`}
            animatedProps={props}
            rotation={-90}
            originX={80}
            originY={80}
          />
        </Svg>
        <Animated.View key={segundo} entering={ZoomIn.duration(220).easing(Easing.out(Easing.exp))}>
          <Numero tamanho={72} cor={paleta.limao}>{segundo}</Numero>
        </Animated.View>
      </View>
      <View style={{ alignItems: 'center', gap: 3 }}>
        <Texto tamanho={17} peso="negrito" cor={c.quadraTexto} estilo={{ textAlign: 'center' }}>{acao} em {segundo} s</Texto>
        <Texto tamanho={13} cor={c.quadraTextoSuave} estilo={{ textAlign: 'center' }}>Diga “Nock, desliga” para cancelar</Texto>
      </View>
      <Botao titulo="Cancelar" variante="vidro" altura={58} tamanhoTexto={18} icone={<Icone.Fechar cor={c.quadraTexto} tamanho={18} />} aoTocar={aoCancelar} estilo={{ alignSelf: 'stretch' }} />
    </View>
  );
}

// O fechamento do treino: depois da última série, o anel se fecha com o
// check e a tela segue sozinha para o resultado (XP, conquistas). O tempo
// cobre a frase "Série N de N concluída. Treino concluído".
const CELEBRACAO_MS = 3200;

function TreinoConcluido({ bolas, series }: { bolas: number; series: number }) {
  const { c } = useTema();
  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`Treino concluído. ${series} séries, ${bolas} bolas. Abrindo o resultado.`}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: paleta.verde, paddingHorizontal: 32 }}
    >
      <Animated.View
        entering={ZoomIn.delay(120).duration(420).easing(Easing.out(Easing.back(1.6)))}
        style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: paleta.limao, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icone.Check cor={paleta.verde} tamanho={64} espessura={3.5} />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(380).duration(320)} style={{ alignItems: 'center', gap: 6 }}>
        <Titulo tamanho={30} cor={paleta.limao}>Treino concluído!</Titulo>
        <Texto tamanho={17} cor={c.quadraTexto}>{series} {series === 1 ? 'série' : 'séries'} · {bolas} {bolas === 1 ? 'bola' : 'bolas'}</Texto>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(900).duration(400)}>
        <Texto tamanho={14} cor={c.quadraTextoSuave}>Calculando seu XP…</Texto>
      </Animated.View>
    </Animated.View>
  );
}

export default function Sessao() {
  const { c } = useTema();
  const config = useApp((s) => s.config);
  const { status, conexao, alvo, reconectar } = useLancadora();
  const s = useSessao();
  const [feedback, setFeedback] = useState<{ texto: string; ok: boolean; n: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const mexeuVoz = useRef(false);
  const saindo = useRef(false);
  const falarRef = useRef<(texto: string, sucesso: boolean) => void>(() => undefined);
  const mostrar = (texto: string, ok: boolean) => setFeedback((f) => ({ texto, ok, n: (f?.n ?? 0) + 1 }));

  const aoComando = useCallback(async (cmd: Comando, transcricao: string, ativada = true, origem: OrigemComando = 'voz') => {
    const r = await useSessao.getState().executar(cmd, origem, transcricao, ativada);
    mostrar(r.frase, r.aceito);
    // A contagem se anuncia pelos bips; falar por cima deles atrapalharia.
    if (!r.silencioso) falarRef.current(r.frase, r.aceito);
  }, []);

  const voz = useVoz({
    palavra: config.palavraAtivacao,
    retornoFalado: config.retornoFalado,
    modoReconhecimento: config.reconhecimento,
    manterEmSegundoPlano: config.escutaTelaBloqueada,
    sinalSonoro: config.bips,
    microfone: config.microfone,
    aoComando: (cmd, t, ativada) => void aoComando(cmd, t, ativada),
    aoIgnorado: (_, motivo) => motivo === 'sem_ativacao' && mostrar(`Sem “${config.palavraAtivacao}”`, false),
  });
  const vozFalar = voz.falar;
  const palavra = config.palavraAtivacao;
  useEffect(() => {
    // Durante a contagem, os bips têm a vez: a frase aparece na tela, sem voz.
    // Uma frase que o microfone tomaria por comando (dominio/frases.ts) também
    // fica só na tela.
    falarRef.current = (texto, ok) => {
      if (!contagemEmCurso() && fraseSegura(texto, palavra)) vozFalar(texto, ok);
    };
  }, [vozFalar, palavra]);

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

  // O relógio da partida: um bip por segundo nos 5 s antes dos motores
  // ligarem, o comando no zero e o fim do descanso.
  usePartidaAgendada({
    falar: (t, ok) => falarRef.current(t, ok),
    mostrar,
    aoFalhar: (f) => useSessao.getState().registrarFalha(f),
  });

  // Os 3 bips dos últimos segundos da série, os sinais de pausa e de fim e o
  // "Faltam 10 segundos de descanso".
  useAvisosDaSerie({ falar: (t, ok) => falarRef.current(t, ok), mostrar });

  const desligarVoz = voz.desligar;
  useEffect(() => {
    // Durante o encerramento, a parada confirmada não deve puxar a tela de
    // parada: o resultado está a caminho.
    if (s.fase === 'parada' && !s.encerrando) {
      desligarVoz();
      router.replace('/parada');
    }
  }, [s.fase, s.encerrando, desligarVoz]);

  // A sessão é para ser usada sem as mãos: se a permissão já foi dada, liga o
  // microfone sozinho. Quem não quiser toca na bola para desligar.
  // Ao sair da sessão (diagnóstico, configurações), o microfone para: o
  // leitor de tela dessas telas pode conter palavras de comando.
  useFocusEffect(
    useCallback(
      () => () => {
        desligarVoz();
      },
      [desligarVoz],
    ),
  );

  const ligarVozRef = useRef(voz.ligar);
  useEffect(() => {
    ligarVozRef.current = voz.ligar;
  }, [voz.ligar]);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      void (async () => {
        if (vivo && !mexeuVoz.current && (await reconhecedor.temPermissao())) await ligarVozRef.current();
      })();
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, []);

  const treino = s.treino;
  const concluido = !!treino && !ehLivre(treino) && s.series.length >= treino.series;

  const encerrar = useCallback(() => {
    const fazer = async () => {
      if (saindo.current) return;
      saindo.current = true;
      try {
        voz.desligar();
        const id = await useSessao.getState().encerrar(concluido ? 'concluida' : 'praticante');
        if (id) router.replace({ pathname: '/resultado/[id]', params: { id } });
        else if (useSessao.getState().ultimaFalha) {
          // A parada não foi confirmada: fica na sessão, com o cartão de erro e
          // o botão vermelho à mão. Não navega para longe dos motores.
          return;
        } else router.replace('/inicio');
      } finally {
        saindo.current = false;
      }
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

  // Fim do treino: a última série terminou pelas próprias bolas e a lançadora
  // confirmou ARMADO. O app comemora e encerra sozinho (mesmo caminho do
  // botão, que só segue com os motores parados), sem esperar um toque: quem
  // treina de fone não precisa pegar o celular, e o microfone para de
  // registrar falas numa sessão que já acabou.
  const [celebrando, setCelebrando] = useState(false);
  const celebrou = useRef<string | null>(null);
  const encerrarRef = useRef(encerrar);
  useEffect(() => {
    encerrarRef.current = encerrar;
  }, [encerrar]);
  const estadoAgora = conexao === 'desconectada' ? undefined : status?.estado;
  useEffect(() => {
    if (!concluido || !s.id || s.motivoSemRetomada !== 'concluido' || s.fase !== 'pronta' || estadoAgora !== 'ARMADO' || s.ultimaFalha) return;
    if (celebrou.current === s.id) return;
    celebrou.current = s.id;
    setCelebrando(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      // Uma emergência ou falha no meio da comemoração vence: nada de navegar.
      const atual = useSessao.getState();
      if (atual.fase === 'pronta' && atual.motivoSemRetomada === 'concluido' && !atual.ultimaFalha) encerrarRef.current();
      else setCelebrando(false);
    }, CELEBRACAO_MS);
  }, [concluido, s.id, s.motivoSemRetomada, s.fase, s.ultimaFalha, estadoAgora]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      encerrar();
      return true;
    });
    return () => sub.remove();
  }, [encerrar]);

  const cancelarPartida = () => {
    const frase = useSessao.getState().cancelarPartida();
    if (frase) {
      mostrar(frase, true);
      falarRef.current(frase, true);
    }
  };
  const ajustarDescanso = (delta: number) => useSessao.getState().ajustarDescanso(delta);

  const reparar = async () => {
    setOcupado(true);
    const r = await repararLancadora();
    setOcupado(false);
    mostrar(r.relato, r.ok);
    if (r.ok) {
      useSessao.getState().limparFalha();
      router.replace({ pathname: '/sessao/checklist', params: { rearmar: '1' } });
    } else if (r.falha) {
      useSessao.getState().registrarFalha(r.falha);
    }
  };

  const reconectarAgora = async () => {
    setOcupado(true);
    const ok = await reconectar();
    setOcupado(false);
    if (ok) {
      useSessao.getState().limparFalha();
      mostrar('Reconectada', true);
    } else {
      mostrar(useLancadora.getState().erro ?? 'Não foi possível reconectar', false);
    }
  };

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
  const serieAtual = Math.min(s.series.length + 1, treino.series);
  const pill = s.fase === 'descanso'
    ? { texto: 'Descanso', fundo: 'rgba(229,205,130,0.18)', cor: paleta.bege }
    : concluido && estado === 'ARMADO'
      ? { texto: 'Treino concluído', fundo: paleta.limao, cor: paleta.verde }
      : { texto: rotulo, fundo, cor };
  const micInfo = {
    desligada: ['Microfone desligado', 'Toque na bola para começar a ouvir'],
    esperando: [`Esperando “${config.palavraAtivacao}”`, `Diga “${config.palavraAtivacao}” e depois o comando`],
    ouvindo_comando: ['Ouvindo comando…', 'liga · desliga · pausa · retoma'],
  }[voz.estado];
  const IconeConexao = alvo?.simulado ? Icone.Simulada : alvo?.tipo === 'ble' ? Icone.Bluetooth : Icone.Wifi;
  const cmd = (k: Comando) => () => void aoComando(k, `[botão] ${k}`, k !== 'emergencia', 'botao');

  return (
    <Tela estilo={{ gap: 12 }}>
      {config.manterTelaAcesa && <ManterAcordado />}
      <Cabecalho
        titulo={treino.nome}
        sub={ehLivre(treino) ? 'Livre · até “desliga”' : `${treino.series} séries × ${treino.bolasPorSerie} bolas · descanso ${treino.descansoS} s`}
        aoVoltar={encerrar}
      />

      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
        {(conexao === 'perdida' || s.conexaoPerdida) && (
          <Toque onPress={() => void reconectarAgora()} accessibilityRole="button" estilo={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: c.perigoSuave, borderRadius: 18, padding: 14 }}>
            <Icone.Alerta cor={c.perigoTexto} />
            <Texto tamanho={14} peso="medio" cor={c.perigoTexto} estilo={{ flex: 1 }}>Conexão perdida. A lançadora parou os motores. Toque para reconectar.</Texto>
          </Toque>
        )}

        {estado === 'REPOUSO' && s.fase !== 'parada' && (
          <Toque
            onPress={() => router.replace({ pathname: '/sessao/checklist', params: { rearmar: '1' } })}
            accessibilityRole="button"
            accessibilityLabel="A lançadora está em repouso. Rearmar a sessão"
            estilo={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: c.begeSuave, borderRadius: 18, padding: 14 }}
          >
            <Icone.Escudo cor={c.begeTexto} tamanho={20} />
            <Texto tamanho={14} peso="medio" cor={c.begeTexto} estilo={{ flex: 1 }}>A lançadora voltou ao repouso. Toque para rearmar e continuar.</Texto>
            <Icone.Avancar cor={c.begeTexto} tamanho={16} />
          </Toque>
        )}

        {s.ultimaFalha && (
          <CartaoFalha
            falha={s.ultimaFalha}
            ocupado={ocupado}
            onReparar={() => void reparar()}
            onReconectar={() => void reconectarAgora()}
            onReiniciar={() => router.replace('/parada')}
            onToken={() => router.push('/lancadora')}
            onRearmar={() => router.replace({ pathname: '/sessao/checklist', params: { rearmar: '1' } })}
            onDiagnostico={() => router.push('/lancadora')}
            onFechar={() => useSessao.getState().limparFalha()}
          />
        )}

        <Quadra estilo={{ gap: 12, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pilula texto={pill.texto} fundo={pill.fundo} cor={pill.cor} />
              <Toque
                accessibilityRole="button"
                accessibilityLabel={`Lançadora ${alvo?.simulado ? 'simulada' : alvo?.tipo === 'ble' ? 'Bluetooth' : 'Wi-Fi'}, ${conexao}`}
                onPress={() => router.push('/lancadora')}
                hitSlop={6}
                estilo={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: conexao === 'conectada' ? 'rgba(223,255,79,0.16)' : 'rgba(246,249,232,0.08)' }}
              >
                <IconeConexao cor={conexao === 'conectada' ? paleta.limao : c.quadraTextoSuave} tamanho={15} />
              </Toque>
            </View>
            {!ehLivre(treino) && (
              <Texto tamanho={14} cor={c.quadraTextoSuave}>
                Série <Negrito cor={c.quadraTexto}>{serieAtual}</Negrito> de {treino.series}
              </Texto>
            )}
          </View>

          {s.partida?.origem === 'pedido' ? (
            <Contagem partida={s.partida} aoCancelar={cancelarPartida} />
          ) : s.fase === 'descanso' && s.descansoAte ? (
            <Descanso
              ate={s.descansoAte}
              total={treino.descansoS}
              autoRetomar={s.autoRetomar}
              motivo={s.motivoSemRetomada}
              proximaBolas={treino.bolasPorSerie}
              velocidade={treino.velocidade}
              aoCancelar={cancelarPartida}
              aoLigarAgora={() => void aoComando('ligar', 'botão Pular descanso', true, 'botao')}
              aoAjustar={ajustarDescanso}
            />
          ) : (
            <>
              <Lancadora girando={estado === 'LANCANDO'} altura={124} />
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
              {treino.velocidade && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icone.Raio cor={paleta.limao} tamanho={13} />
                  <Texto tamanho={12} cor={c.quadraTextoSuave}>{descreverVelocidade(treino.velocidade)}</Texto>
                </View>
              )}
              {!ehLivre(treino) && !concluido && <AjusteDescanso total={treino.descansoS} aoAjustar={ajustarDescanso} />}
            </>
          )}
        </Quadra>

        <Cartao estilo={{ gap: 12, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <OrbeVoz
              estado={voz.estado === 'desligada' ? 'desligada' : voz.estado === 'ouvindo_comando' ? 'ouvindo' : 'esperando'}
              rotulo={voz.estado === 'desligada' ? 'Ligar microfone' : 'Desligar microfone'}
              aoTocar={() => {
                mexeuVoz.current = true;
                if (voz.estado === 'desligada') void voz.ligar();
                else voz.desligar();
              }}
              tamanho={64}
            />
            <View style={{ flex: 1 }}>
              <Texto tamanho={17} peso="negrito">{micInfo[0]}</Texto>
              <Texto tamanho={13} cor={voz.erro ? c.perigoTexto : c.textoSuave}>
                {voz.erro ?? micInfo[1]}
                {voz.modo === 'aparelho' && !voz.erro ? ' · no aparelho' : ''}
                {voz.estado !== 'desligada' && !voz.erro && voz.entrada.tipo !== 'celular'
                  ? ` · pelo ${voz.entrada.tipo === 'fone_bt' ? 'fone Bluetooth' : 'fone com fio'}${voz.entrada.nome ? ` ${voz.entrada.nome}` : ''}`
                  : ''}
                {config.escutaTelaBloqueada && voz.estado !== 'desligada' && !voz.erro ? ' · ouve com a tela apagada' : ''}
              </Texto>
            </View>
          </View>
          <View style={{ backgroundColor: c.sutil, borderRadius: 14, paddingHorizontal: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
            <Icone.Fala cor={c.textoFraco} tamanho={16} />
            <Texto tamanho={14} cor={voz.ultimaFala ? c.texto : c.textoFraco} linhas={1} estilo={{ flex: 1, fontStyle: voz.ultimaFala ? 'italic' : 'normal' }}>{voz.ultimaFala ? `“${voz.ultimaFala}”` : 'Nada ouvido ainda'}</Texto>
            {feedback && (
              <Animated.View key={feedback.n} entering={FadeIn.duration(150)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, minHeight: 28, borderRadius: 14, backgroundColor: feedback.ok ? c.limaoSuave : c.perigoSuave, maxWidth: '58%' }}>
                {feedback.ok ? <Icone.Check cor={c.destaque} tamanho={14} /> : <Icone.Alerta cor={c.perigoTexto} tamanho={14} />}
                <Texto tamanho={13} peso="negrito" cor={feedback.ok ? c.destaque : c.perigoTexto} linhas={1} max={1.3} estilo={{ flexShrink: 1 }}>{feedback.texto}</Texto>
              </Animated.View>
            )}
          </View>
        </Cartao>

        {s.partida?.origem === 'pedido' ? (
          estado === 'PAUSADO' && <Botao titulo="Desligar" variante="quadra" altura={50} tamanhoTexto={16} aoTocar={cmd('desligar')} />
        ) : s.fase !== 'descanso' && (
          <View style={{ gap: 8 }}>
            <Botao titulo="Ligar" altura={54} tamanhoTexto={17} icone={<Icone.Play cor={c.limaoTinta} tamanho={18} />} aoTocar={cmd('ligar')} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Botao
                titulo={estado === 'PAUSADO' ? 'Retomar' : 'Pausar'}
                variante="contorno"
                altura={50}
                tamanhoTexto={16}
                estilo={{ flex: 1 }}
                aoTocar={cmd(estado === 'PAUSADO' ? 'retomar' : 'pausar')}
              />
              <Botao titulo="Desligar" variante="quadra" altura={50} tamanhoTexto={16} estilo={{ flex: 1 }} aoTocar={cmd('desligar')} />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={{ gap: 8 }}>
        {(concluido || s.series.length > 0) && estado !== 'LANCANDO' && (
          <Botao titulo={concluido ? 'Ver resultado' : 'Encerrar sessão'} variante={concluido ? 'primario' : 'suave'} altura={50} tamanhoTexto={17} aoTocar={encerrar} />
        )}
        <BotaoEmergencia aoTocar={cmd('emergencia')} />
      </View>
      {celebrando && <TreinoConcluido bolas={bolasDaSessao(s)} series={s.series.length} />}
    </Tela>
  );
}
