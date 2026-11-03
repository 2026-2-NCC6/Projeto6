// Formulário de um treino, dentro do sheet de criar/editar. A velocidade é
// obrigatória: sem ela o botão de salvar fica travado e o treino não entra na
// sessão.

import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { msPorBolaCom } from '@/lancadora/contrato';
import { duracaoEstimadaMin, ehLivre, LIMITES, NOME_MAX, novoIdTreino, passoNumero, validarTreino } from '@/dominio/treinos';
import type { PresetVelocidade, Treino, Velocidade } from '@/dominio/tipos';
import { Campo } from '@/telas/FormPerfil';
import { SeletorVelocidade } from '@/telas/SeletorVelocidade';
import { Botao, BotaoIcone, Cartao, Divisor, Numero, Passo, Rotulo, Tela, Texto, Titulo } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { haptico } from '@/ui/movimento';
import { useTema } from '@/ui/tema';

const NOVO: Treino = { id: 'novo', nome: '', bolasPorSerie: 15, series: 4, descansoS: 40, padrao: false };

// A mesma forma para comparar o rascunho com o original, independente da
// ordem das chaves ou do preset escolhido.
function retrato(t: Treino): string {
  return JSON.stringify({
    nome: t.nome.trim(),
    bolas: t.bolasPorSerie,
    series: t.series,
    descanso: t.descansoS,
    velocidade: t.velocidade ? [t.velocidade.lancador, t.velocidade.alimentador] : null,
  });
}

function pendencias(erros: ReturnType<typeof validarTreino>): string {
  const nomes: Record<string, string> = { nome: 'nome', bolas: 'bolas por série', series: 'séries', descanso: 'descanso', velocidade: 'velocidade' };
  const faltam = Object.keys(erros).map((k) => nomes[k] ?? k);
  return faltam.length ? `Falta: ${faltam.join(' e ')}.` : '';
}

