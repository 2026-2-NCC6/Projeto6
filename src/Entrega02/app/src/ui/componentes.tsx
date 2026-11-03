// Componentes base do NockHug (quadra à noite, bola limão).

import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Switch,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icone from './icones';
import { CSS_EASE_OUT, EASE_IN_OUT, haptico } from './movimento';
import { type Cores, fontes, type Peso, pesos, useTema } from './tema';

const PressavelAnimado = Animated.createAnimatedComponent(Pressable);

// Tudo que se toca afunda 3% em 120 ms: o retorno chega no toque, não na soltura.
export function Toque({
  children,
  estilo,
  escala = 0.97,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & { children: ReactNode; estilo?: StyleProp<ViewStyle>; escala?: number }) {
  const [pressionado, setPressionado] = useState(false);
  const reduzir = useReducedMotion();
  return (
    <PressavelAnimado
      pressRetentionOffset={16}
      {...props}
      onPressIn={(e) => {
        setPressionado(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressionado(false);
        onPressOut?.(e);
      }}
      style={[
        estilo,
        {
          transform: [{ scale: pressionado && !props.disabled && !reduzir ? escala : 1 }],
          transitionProperty: 'transform',
          transitionDuration: pressionado ? 100 : 220,
          transitionTimingFunction: CSS_EASE_OUT,
        },
      ]}
    >
      {children}
    </PressavelAnimado>
  );
}

export function Tela({ children, fundo, estilo, bordas = ['top', 'bottom'] }: { children: ReactNode; fundo?: string; estilo?: StyleProp<ViewStyle>; bordas?: ('top' | 'bottom')[] }) {
  const { c } = useTema();
  return (
    <SafeAreaView edges={bordas} style={{ flex: 1, backgroundColor: fundo ?? c.fundo }}>
      <View style={[{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 16 }, estilo]}>{children}</View>
    </SafeAreaView>
  );
}

export function Titulo({ children, tamanho = 34, cor, estilo, linhas }: { children: ReactNode; tamanho?: number; cor?: string; estilo?: StyleProp<TextStyle>; linhas?: number }) {
  const { c } = useTema();
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={linhas}
      maxFontSizeMultiplier={1.3}
      style={[{ fontFamily: fontes.titulo, fontSize: tamanho, lineHeight: Math.round(tamanho * 1.08), letterSpacing: -tamanho * 0.025, color: cor ?? c.texto }, estilo]}
    >
      {children}
    </Text>
  );
}

// Linha de título em destaque: no claro ganha o traço limão que sublinha a
// marca na logo; no escuro o próprio texto fica limão.
export function TituloDestaque({ children, tamanho = 40 }: { children: ReactNode; tamanho?: number }) {
  const { c, escuro } = useTema();
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      {!escuro && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: -2, right: -4, bottom: tamanho * 0.1, height: tamanho * 0.28, borderRadius: tamanho * 0.14, backgroundColor: c.limao, transform: [{ rotate: '-1.2deg' }] }}
        />
      )}
      <Titulo tamanho={tamanho} cor={c.destaque}>{children}</Titulo>
    </View>
  );
}

// Número de placar: Bricolage com algarismos de largura fixa.
export function Numero({ children, tamanho = 40, cor, estilo }: { children: ReactNode; tamanho?: number; cor?: string; estilo?: StyleProp<TextStyle> }) {
  const { c } = useTema();
  return (
    <Text
      maxFontSizeMultiplier={1.2}
      style={[{ fontFamily: fontes.titulo, fontSize: tamanho, lineHeight: Math.round(tamanho * 1.02), letterSpacing: -tamanho * 0.03, color: cor ?? c.texto, fontVariant: ['tabular-nums'] }, estilo]}
    >
      {children}
    </Text>
  );
}

export function Texto({ children, tamanho = 16, cor, peso = 'texto', estilo, linhas, selectable, max }: { children: ReactNode; tamanho?: number; cor?: string; peso?: Peso; estilo?: StyleProp<TextStyle>; linhas?: number; selectable?: boolean; max?: number }) {
  const { c } = useTema();
  return (
    <Text
      numberOfLines={linhas}
      selectable={selectable}
      maxFontSizeMultiplier={max}
      style={[{ fontSize: tamanho, fontWeight: pesos[peso], lineHeight: Math.round(tamanho * 1.38) /* inteiro: entrelinha fracionária corta a última linha no iOS */, color: cor ?? c.texto }, estilo]}
    >
      {children}
    </Text>
  );
}

