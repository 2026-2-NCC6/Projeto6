// Configurações (PRD §9.7).

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { router, type Href } from 'expo-router';
import * as Sharing from 'expo-sharing';
import type { ReactNode } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { repositorio } from '@/dados/repositorio';
import { apagarToken } from '@/dados/segredos';
import { dutyDe, LIMITES, passoPct, pct } from '@/dominio/treinos';
import { useApp } from '@/estado/app';
import { carregarRascunho } from '@/estado/onboarding';
import { useLancadora } from '@/lancadora/cliente';
import { Avatar, Cabecalho, Divisor, Grupo, Interruptor, Passo, Rotulo, Segmentos, Tela, Texto, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { fontes, type PreferenciaTema, useTema } from '@/ui/tema';

const NIVEL = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };

function Linha({ titulo, sub, valor, para, aoTocar, perigo, icone }: { titulo: string; sub?: string; valor?: ReactNode; para?: Href; aoTocar?: () => void; perigo?: boolean; icone?: ReactNode }) {
  const { c } = useTema();
  const tocar = aoTocar ?? (para ? () => router.push(para) : undefined);
  return (
    <Toque
      accessibilityRole={tocar ? 'button' : undefined}
      disabled={!tocar}
      onPress={tocar}
      escala={0.99}
      estilo={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8 }}
    >
      {icone}
      <View style={{ flex: 1 }}>
        <Texto tamanho={16} peso="medio" cor={perigo ? c.perigoTexto : c.texto}>{titulo}</Texto>
        {sub && <Texto tamanho={13} cor={c.textoSuave}>{sub}</Texto>}
      </View>
      {valor}
      {para && <Icone.Avancar cor={c.textoFraco} tamanho={16} />}
    </Toque>
  );
}

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return (
    <View style={{ backgroundColor: fundo, borderRadius: 12, paddingHorizontal: 9, height: 24, justifyContent: 'center' }}>
      <Texto tamanho={12} peso="negrito" cor={cor}>{texto}</Texto>
    </View>
  );
}

