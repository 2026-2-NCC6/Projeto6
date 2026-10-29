// Parada segura (PRD SE-11): estado absorvente. Sair exige segurar o botão por
// 2 s, e depois disso um checklist novo.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSessao } from '@/sessao/sessao';
import { Botao, Negrito, Texto } from '@/ui/componentes';
import { hora } from '@/ui/formato';
import * as Icone from '@/ui/icones';
import { entrada, pouso } from '@/ui/movimento';
import { Segurar } from '@/ui/Segurar';
import { fontes, useTema } from '@/ui/tema';

const ROSA = '#FFD9D4';

export default function Parada() {
  const { c } = useTema();
  const s = useSessao();
  const [erro, setErro] = useState<string | null>(null);
  const [chave, setChave] = useState(0);
  const emergencia = [...s.comandos].reverse().find((x) => x.comando === 'emergencia' && x.aceito);
  const ultima = s.series[s.series.length - 1];

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const reiniciar = async () => {
    setErro(null);
    const ok = await useSessao.getState().reiniciarAposParada();
    if (ok) router.replace({ pathname: '/sessao/checklist', params: { rearmar: '1' } });
    else {
      setChave((k) => k + 1); // zera o preenchimento do botão
      setErro('A lançadora não respondeu. Confira a conexão e tente de novo.');
    }
  };

  const encerrar = async () => {
    const id = await useSessao.getState().encerrar('parada_segura');
    if (id) router.replace({ pathname: '/resultado/[id]', params: { id } });
    else router.replace('/inicio');
  };

  const linhas: [string, string][] = [
    ['Motivo', emergencia?.origem === 'voz' ? `palavra de emergência (“${emergencia.transcricao}”)` : 'botão Parar tudo'],
    ...(emergencia ? [['Quando', `${hora(emergencia.ts)}${ultima ? `, série ${ultima.indice}` : ''}`] as [string, string]] : []),
    ...(ultima?.motivo === 'emergencia' ? [['Bolas na série', `${ultima.bolas} estimadas`] as [string, string]] : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.perigoFundo, experimental_backgroundImage: `radial-gradient(circle at 50% 28%, #7A1C17 0%, ${c.perigoFundo} 62%)` }}>
      <View style={{ flex: 1, padding: 24, gap: 16 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <Animated.View entering={pouso()} style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 2, borderColor: 'rgba(255,217,212,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Icone.Cadeado cor="#FFFFFF" tamanho={58} />
          </Animated.View>
          <Animated.View entering={entrada(80)} style={{ alignItems: 'center', gap: 10 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fontes.titulo, fontSize: 46, lineHeight: 48, letterSpacing: -1.2, color: '#FFFFFF', textAlign: 'center' }}>Parada segura</Text>
            <Texto tamanho={17} cor={ROSA} estilo={{ textAlign: 'center' }}>
              Motores parados e bloqueados. A lançadora ignora qualquer comando, de voz ou de botão, até ser reiniciada.
            </Texto>
          </Animated.View>
          <Animated.View entering={entrada(160)} style={{ backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, alignSelf: 'stretch' }}>
            {linhas.map(([k, v], i) => (
              <View key={k} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(255,217,212,0.14)' }}>
                <Texto tamanho={14} cor={ROSA} estilo={{ width: 104 }}>{k}</Texto>
                <Texto tamanho={14} peso="semi" cor="#FFFFFF" estilo={{ flex: 1 }}>{v}</Texto>
              </View>
            ))}
          </Animated.View>
        </View>
        {erro && <Texto tamanho={14} peso="semi" cor={ROSA}><Negrito>Atenção:</Negrito> {erro}</Texto>}
        <Segurar key={chave} titulo="Segure 2 s para reiniciar" cor="#FFFFFF" preenchimento="rgba(255,255,255,0.22)" altura={68} acessibilidade="Segure por 2 segundos para reiniciar" aoConcluir={() => void reiniciar()} />
        <Botao titulo="Encerrar e ver resultado" variante="claro" altura={54} tamanhoTexto={17} aoTocar={encerrar} />
      </View>
    </SafeAreaView>
  );
}