// Trecho em negrito dentro de um <Texto>: herda tamanho e entrelinha do pai.
export function Negrito({ children, cor }: { children: ReactNode; cor?: string }) {
  return <Text style={{ fontWeight: '700', color: cor }}>{children}</Text>;
}

// Cabeçalho de grupo, no padrão das listas agrupadas do iOS.
export function Rotulo({ children, cor }: { children: ReactNode; cor?: string }) {
  const { c } = useTema();
  return <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 0.4, color: cor ?? c.textoSuave, textTransform: 'uppercase', marginTop: 6, marginLeft: 4 }}>{children}</Text>;
}

type Variante = 'primario' | 'quadra' | 'contorno' | 'perigo' | 'claro' | 'suave' | 'vidro';

function coresDoBotao(v: Variante, c: Cores) {
  switch (v) {
    case 'primario': return { bg: c.limao, fg: c.limaoTinta, borda: c.limaoBorda, sombra: c.sombraBotao };
    case 'quadra': return { bg: c.sombra ? c.quadra : c.quadraAlta, fg: c.quadraTexto, borda: c.quadra, sombra: '' };
    case 'perigo': return { bg: c.perigo, fg: '#FFFFFF', borda: c.perigo, sombra: '0px 10px 24px -12px rgba(215,51,46,0.7)' };
    case 'claro': return { bg: '#FFFFFF', fg: c.perigoFundo, borda: '#FFFFFF', sombra: '' };
    // Botão de vidro: existe sobre a quadra, onde o cartão e o contorno
    // normais não têm contraste. Ação calma, não destrutiva.
    case 'vidro': return { bg: 'rgba(246,249,232,0.13)', fg: c.quadraTexto, borda: 'rgba(246,249,232,0.24)', sombra: '' };
    case 'suave': return { bg: c.sutil, fg: c.texto, borda: c.sutil, sombra: '' };
    default: return { bg: 'transparent', fg: c.texto, borda: c.bordaForte, sombra: '' };
  }
}

export function Botao({
  titulo,
  aoTocar,
  variante = 'primario',
  altura = 58,
  desabilitado,
  carregando,
  icone,
  estilo,
  tamanhoTexto = 18,
  acessibilidade,
  haptico: tipoHaptico,
}: {
  titulo: string;
  aoTocar?: () => void;
  variante?: Variante;
  altura?: number;
  desabilitado?: boolean;
  carregando?: boolean;
  icone?: ReactNode;
  estilo?: StyleProp<ViewStyle>;
  tamanhoTexto?: number;
  acessibilidade?: string;
  haptico?: keyof typeof haptico;
}) {
  const { c } = useTema();
  const k = coresDoBotao(variante, c);
  const off = desabilitado || carregando;
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={acessibilidade ?? titulo}
      accessibilityState={{ disabled: !!off, busy: !!carregando }}
      disabled={off}
      onPress={() => {
        if (tipoHaptico) haptico[tipoHaptico]();
        aoTocar?.();
      }}
      estilo={[
        {
          height: altura,
          borderRadius: Math.min(22, altura / 2),
          backgroundColor: desabilitado ? c.sutil : k.bg,
          borderWidth: variante === 'contorno' ? 1.5 : variante === 'vidro' ? 1 : variante === 'primario' && !desabilitado ? 1 : 0,
          borderColor: k.borda,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 10,
          paddingHorizontal: 18,
          boxShadow: desabilitado ? '' : k.sombra,
        },
        estilo,
      ]}
    >
      {carregando ? <ActivityIndicator color={k.fg} /> : desabilitado ? null : icone}
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ fontFamily: fontes.tituloForte, fontSize: tamanhoTexto, letterSpacing: -0.2, color: desabilitado ? c.textoFraco : k.fg }}>
        {titulo}
      </Text>
    </Toque>
  );
}

export function BotaoEmergencia({ aoTocar, altura = 62 }: { aoTocar: () => void; altura?: number }) {
  return (
    <Botao
      titulo="Parar tudo"
      variante="perigo"
      altura={altura}
      tamanhoTexto={21}
      haptico="forte"
      aoTocar={aoTocar}
      icone={<Icone.Parar cor="#FFFFFF" tamanho={24} />}
      acessibilidade="Parar tudo: parada de emergência"
    />
  );
}

