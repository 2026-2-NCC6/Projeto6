// Conectar a lançadora: Wi-Fi, Bluetooth ou a lançadora simulada
// (onboarding passo 7 e Configurações › Lançadora).

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { lerToken, salvarToken } from '@/dados/segredos';
import { useApp } from '@/estado/app';
import { bleManager, type LancadoraEncontrada, procurarLancadoras } from '@/lancadora/ble';
import { useLancadora } from '@/lancadora/cliente';
import { conectarPadrao, pedirPermissaoBluetooth } from '@/lancadora/conectar';
import { WIFI_SSID } from '@/lancadora/contrato';
import { Botao, Cartao, Negrito, Numero, Segmentos, Texto, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { haptico } from '@/ui/movimento';
import { useTema } from '@/ui/tema';

type Aba = 'wifi' | 'ble' | 'demo';

function PassoWifi({ n, children }: { n: number; children: ReactNode }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.quadra, alignItems: 'center', justifyContent: 'center' }}>
        <Numero tamanho={15} cor={c.limao}>{n}</Numero>
      </View>
      <Texto tamanho={15} estilo={{ flex: 1, paddingTop: 2 }}>{children}</Texto>
    </View>
  );
}

function Sinal({ rssi }: { rssi: number | null }) {
  const { c } = useTema();
  const nivel = rssi == null ? 3 : rssi > -65 ? 3 : rssi > -80 ? 2 : 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 }} accessible={false}>
      {[1, 2, 3].map((i) => <View key={i} style={{ width: 4, height: 5 + i * 4, borderRadius: 2, backgroundColor: i <= nivel ? c.destaque : c.trilho }} />)}
    </View>
  );
}

