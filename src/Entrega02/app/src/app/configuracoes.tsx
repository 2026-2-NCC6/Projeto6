// Configurações (PRD §9.7).
//
// A velocidade dos motores saiu daqui: ela é definida no treino (Forte, Médio,
// Fraco ou Personalizado) e fica gravada nele. Aqui ficam a voz, o
// comportamento da sessão, a lançadora e a aparência.

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { router, type Href } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { entrarPlataforma, lerContaPlataforma, sairPlataforma, urlPlataforma } from '@/dados/plataforma';
import { repositorio } from '@/dados/repositorio';
import { apagarToken } from '@/dados/segredos';
import { useApp } from '@/estado/app';
import { carregarRascunho } from '@/estado/onboarding';
import { useLancadora } from '@/lancadora/cliente';
import { Campo } from '@/telas/FormPerfil';
import { Avatar, Botao, Cabecalho, Divisor, Grupo, Interruptor, Rotulo, Segmentos, Tela, Texto, Toque } from '@/ui/componentes';
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
    <View style={{ backgroundColor: fundo, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, minHeight: 24, justifyContent: 'center' }}>
      <Texto tamanho={12} peso="negrito" cor={cor} max={1.3} linhas={1}>{texto}</Texto>
    </View>
  );
}

export default function Configuracoes() {
  const { c } = useTema();
  const { perfil, config, atualizarConfig, apagarTudo, sincronizacao, sincronizar } = useApp();
  const [emailPlataforma, setEmailPlataforma] = useState('');
  const [senhaPlataforma, setSenhaPlataforma] = useState('');
  const [contaPlataforma, setContaPlataforma] = useState<string | null>(null);
  const [erroPlataforma, setErroPlataforma] = useState('');
  const [ocupadoPlataforma, setOcupadoPlataforma] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const travaPlataforma = useRef(false);
  const travaSync = useRef(false);

  useEffect(() => {
    void lerContaPlataforma().then((conta) => setContaPlataforma(conta?.email ?? null));
  }, []);

  const entrarNaPlataforma = async () => {
    if (travaPlataforma.current) return;
    travaPlataforma.current = true;
    setOcupadoPlataforma(true);
    setErroPlataforma('');
    try {
      const resultado = await entrarPlataforma(emailPlataforma.trim(), senhaPlataforma);
      if (!resultado.ok) setErroPlataforma(resultado.mensagem);
      else {
        const conta = await lerContaPlataforma();
        setContaPlataforma(conta?.email ?? emailPlataforma.trim());
        setSenhaPlataforma('');
      }
    } finally {
      travaPlataforma.current = false;
      setOcupadoPlataforma(false);
    }
  };

  const sairDaPlataforma = async () => {
    await sairPlataforma();
    setContaPlataforma(null);
  };

  const sincronizarAgora = async () => {
    if (travaSync.current) return;
    travaSync.current = true;
    setSincronizando(true);
    try {
      await sincronizar();
    } finally {
      travaSync.current = false;
      setSincronizando(false);
    }
  };
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
            sub="Diga a palavra e depois o comando"
            para="/palavra"
            icone={iconeLinha(<Icone.Microfone cor={c.texto} tamanho={18} />)}
            valor={<Texto tamanho={18} cor={c.destaque} estilo={{ fontFamily: fontes.titulo, letterSpacing: -0.4 }}>{config.palavraAtivacao}</Texto>}
          />
          <Divisor />
          <Interruptor rotulo="Retorno falado" sub="O app confirma cada comando em voz alta" ligado={config.retornoFalado} aoTrocar={() => void atualizarConfig({ retornoFalado: !config.retornoFalado })} />
          <Divisor />
          <Interruptor
            rotulo="Toque de ativação"
            sub="Um toque curto quando o app ouve a palavra. Os 5 bips antes de os motores ligarem tocam sempre."
            ligado={config.bips}
            aoTrocar={() => void atualizarConfig({ bips: !config.bips })}
          />
          <Divisor />
          <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            <Texto tamanho={16} peso="medio">Reconhecimento</Texto>
            <Segmentos
              opcoes={[['auto', 'Automático'], ['aparelho', 'No aparelho']]}
              valor={config.reconhecimento}
              aoMudar={(reconhecimento) => void atualizarConfig({ reconhecimento })}
              altura={38}
            />
            <Texto tamanho={12} cor={c.textoSuave}>
              Automático usa a nuvem com internet e o reconhecimento do aparelho sem ela. “No aparelho” não envia áudio para fora e funciona offline.
            </Texto>
          </View>
          <Divisor />
          <Linha
            titulo="Testar microfone"
            sub="Veja o que o app ouve e qual comando entende"
            para="/microfone"
            icone={iconeLinha(<Icone.Som cor={c.texto} tamanho={18} />)}
          />
          <Divisor />
          <Interruptor
            rotulo="Escuta com a tela apagada"
            sub="Continua ouvindo com o celular no bolso. No Android aparece a notificação “NockHug está ouvindo” enquanto a sessão estiver aberta. Com fone, o microfone dele é usado."
            ligado={config.escutaTelaBloqueada}
            aoTrocar={() => void atualizarConfig({ escutaTelaBloqueada: !config.escutaTelaBloqueada })}
          />
        </Grupo>

        <Rotulo>Sessão</Rotulo>
        <Grupo>
          <Interruptor
            rotulo="Retomar sozinho no fim do descanso"
            sub="Depois de 5 bips, os motores ligam sozinhos. Diga “Nock, desliga” ou “Nock, para” para cancelar."
            ligado={config.retomarSozinho}
            aoTrocar={() => void atualizarConfig({ retomarSozinho: !config.retomarSozinho })}
          />
          <Divisor />
          <Interruptor
            rotulo="Manter a tela acesa"
            sub="Desligue para treinar com o celular no bolso e a tela apagada."
            ligado={config.manterTelaAcesa}
            aoTrocar={() => void atualizarConfig({ manterTelaAcesa: !config.manterTelaAcesa })}
          />
          <Divisor />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12 }}>
            <Icone.Escudo cor={c.begeTexto} tamanho={18} />
            <Texto tamanho={12} cor={c.begeTexto} estilo={{ flex: 1 }}>
              O descanso e a retomada não substituem o checklist: a lançadora só liga depois que você arma a sessão. O “Para!” sozinho continua sendo parada de emergência, a qualquer momento.
            </Texto>
          </View>
        </Grupo>

        <Rotulo>Lançadora</Rotulo>
        <Grupo>
          <Linha
            titulo={nomeLancadora}
            sub={`${config.modoDemonstracao ? 'Sem motores' : config.transportePadrao === 'ble' ? 'Bluetooth' : 'Wi-Fi'}${fw ? ` · firmware ${fw}` : ''} · diagnóstico e reparo`}
            para="/lancadora"
            icone={iconeLinha(<IconeLancadora cor={conectada ? c.limaoTinta : c.texto} tamanho={18} />, conectada ? c.limao : c.sutil)}
            valor={conectada ? <Selo texto="Conectada" fundo={c.limaoSuave} cor={c.destaque} /> : <Selo texto="Desconectada" fundo={c.sutil} cor={c.textoSuave} />}
          />
          <Divisor />
          <Linha
            titulo="Calibrar segundos por bola"
            sub="Meça uma vez com a velocidade que você usa"
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

        <Rotulo>Plataforma</Rotulo>
        <Grupo>
          {contaPlataforma ? (
            <Linha titulo={contaPlataforma} sub="Conta da plataforma" aoTocar={() => void sairDaPlataforma()} valor={<Texto tamanho={14}>Sair</Texto>} />
          ) : (
            <View style={{ padding: 16, gap: 10 }}>
              <Campo rotulo="E-mail da plataforma" value={emailPlataforma} onChangeText={setEmailPlataforma} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
              <Campo rotulo="Senha da plataforma" value={senhaPlataforma} onChangeText={setSenhaPlataforma} secureTextEntry autoCapitalize="none" />
              {erroPlataforma ? <Texto tamanho={13} cor={c.perigoTexto}>{erroPlataforma}</Texto> : null}
              <Botao titulo={ocupadoPlataforma ? 'Salvando...' : 'Entrar'} desabilitado={ocupadoPlataforma} altura={48} tamanhoTexto={16} aoTocar={() => void entrarNaPlataforma()} />
            </View>
          )}
          <Divisor />
          <Linha
            titulo={sincronizando ? 'Sincronizando...' : 'Sincronizar agora'}
            sub={urlPlataforma() ? (sincronizacao?.mensagem ?? 'Baixa treinos publicados e envia sessões quando houver internet.') : 'A plataforma está desligada neste aplicativo.'}
            aoTocar={() => void sincronizarAgora()}
          />
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