export default function Configuracoes() {
  const { c } = useTema();
  const { perfil, config, atualizarConfig, apagarTudo } = useApp();
  const { conexao, alvo, desconectar, fw, calibrado, msPorBola } = useLancadora(
    useShallow((s) => ({ conexao: s.conexao, alvo: s.alvo, desconectar: s.desconectar, fw: s.status?.fw, calibrado: s.status?.calibrado, msPorBola: s.status?.msPorBola })),
  );

  const exportar = async () => {
    const arquivo = new FileSystem.File(FileSystem.Paths.cache, `nockhug-historico-${Date.now()}.json`);
    await arquivo.write(await repositorio.exportar());
    await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/json', dialogTitle: 'Exportar histórico' });
  };

  const apagar = () =>
    Alert.alert('Apagar todos os dados?', 'Perfil, histórico, treinos e conquistas saem deste celular. Não dá para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar tudo',
        style: 'destructive',
        onPress: async () => {
          await desconectar();
          await apagarToken();
          await apagarTudo();
          router.replace('/onboarding');
        },
      },
    ]);

  const nomeLancadora = config.modoDemonstracao ? 'Lançadora simulada' : config.transportePadrao === 'ble' ? (config.dispositivoBle?.nome ?? 'Bluetooth') : 'NockHug (Wi-Fi)';
  const conectada = conexao === 'conectada';
  const IconeLancadora = config.modoDemonstracao ? Icone.Simulada : config.transportePadrao === 'ble' ? Icone.Bluetooth : Icone.Wifi;
  const iconeLinha = (n: ReactNode, fundo = c.sutil) => <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: fundo, alignItems: 'center', justifyContent: 'center' }}>{n}</View>;

  return (
    <Tela>
      <Cabecalho titulo="Configurações" />
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Toque
          accessibilityRole="button"
          accessibilityLabel="Editar perfil"
          onPress={() => {
            carregarRascunho();
            router.push('/perfil');
          }}
          estilo={{ backgroundColor: c.cartao, borderWidth: c.sombra ? 0 : 1, borderColor: c.borda, boxShadow: c.sombra, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <Avatar fotoUri={perfil?.fotoUri} iniciais={`${perfil?.nome[0] ?? ''}${perfil?.sobrenome[0] ?? ''}`.toUpperCase()} tamanho={56} />
          <View style={{ flex: 1 }}>
            <Texto tamanho={17} peso="negrito">{perfil ? `${perfil.nome} ${perfil.sobrenome}` : ''}</Texto>
            <Texto tamanho={13} cor={c.textoSuave}>{perfil ? `${perfil.idade} anos · ${NIVEL[perfil.nivel]} · ${perfil.mao === 'destro' ? 'Destro' : 'Canhoto'} · meta ${perfil.metaSemanal} dias` : ''}</Texto>
          </View>
          <Icone.Avancar cor={c.textoFraco} />
        </Toque>

        <Rotulo>Voz</Rotulo>
        <Grupo>
          <Linha
            titulo="Palavra de ativação"
            para="/palavra"
            icone={iconeLinha(<Icone.Microfone cor={c.texto} tamanho={18} />)}
            valor={<Texto tamanho={18} cor={c.destaque} estilo={{ fontFamily: fontes.titulo, letterSpacing: -0.4 }}>{config.palavraAtivacao}</Texto>}
          />
          <Divisor />
          <Interruptor rotulo="Retorno falado" sub="O app confirma cada comando em voz alta" ligado={config.retornoFalado} aoTrocar={() => void atualizarConfig({ retornoFalado: !config.retornoFalado })} />
          <Divisor />
          <Linha titulo="Reconhecimento" sub="Nuvem com internet, no aparelho sem ela" valor={<Texto tamanho={14} cor={c.textoSuave}>pt-BR</Texto>} />
        </Grupo>

        <Rotulo>Lançadora</Rotulo>
        <Grupo>
          <Linha
            titulo={nomeLancadora}
            sub={`${config.modoDemonstracao ? 'Sem motores' : config.transportePadrao === 'ble' ? 'Bluetooth' : 'Wi-Fi'}${fw ? ` · firmware ${fw}` : ''}`}
            para="/lancadora"
            icone={iconeLinha(<IconeLancadora cor={conectada ? c.limaoTinta : c.texto} tamanho={18} />, conectada ? c.limao : c.sutil)}
            valor={conectada ? <Selo texto="Conectada" fundo={c.limaoSuave} cor={c.destaque} /> : <Selo texto="Desconectada" fundo={c.sutil} cor={c.textoSuave} />}
          />
          {(
            [
              ['lancador', 'Lançador', LIMITES.lancadorPct],
              ['alimentador', 'Alimentador', LIMITES.alimentadorPct],
            ] as const
          ).map(([motor, rotulo, limite]) => {
            const duty = config.velocidadePadrao[motor];
            const mudar = (d: 1 | -1) => void atualizarConfig({ velocidadePadrao: { ...config.velocidadePadrao, [motor]: dutyDe(passoPct(pct(duty), d, limite)) } });
            return (
              <View key={motor}>
                <Divisor />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingHorizontal: 16, paddingVertical: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Texto tamanho={16} peso="medio">{rotulo}</Texto>
                    <Texto tamanho={13} cor={c.textoSuave}>Velocidade padrão dos treinos</Texto>
                  </View>
                  <Passo rotulo={`velocidade do ${rotulo.toLowerCase()}`} valor={`${pct(duty)}%`} aoMenos={() => mudar(-1)} aoMais={() => mudar(1)} />
                </View>
              </View>
            );
          })}
          <Divisor />
          <Linha
            titulo="Calibrar segundos por bola"
            para="/calibracao"
            valor={
              calibrado && msPorBola ? (
                <Texto tamanho={14} cor={c.textoSuave} estilo={{ fontVariant: ['tabular-nums'] }}>{(msPorBola / 1000).toLocaleString('pt-BR')} s</Texto>
              ) : (
                <Selo texto={fw ? 'não calibrado' : 'conecte para ver'} fundo={c.begeSuave} cor={c.begeTexto} />
              )
            }
          />
        </Grupo>

        <Rotulo>Aparência</Rotulo>
        <Grupo>
          <View style={{ padding: 12, gap: 10 }}>
            <Segmentos<PreferenciaTema>
              opcoes={[['sistema', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']]}
              valor={config.tema}
              aoMudar={(tema) => void atualizarConfig({ tema })}
              altura={38}
            />
            <Texto tamanho={13} cor={c.textoSuave} estilo={{ paddingHorizontal: 4 }}>Automático acompanha o tema do celular. Sob sol forte, o claro tem mais contraste.</Texto>
          </View>
        </Grupo>

        <Rotulo>Dados</Rotulo>
        <Grupo>
          <Linha titulo="Exportar histórico (JSON)" icone={iconeLinha(<Icone.Exportar cor={c.texto} tamanho={18} />)} aoTocar={() => void exportar()} />
          <Divisor />
          <Linha perigo titulo="Apagar todos os dados" icone={iconeLinha(<Icone.Lixeira cor={c.perigoTexto} tamanho={18} />, c.perigoSuave)} aoTocar={apagar} />
        </Grupo>
        <Texto tamanho={12} cor={c.textoFraco} estilo={{ textAlign: 'center', marginTop: 12 }}>
          NockHug {Constants.expoConfig?.version ?? '1.0.0'} · Smart Tennis Arena · FECAP 2026{alvo?.simulado ? ' · modo demonstração' : ''}
        </Texto>
      </ScrollView>
    </Tela>
  );
}