export function ConectarLancadora({ aoConectar, rotulo = 'Conectar' }: { aoConectar: () => void; rotulo?: string }) {
  const { c } = useTema();
  const config = useApp((s) => s.config);
  const atualizarConfig = useApp((s) => s.atualizarConfig);
  const { erro, conexao, fw } = useLancadora(useShallow((s) => ({ erro: s.erro, conexao: s.conexao, fw: s.status?.fw })));
  const [aba, setAba] = useState<Aba>(config.modoDemonstracao ? 'demo' : config.transportePadrao);
  const [token, setToken] = useState('');
  const [foco, setFoco] = useState(false);
  const [encontradas, setEncontradas] = useState<LancadoraEncontrada[]>([]);
  const [escolhida, setEscolhida] = useState<LancadoraEncontrada | null>(config.dispositivoBle ? { ...config.dispositivoBle, rssi: null } : null);
  const [procurando, setProcurando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const pararBusca = useRef<(() => void) | null>(null);

  useEffect(() => {
    void lerToken().then((t) => t && setToken(t));
    return () => pararBusca.current?.();
  }, []);

  const procurar = async () => {
    setErroLocal(null);
    if (!(await pedirPermissaoBluetooth())) {
      setErroLocal('Permita o Bluetooth para procurar a lançadora.');
      return;
    }
    if ((await bleManager().state()) === 'PoweredOff') {
      setErroLocal('Ligue o Bluetooth do celular.');
      return;
    }
    setEncontradas([]);
    setBuscou(false);
    setProcurando(true);
    pararBusca.current?.();
    pararBusca.current = procurarLancadoras(
      (l) => setEncontradas((xs) => (xs.some((x) => x.id === l.id) ? xs.map((x) => (x.id === l.id ? l : x)) : [...xs, l])),
      (msg) => {
        setErroLocal(msg);
        setProcurando(false);
      },
    );
    setTimeout(() => {
      pararBusca.current?.();
      setProcurando(false);
      setBuscou(true);
    }, 10000);
  };

  const conectar = async () => {
    setErroLocal(null);
    pararBusca.current?.();
    if (aba === 'demo') {
      await atualizarConfig({ modoDemonstracao: true });
    } else {
      if (!token.trim()) {
        setErroLocal('Informe o token da lançadora.');
        return;
      }
      if (aba === 'ble' && !escolhida) {
        setErroLocal('Escolha a lançadora na lista.');
        return;
      }
      await salvarToken(token);
      await atualizarConfig({
        modoDemonstracao: false,
        transportePadrao: aba,
        ...(aba === 'ble' && escolhida ? { dispositivoBle: { id: escolhida.id, nome: escolhida.nome } } : {}),
      });
    }
    if (await conectarPadrao()) {
      haptico.sucesso();
      aoConectar();
    } else haptico.erro();
  };

  const mensagem = (erroLocal || erro) && conexao !== 'conectada' ? (erroLocal ?? erro) : null;

  return (
    <View style={{ gap: 16 }}>
      <Segmentos
        opcoes={[['wifi', 'Wi-Fi'], ['ble', 'Bluetooth'], ['demo', 'Simulada']]}
        valor={aba}
        altura={42}
        aoMudar={(id) => {
          setAba(id);
          setErroLocal(null);
          useLancadora.setState({ erro: null });
        }}
      />

      {aba === 'wifi' && (
        <Cartao estilo={{ gap: 14 }}>
          <PassoWifi n={1}>Nos Ajustes do celular, entre na rede <Negrito>{WIFI_SSID}</Negrito>.</PassoWifi>
          <PassoWifi n={2}>Volte aqui e toque em {rotulo}: o app procura a lançadora em <Negrito>192.168.4.1</Negrito>.</PassoWifi>
          <Texto tamanho={13} cor={c.textoSuave}>Deixe os dados móveis ligados: o reconhecimento de voz em nuvem usa a internet do celular.</Texto>
        </Cartao>
      )}

      {aba === 'ble' && (
        <View style={{ gap: 8 }}>
          <Botao
            titulo={procurando ? 'Procurando…' : 'Procurar lançadoras'}
            variante="contorno"
            altura={50}
            tamanhoTexto={16}
            carregando={procurando}
            icone={procurando ? undefined : <Icone.Bluetooth cor={c.texto} tamanho={18} />}
            aoTocar={procurar}
          />
          {encontradas.map((l) => {
            const sel = escolhida?.id === l.id;
            return (
              <Toque
                key={l.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                onPress={() => {
                  haptico.selecao();
                  setEscolhida(l);
                }}
                estilo={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1.5,
                  borderColor: sel ? c.limaoBorda : c.borda,
                  backgroundColor: sel ? c.limaoSuave : c.cartao,
                  transitionProperty: ['backgroundColor', 'borderColor'],
                  transitionDuration: 160,
                }}
              >
                <Icone.Bola tamanho={30} id={`ble-${l.id}`} />
                <View style={{ flex: 1 }}>
                  <Texto tamanho={16} peso="negrito">{l.nome}</Texto>
                  <Texto tamanho={13} cor={c.textoSuave}>{l.rssi == null ? 'Pareada' : l.rssi > -65 ? 'Sinal forte' : l.rssi > -80 ? 'Sinal médio' : 'Sinal fraco'}</Texto>
                </View>
                <Sinal rssi={l.rssi} />
                {sel && <Icone.Check cor={c.destaque} tamanho={18} />}
              </Toque>
            );
          })}
          {!procurando && encontradas.length === 0 && escolhida && <Texto tamanho={14} cor={c.textoSuave}>Pareada: {escolhida.nome}</Texto>}
          {buscou && encontradas.length === 0 && <Texto tamanho={14} cor={c.textoSuave}>Nenhuma lançadora por perto. Confira se o NockHug está ligado e a poucos metros.</Texto>}
        </View>
      )}

      {aba === 'demo' && (
        <Cartao estilo={{ gap: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.sutil, alignItems: 'center', justifyContent: 'center' }}>
            <Icone.Simulada cor={c.texto} tamanho={22} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Texto tamanho={16} peso="negrito">Lançadora simulada</Texto>
            <Texto tamanho={14} cor={c.textoSuave}>Uma lançadora de mentira dentro do app, com as mesmas regras do NockHug. Útil para conhecer o app ou demonstrar sem a máquina. Nenhum motor é acionado.</Texto>
          </View>
        </Cartao>
      )}

      {aba !== 'demo' && (
        <View style={{ gap: 6 }}>
          <Texto tamanho={13} peso="semi" cor={c.textoSuave}>Token da lançadora</Texto>
          <TextInput
            accessibilityLabel="Token da lançadora"
            value={token}
            onChangeText={setToken}
            onFocus={() => setFoco(true)}
            onBlur={() => setFoco(false)}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="nhg-…"
            placeholderTextColor={c.textoFraco}
            selectionColor={c.destaque}
            cursorColor={c.destaque}
            style={{ height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: foco ? c.destaque : c.borda, backgroundColor: c.cartao, paddingHorizontal: 14, fontSize: 17, fontWeight: '500', color: c.texto }}
          />
          <Texto tamanho={13} cor={c.textoSuave}>Está na etiqueta da lançadora. Fica guardado no cofre seguro do celular.</Texto>
        </View>
      )}

      {mensagem && (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: c.perigoSuave, borderRadius: 16, padding: 12 }}>
          <Icone.Alerta cor={c.perigoTexto} tamanho={20} />
          <Texto tamanho={14} peso="semi" cor={c.perigoTexto} estilo={{ flex: 1 }}>{mensagem}</Texto>
        </View>
      )}
      {conexao === 'conectada' && fw && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.limaoSuave, borderRadius: 16, padding: 12 }}>
          <Icone.Check cor={c.destaque} tamanho={18} />
          <Texto tamanho={14} peso="semi" cor={c.destaque}>Conectada · firmware {fw}</Texto>
        </View>
      )}

      <Botao titulo={rotulo} carregando={conexao === 'conectando'} aoTocar={conectar} />
    </View>
  );
}