export function BotaoIcone({ aoTocar, rotulo, children, escuro }: { aoTocar: () => void; rotulo: string; children: ReactNode; escuro?: boolean }) {
  const { c } = useTema();
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoTocar}
      hitSlop={6}
      escala={0.92}
      estilo={{ width: 44, height: 44, borderRadius: 22, backgroundColor: escuro ? c.quadraAlta : c.cartao, borderWidth: escuro ? 0 : 1, borderColor: c.borda, alignItems: 'center', justifyContent: 'center', boxShadow: escuro ? '' : c.sombra }}
    >
      {children}
    </Toque>
  );
}

export function Voltar({ para }: { para?: () => void }) {
  const { c } = useTema();
  return (
    <BotaoIcone rotulo="Voltar" aoTocar={para ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}>
      <Icone.Voltar cor={c.texto} />
    </BotaoIcone>
  );
}

// Cabeçalho das telas empilhadas: voltar e título na mesma linha.
export function Cabecalho({ titulo, sub, direita, aoVoltar }: { titulo: string; sub?: string; direita?: ReactNode; aoVoltar?: () => void }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Voltar para={aoVoltar} />
      <View style={{ flex: 1 }}>
        <Titulo tamanho={24} linhas={1}>{titulo}</Titulo>
        {sub ? <Texto tamanho={13} cor={c.textoSuave} linhas={2}>{sub}</Texto> : null}
      </View>
      {direita}
    </View>
  );
}

export function Cartao({ children, estilo, destaque, live }: { children: ReactNode; estilo?: StyleProp<ViewStyle>; destaque?: string; live?: boolean }) {
  const { c } = useTema();
  return (
    <View
      accessibilityLiveRegion={live ? 'polite' : undefined}
      accessibilityRole={live ? 'alert' : undefined}
      style={[
        {
          backgroundColor: c.cartao,
          borderWidth: destaque ? 1.5 : c.sombra ? 0 : 1,
          borderColor: destaque ?? c.borda,
          borderRadius: 22,
          padding: 16,
          boxShadow: c.sombra,
        },
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

// A quadra: a superfície verde que carrega o conteúdo principal de cada tela.
export function Quadra({ children, estilo, linhas = true }: { children: ReactNode; estilo?: StyleProp<ViewStyle>; linhas?: boolean }) {
  const { c } = useTema();
  const [tam, setTam] = useState({ w: 0, h: 0 });
  return (
    <View
      onLayout={linhas ? (e: LayoutChangeEvent) => setTam({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }) : undefined}
      style={[
        {
          backgroundColor: c.quadra,
          borderRadius: 26,
          padding: 18,
          overflow: 'hidden',
          experimental_backgroundImage: `radial-gradient(circle at 15% 0%, ${c.quadraAlta} 0%, ${c.quadra} 70%)`,
        },
        estilo,
      ]}
    >
      {linhas && tam.w > 0 && <Icone.LinhasQuadra cor={c.quadraLinha} largura={tam.w} altura={tam.h} />}
      {children}
    </View>
  );
}

export function Pilula({ texto, fundo, cor, icone }: { texto: string; fundo: string; cor: string; icone?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 4, minHeight: 30, borderRadius: 15, backgroundColor: fundo, alignSelf: 'flex-start' }}>
      {icone ?? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cor }} />}
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.2, color: cor }}>{texto}</Text>
    </View>
  );
}

export function Opcao({ texto, ativo, aoTocar, redondo }: { texto: string; ativo: boolean; aoTocar: () => void; redondo?: boolean }) {
  const { c } = useTema();
  return (
    <Toque
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      onPress={() => {
        haptico.selecao();
        aoTocar();
      }}
      estilo={{
        minHeight: 44,
        paddingHorizontal: 16,
        borderRadius: redondo ? 22 : 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ativo ? c.selecao : c.cartao,
        borderWidth: 1,
        borderColor: ativo ? c.selecao : c.borda,
        flexGrow: redondo ? 0 : 1,
        flexBasis: redondo ? 'auto' : 0,
        transitionProperty: ['backgroundColor', 'borderColor'],
        transitionDuration: 160,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '600', color: ativo ? c.selecaoTexto : c.texto }}>{texto}</Text>
    </Toque>
  );
}