export function FormTreino({
  inicial,
  calibracao,
  aoSalvar,
  aoCancelar,
  aoApagar,
  aoRestaurar,
}: {
  inicial?: Treino;
  calibracao: { msPorBola: number; alimentadorCalib: number };
  aoSalvar(t: Treino): Promise<void>;
  aoCancelar(): void;
  aoApagar?: () => void;
  aoRestaurar?: () => void;
}) {
  const { c } = useTema();
  const [draft, setDraft] = useState<Treino>(() => (inicial ? { ...inicial } : { ...NOVO }));
  const [tocado, setTocado] = useState<Record<string, boolean>>({});
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const original = inicial ?? NOVO;
  const sujo = retrato(draft) !== retrato(original);
  const livre = ehLivre(draft);
  const erros = validarTreino(draft);
  const valido = Object.keys(erros).length === 0;
  const msDoTreino = draft.velocidade
    ? msPorBolaCom(calibracao, draft.velocidade.alimentador)
    : calibracao.msPorBola;
  const totalBolas = livre ? 0 : draft.bolasPorSerie * draft.series;

  const mudar = (p: Partial<Treino>) => {
    setErroSalvar(null);
    setDraft((d) => ({ ...d, ...p }));
  };

  const sair = () => {
    if (!sujo) return aoCancelar();
    Alert.alert('Descartar alterações?', 'As mudanças neste treino não foram salvas.', [
      { text: 'Ficar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: aoCancelar },
    ]);
  };

  // O botão voltar do Android também descarta: passe pelo mesmo aviso.
  const sairRef = useRef(sair);
  useEffect(() => {
    sairRef.current = sair;
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      sairRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const salvar = async () => {
    setTentou(true);
    if (!valido) {
      haptico.erro();
      return;
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      const t: Treino = {
        ...draft,
        id: inicial?.id ?? novoIdTreino(),
        nome: draft.nome.trim(),
        padrao: inicial?.padrao ?? false,
        ...(inicial?.padrao ? { personalizado: true } : {}),
      };
      await aoSalvar(t);
      haptico.sucesso();
    } catch (e) {
      haptico.erro();
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar o treino.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarApagar = () => {
    if (!aoApagar) return;
    Alert.alert('Apagar treino?', `“${draft.nome.trim() || 'Treino'}” sai deste celular. O histórico dele continua no seu perfil.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: aoApagar },
    ]);
  };

  const confirmarRestaurar = () => {
    if (!aoRestaurar) return;
    Alert.alert('Restaurar o padrão?', 'As edições neste treino são descartadas. A velocidade volta a ser definida na próxima sessão.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restaurar', style: 'destructive', onPress: aoRestaurar },
    ]);
  };

  const passo = (campo: 'bolasPorSerie' | 'series' | 'descansoS', direcao: 1 | -1) => {
    const l = campo === 'bolasPorSerie' ? LIMITES.bolasPorSerie : campo === 'series' ? LIMITES.series : LIMITES.descansoS;
    const valor = passoNumero(draft[campo], direcao * l.passo, l);
    if (campo === 'bolasPorSerie') mudar({ bolasPorSerie: valor });
    else if (campo === 'series') mudar({ series: valor });
    else mudar({ descansoS: valor });
    haptico.selecao();
  };

  const aplicarVelocidade = (v: Velocidade, preset: PresetVelocidade) => {
    mudar({ velocidade: v, preset });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.fundo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Tela>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BotaoIcone rotulo="Cancelar" aoTocar={sair}>
            <Icone.Fechar cor={c.texto} tamanho={18} />
          </BotaoIcone>
          <View style={{ flex: 1 }}>
            <Titulo tamanho={24} linhas={1}>{inicial ? 'Editar treino' : 'Novo treino'}</Titulo>
            <Texto tamanho={13} cor={c.textoSuave} linhas={1}>
              {inicial?.padrao ? 'Treino que veio com o app' : livre ? 'Livre · até “desliga”' : `${draft.series} séries · ${draft.descansoS} s de descanso`}
            </Texto>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1, marginHorizontal: -20 }}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={{ gap: 6 }}>
            <Rotulo>Nome</Rotulo>
            <Campo
              rotulo="Nome do treino"
              value={draft.nome}
              onChangeText={(nome) => mudar({ nome })}
              onBlur={() => setTocado((t) => ({ ...t, nome: true }))}
              placeholder="Backhand cruzado"
              maxLength={NOME_MAX}
              returnKeyType="done"
              autoFocus={!inicial}
            />
            {erros.nome && (tocado.nome || tentou) ? <Texto tamanho={13} cor={c.perigoTexto}>{erros.nome}</Texto> : null}
          </View>

          <Rotulo>Ritmo</Rotulo>
          {livre ? (
            <Cartao estilo={{ gap: 6, flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.sutil, alignItems: 'center', justifyContent: 'center' }}>
                <Icone.Infinito cor={c.texto} tamanho={22} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Texto tamanho={16} peso="negrito">Sem número de bolas</Texto>
                <Texto tamanho={13} cor={c.textoSuave}>A lançadora dispara até você dizer “desliga”. Não tem séries nem descanso.</Texto>
              </View>
            </Cartao>
          ) : (
            <Cartao estilo={{ padding: 0, paddingVertical: 4 }}>
              {(
                [
                  ['Bolas por série', 'bolasPorSerie', 'quantas bolas em cada série', `${draft.bolasPorSerie}`],
                  ['Séries', 'series', 'quantas séries o treino tem', `${draft.series}`],
                  ['Descanso', 'descansoS', 'entre uma série e a próxima', `${draft.descansoS} s`],
                ] as const
              ).map(([rotulo, campo, sub, valor], i) => (
                <View key={campo}>
                  {i > 0 && <Divisor />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 7 }}>
                    <View style={{ flex: 1 }}>
                      <Texto tamanho={16} peso="medio">{rotulo}</Texto>
                      <Texto tamanho={12} cor={c.textoSuave}>{sub}</Texto>
                    </View>
                    <Passo
                      rotulo={rotulo.toLowerCase()}
                      valor={valor}
                      aoMenos={() => passo(campo, -1)}
                      aoMais={() => passo(campo, 1)}
                    />
                  </View>
                </View>
              ))}
            </Cartao>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            <Rotulo>Velocidade dos motores</Rotulo>
            <Texto tamanho={12} peso="semi" cor={c.textoSuave} estilo={{ marginTop: 6 }}>obrigatória</Texto>
          </View>
          <SeletorVelocidade valor={draft.velocidade} aoMudar={aplicarVelocidade} msPorBola={msDoTreino} />

          <Cartao estilo={{ gap: 6, marginTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                {livre ? (
                  <View style={{ height: 34, justifyContent: 'center' }}>
                    <Icone.Infinito cor={c.texto} tamanho={26} />
                  </View>
                ) : (
                  <Numero tamanho={28}>{totalBolas}</Numero>
                )}
                <Texto tamanho={12} cor={c.textoSuave}>{livre ? 'sem contagem' : 'bolas no treino'}</Texto>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Numero tamanho={20} cor={c.texto}>{livre ? '—' : `~${duracaoEstimadaMin(draft, msDoTreino)} min`}</Numero>
                <Texto tamanho={12} cor={c.textoSuave}>estimados</Texto>
              </View>
            </View>
            {!draft.velocidade && (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: c.begeSuave, borderRadius: 12, padding: 10 }}>
                <Icone.Alerta cor={c.begeTexto} tamanho={16} />
                <Texto tamanho={12} cor={c.begeTexto} estilo={{ flex: 1 }}>
                  Escolha Forte, Médio ou Fraco (ou personalize) para liberar o treino.
                </Texto>
              </View>
            )}
          </Cartao>

          {(aoApagar || aoRestaurar) && (
            <>
              <Rotulo>Ações</Rotulo>
              <View style={{ gap: 8 }}>
                {aoRestaurar && (
                  <Botao titulo="Restaurar o padrão" variante="contorno" altura={48} tamanhoTexto={16} icone={<Icone.Repetir cor={c.texto} tamanho={18} />} aoTocar={confirmarRestaurar} />
                )}
                {aoApagar && (
                  <Botao titulo="Apagar treino" variante="perigo" altura={48} tamanhoTexto={16} icone={<Icone.Lixeira cor="#FFFFFF" tamanho={18} />} aoTocar={confirmarApagar} />
                )}
              </View>
            </>
          )}

          {erroSalvar && <Texto tamanho={13} peso="semi" cor={c.perigoTexto}>{erroSalvar}</Texto>}
        </ScrollView>

        <View style={{ gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.borda }}>
          {!valido && <Texto tamanho={12} cor={c.textoSuave} estilo={{ textAlign: 'center' }}>{pendencias(erros)}</Texto>}
          <Botao
            titulo={inicial ? 'Salvar alterações' : 'Criar treino'}
            altura={54}
            tamanhoTexto={17}
            desabilitado={!valido}
            carregando={salvando}
            aoTocar={() => void salvar()}
          />
        </View>
      </Tela>
    </KeyboardAvoidingView>
  );
}
