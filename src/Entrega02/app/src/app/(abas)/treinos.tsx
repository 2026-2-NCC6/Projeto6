import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { descreverTreino, duracaoEstimadaMin, dutyDe, ehLivre, LIMITES, passoPct, pct, TREINOS_PRONTOS } from '@/dominio/treinos';
import type { Treino } from '@/dominio/tipos';
import { useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import { msPorBolaCom } from '@/lancadora/contrato';
import { Campo } from '@/telas/FormPerfil';
import { Botao, Cartao, Divisor, FaixaStatus, Numero, Passo, Rotulo, Texto, Titulo, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { haptico } from '@/ui/movimento';
import { useTema } from '@/ui/tema';

function ItemTreino({ t, aoSegurar }: { t: Treino; aoSegurar?: () => void }) {
  const { c } = useTema();
  const livre = ehLivre(t);
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={`${t.nome}, ${descreverTreino(t)}`}
      accessibilityHint={aoSegurar ? 'Toque para treinar, segure para apagar' : 'Toque para treinar'}
      onPress={() => router.push({ pathname: '/sessao/checklist', params: { treino: t.id } })}
      onLongPress={
        aoSegurar &&
        (() => {
          haptico.leve();
          aoSegurar();
        })
      }
      estilo={{ backgroundColor: c.cartao, borderWidth: c.sombra ? 0 : 1, borderColor: c.borda, boxShadow: c.sombra, borderRadius: 20, padding: 12, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}
    >
      <View style={{ width: 60, height: 52, borderRadius: 16, backgroundColor: c.quadra, alignItems: 'center', justifyContent: 'center' }}>
        {livre ? <Icone.Infinito cor={c.limao} tamanho={26} /> : <Numero tamanho={19} cor={c.limao}>{`${t.series}×${t.bolasPorSerie}`}</Numero>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Texto tamanho={16} peso="negrito" linhas={1}>{t.nome}</Texto>
        <Texto tamanho={13} cor={c.textoSuave} linhas={2}>{descreverTreino(t)}</Texto>
      </View>
      <Icone.Avancar cor={c.textoFraco} />
    </Toque>
  );
}

export default function Treinos() {
  const { c } = useTema();
  const topo = useSafeAreaInsets().top;
  const criados = useApp((s) => s.treinos);
  const salvar = useApp((s) => s.salvarTreino);
  const apagar = useApp((s) => s.apagarTreino);
  const calibracao = useLancadora(useShallow((s) => ({ msPorBola: s.status?.msPorBola ?? 3000, alimentadorCalib: s.status?.alimentadorCalib })));
  const padrao = useApp((s) => s.config.velocidadePadrao);
  const [nome, setNome] = useState('');
  const [bolas, setBolas] = useState(15);
  const [series, setSeries] = useState(4);
  const [descanso, setDescanso] = useState(40);
  const [lancador, setLancador] = useState(padrao.lancador);
  const [alimentador, setAlimentador] = useState(padrao.alimentador);

  // Igual ao padrão, o treino não guarda velocidade e acompanha as Configurações.
  const proprio = lancador !== padrao.lancador || alimentador !== padrao.alimentador;
  const novo: Treino = {
    id: '',
    nome: nome.trim(),
    bolasPorSerie: bolas,
    series,
    descansoS: descanso,
    pronto: false,
    ...(proprio ? { velocidade: { lancador, alimentador } } : {}),
  };
  const msPorBola = msPorBolaCom(calibracao, alimentador);
  const mudarPct = (duty: number, d: number, l: typeof LIMITES.lancadorPct) => dutyDe(passoPct(pct(duty), d > 0 ? 1 : -1, l));
  const passo = (v: number, d: number, l: { min: number; max: number }) => Math.max(l.min, Math.min(l.max, v + d));

  const confirmarApagar = (t: Treino) =>
    Alert.alert('Apagar treino?', t.nome, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => void apagar(t.id) },
    ]);

  const campos: [string, string | number, (d: number) => void][] = [
    ['Bolas por série', bolas, (d) => setBolas(passo(bolas, d * LIMITES.bolasPorSerie.passo, LIMITES.bolasPorSerie))],
    ['Séries', series, (d) => setSeries(passo(series, d, LIMITES.series))],
    ['Descanso', `${descanso} s`, (d) => setDescanso(passo(descanso, d * LIMITES.descansoS.passo, LIMITES.descansoS))],
    ['Lançador', `${pct(lancador)}%`, (d) => setLancador(mudarPct(lancador, d, LIMITES.lancadorPct))],
    ['Alimentador', `${pct(alimentador)}%`, (d) => setAlimentador(mudarPct(alimentador, d, LIMITES.alimentadorPct))],
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.fundo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: topo + 10, gap: 10, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Titulo estilo={{ marginBottom: 6 }}>Treinos</Titulo>
        <Rotulo>Prontos</Rotulo>
        {TREINOS_PRONTOS.map((t) => <ItemTreino key={t.id} t={t} />)}
        {criados.length > 0 && <Rotulo>Seus treinos</Rotulo>}
        {criados.map((t) => <ItemTreino key={t.id} t={t} aoSegurar={() => confirmarApagar(t)} />)}
        {criados.length > 0 && <Texto tamanho={13} cor={c.textoFraco} estilo={{ marginLeft: 4 }}>Segure um treino seu para apagá-lo.</Texto>}

        <Rotulo>Novo treino</Rotulo>
        <Cartao estilo={{ gap: 4, padding: 0, paddingTop: 16 }}>
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Backhand cruzado" />
          </View>
          {campos.map(([rotulo, valor, mudar], i) => (
            <View key={rotulo}>
              {i === 3 && <Divisor />}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 }}>
                <Texto tamanho={16} peso="medio">{rotulo}</Texto>
                <Passo rotulo={rotulo} valor={valor} aoMenos={() => mudar(-1)} aoMais={() => mudar(1)} />
              </View>
            </View>
          ))}
          <Texto tamanho={13} cor={c.textoSuave} estilo={{ paddingHorizontal: 16, paddingTop: 4 }}>
            Lançador mais rápido = bola mais forte. Alimentador mais rápido = menos tempo entre bolas. Teste aos poucos, com a área livre.
          </Texto>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, padding: 12, paddingLeft: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bordaForte }}>
            <View>
              <Numero tamanho={22}>{bolas * series} bolas</Numero>
              <Texto tamanho={13} cor={c.textoSuave}>cerca de {duracaoEstimadaMin(novo, msPorBola)} min</Texto>
            </View>
            <Botao
              titulo="Salvar"
              altura={48}
              tamanhoTexto={17}
              desabilitado={!novo.nome}
              haptico="sucesso"
              estilo={{ minWidth: 120 }}
              aoTocar={async () => {
                await salvar({ ...novo, id: `t-${Date.now().toString(36)}` });
                setNome('');
              }}
            />
          </View>
        </Cartao>
      </ScrollView>
      <FaixaStatus />
    </KeyboardAvoidingView>
  );
}