// Controle segmentado com o indicador deslizando sob a opção escolhida.
export function Segmentos<T extends string>({ opcoes, valor, aoMudar, altura = 36 }: { opcoes: [T, string][]; valor: T; aoMudar: (v: T) => void; altura?: number }) {
  const { c } = useTema();
  const reduzir = useReducedMotion();
  const [largura, setLargura] = useState(0);
  const i = Math.max(0, opcoes.findIndex(([v]) => v === valor));
  const seg = largura ? (largura - 6) / opcoes.length : 0;
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', backgroundColor: c.sutil, borderRadius: altura / 2 + 3, padding: 3 }}>
      {seg > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 3,
            left: 3,
            width: seg,
            height: altura,
            borderRadius: altura / 2,
            // No escuro o cartão some sobre o trilho; a borda forte destaca.
            backgroundColor: c.sombra ? c.cartao : c.bordaForte,
            boxShadow: '0px 1px 3px rgba(0,0,0,0.12)',
            transform: [{ translateX: i * seg }],
            transitionProperty: 'transform',
            transitionDuration: reduzir ? 0 : 240,
            transitionTimingFunction: CSS_EASE_OUT,
          }}
        />
      )}
      {opcoes.map(([v, t]) => (
        <Pressable
          key={v}
          accessibilityRole="tab"
          accessibilityState={{ selected: v === valor }}
          onPress={() => {
            if (v !== valor) haptico.selecao();
            aoMudar(v);
          }}
          style={{ flex: 1, height: altura, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: v === valor ? '700' : '500', color: v === valor ? c.texto : c.textoSuave }}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Passo({ valor, aoMenos, aoMais, rotulo, escuro, minimo, maximo }: { valor: string | number; aoMenos: () => void; aoMais: () => void; rotulo: string; escuro?: boolean; minimo?: number; maximo?: number }) {
  const { c } = useTema();
  const cor = escuro ? c.quadraTexto : c.texto;
  const b = { width: 44, height: 44, borderRadius: 22, backgroundColor: escuro ? 'rgba(246,249,232,0.14)' : c.sutil, alignItems: 'center' as const, justifyContent: 'center' as const };
  const texto = String(valor);
  const numero = Number(texto.replace(/[^\d-]/g, ''));
  const temNumero = Number.isFinite(numero) && texto.replace(/[^\d-]/g, '') !== '';
  const noMinimo = temNumero && minimo != null && numero <= minimo;
  const noMaximo = temNumero && maximo != null && numero >= maximo;
  const agir = (direcao: 'increment' | 'decrement') => {
    if ((direcao === 'increment' && noMaximo) || (direcao === 'decrement' && noMinimo)) return;
    haptico.selecao();
    if (direcao === 'increment') aoMais();
    else aoMenos();
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={rotulo}
      accessibilityValue={{ text: texto, ...(minimo != null ? { min: minimo } : {}), ...(maximo != null ? { max: maximo } : {}), ...(temNumero ? { now: numero } : {}) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const acao = e.nativeEvent.actionName;
        if (acao === 'increment' || acao === 'decrement') agir(acao);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      <Toque accessibilityElementsHidden importantForAccessibility="no-hide-descendants" disabled={noMinimo} accessibilityLabel={`Diminuir ${rotulo}`} onPress={() => agir('decrement')} escala={0.9} estilo={[b, { opacity: noMinimo ? 0.4 : 1 }]}>
        <Icone.Menos cor={cor} />
      </Toque>
      <Numero tamanho={22} cor={cor} estilo={{ minWidth: 58, textAlign: 'center' }}>{valor}</Numero>
      <Toque accessibilityElementsHidden importantForAccessibility="no-hide-descendants" disabled={noMaximo} accessibilityLabel={`Aumentar ${rotulo}`} onPress={() => agir('increment')} escala={0.9} estilo={[b, { opacity: noMaximo ? 0.4 : 1 }]}>
        <Icone.Mais cor={cor} />
      </Toque>
    </View>
  );
}

// Pulso lento para o que está prestes a acontecer (o fim do descanso). Some
// com o "Reduzir movimento" do sistema.
export function Pulso({ ativo, escala = 1.06, children }: { ativo: boolean; escala?: number; children: ReactNode }) {
  const reduzir = useReducedMotion();
  const valor = useSharedValue(1);
  useEffect(() => {
    if (ativo && !reduzir) {
      valor.set(withRepeat(withSequence(withTiming(escala, { duration: 620, easing: EASE_IN_OUT }), withTiming(1, { duration: 620, easing: EASE_IN_OUT })), -1, true));
    } else {
      valor.set(withTiming(1, { duration: 180 }));
    }
  }, [ativo, escala, reduzir, valor]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: valor.get() }] }));
  return <Animated.View style={estilo}>{children}</Animated.View>;
}

export function Interruptor({ ligado, aoTrocar, rotulo, sub }: { ligado: boolean; aoTrocar: () => void; rotulo: string; sub?: string }) {
  const { c, escuro } = useTema();
  return (
    <View style={estilos.linha}>
      <View style={{ flex: 1 }}>
        <Texto tamanho={16} peso="medio">{rotulo}</Texto>
        {sub ? <Texto tamanho={13} cor={c.textoSuave}>{sub}</Texto> : null}
      </View>
      <Switch
        accessibilityLabel={rotulo}
        value={ligado}
        onValueChange={aoTrocar}
        trackColor={{ true: escuro ? c.limao : c.quadra, false: c.trilho }}
        thumbColor={escuro && ligado ? c.quadra : '#FFFFFF'}
        ios_backgroundColor={c.trilho}
      />
    </View>
  );
}

// Barra de progresso. O preenchimento é absoluto e sem filhos, então animar a
// largura não reflui nada à volta.
export function Barra({ fracao, cor, trilho, altura = 8 }: { fracao: number; cor?: string; trilho?: string; altura?: number }) {
  const { c } = useTema();
  const reduzir = useReducedMotion();
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <View style={{ height: altura, borderRadius: altura / 2, backgroundColor: trilho ?? c.trilho, overflow: 'hidden' }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${f * 100}%`,
          borderRadius: altura / 2,
          backgroundColor: cor ?? c.progresso,
          transitionProperty: 'width',
          transitionDuration: reduzir ? 0 : 420,
          transitionTimingFunction: CSS_EASE_OUT,
        }}
      />
    </View>
  );
}

export function PontosOnboarding({ atual, total = 7 }: { atual: number; total?: number }) {
  const { c } = useTema();
  return (
    <View accessibilityLabel={`Passo ${atual} de ${total}`} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ width: i + 1 === atual ? 24 : 7, height: 7, borderRadius: 4, backgroundColor: i + 1 <= atual ? c.progresso : c.trilho }} />
      ))}
    </View>
  );
}

// Linha de lista agrupada (Configurações, permissões).
export function Grupo({ children }: { children: ReactNode }) {
  const { c } = useTema();
  return <View style={{ backgroundColor: c.cartao, borderWidth: c.sombra ? 0 : 1, borderColor: c.borda, borderRadius: 20, overflow: 'hidden', boxShadow: c.sombra }}>{children}</View>;
}

export function Divisor() {
  const { c } = useTema();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bordaForte, marginLeft: 16, opacity: 0.6 }} />;
}

// Avatar: a foto do perfil ou as iniciais sobre a bola.
export function Avatar({ fotoUri, iniciais, tamanho = 48 }: { fotoUri?: string | null; iniciais: string; tamanho?: number }) {
  const { c } = useTema();
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: c.limao, borderWidth: 1, borderColor: c.limaoBorda, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {fotoUri ? (
        <Animated.Image source={{ uri: fotoUri }} style={{ width: tamanho, height: tamanho }} />
      ) : (
        <Text style={{ fontFamily: fontes.titulo, fontSize: tamanho * 0.4, letterSpacing: -0.5, color: c.limaoTinta }}>{iniciais}</Text>
      )}
    </View>
  );
}

// Faixa sob a barra de status das abas, para o conteúdo rolado não passar por
// baixo do relógio.
export function FaixaStatus() {
  const { c } = useTema();
  const topo = useSafeAreaInsets().top;
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topo + 6, experimental_backgroundImage: `linear-gradient(to bottom, ${c.fundo} 70%, ${c.fundo}00 100%)` }} />;
}

export const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8 },
  entreLados: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
