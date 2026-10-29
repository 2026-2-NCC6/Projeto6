import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { bleManager } from '@/lancadora/ble';
import { pedirPermissaoBluetooth, temPermissaoBluetooth } from '@/lancadora/conectar';
import { WIFI_HOST } from '@/lancadora/contrato';
import { Rodape, TopoOnboarding } from '@/telas/onboarding/Tutorial';
import { Divisor, Grupo, Negrito, Tela, Texto, Titulo, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { haptico } from '@/ui/movimento';
import { useTema } from '@/ui/tema';
import { reconhecedor } from '@/voz/reconhecedor';

type Item = { id: string; icone: (cor: string) => ReactNode; titulo: string; descricao: string; pedir: () => Promise<boolean>; jaTem?: () => Promise<boolean> };

const ITENS: Item[] = [
  { id: 'MIC', icone: (cor) => <Icone.Microfone cor={cor} tamanho={22} />, titulo: 'Microfone e fala', descricao: 'Para ouvir a palavra de ativação e transformar a voz em texto', pedir: () => reconhecedor.pedirPermissao(), jaTem: () => reconhecedor.temPermissao() },
  {
    id: 'BT',
    icone: (cor) => <Icone.Bluetooth cor={cor} tamanho={22} />,
    titulo: 'Bluetooth',
    descricao: 'Para conectar à lançadora sem trocar de Wi-Fi',
    jaTem: temPermissaoBluetooth,
    pedir: async () => {
      if (Platform.OS === 'android') return pedirPermissaoBluetooth();
      return (await bleManager().state()) !== 'Unauthorized';
    },
  },
  ...(Platform.OS === 'ios'
    ? [
        {
          id: 'REDE',
          icone: (cor: string) => <Icone.Wifi cor={cor} tamanho={22} />,
          titulo: 'Rede local',
          descricao: 'Para falar com a lançadora pelo Wi-Fi dela',
          // O iOS só mostra o pedido na primeira tentativa de acesso à rede local.
          pedir: async () => {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), 1500);
            await fetch(`${WIFI_HOST}/status`, { signal: ctrl.signal }).catch(() => undefined);
            return true;
          },
        },
      ]
    : []),
];

export default function OnboardingPermissoes() {
  const { c } = useTema();
  const [ok, setOk] = useState<Record<string, boolean | undefined>>({});

  // O microfone costuma já ter sido liberado no teste ao vivo da palavra.
  useEffect(() => {
    for (const it of ITENS) {
      it.jaTem?.().then((sim) => sim && setOk((o) => ({ ...o, [it.id]: true })), () => undefined);
    }
  }, []);

  return (
    <Tela>
      <TopoOnboarding passo={6} />
      <View style={{ gap: 6 }}>
        <Titulo>O que o app precisa</Titulo>
        <Texto cor={c.textoSuave}>Cada permissão abre a janela do sistema. Você pode mudar depois nos Ajustes do celular.</Texto>
      </View>
      <Grupo>
        {ITENS.map((it, i) => {
          const estado = ok[it.id];
          return (
            <View key={it.id}>
              {i > 0 && <Divisor />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: estado ? c.limao : c.sutil, alignItems: 'center', justifyContent: 'center' }}>
                  {it.icone(estado ? c.limaoTinta : c.texto)}
                </View>
                <View style={{ flex: 1 }}>
                  <Texto tamanho={16} peso="negrito">{it.titulo}</Texto>
                  <Texto tamanho={13} cor={c.textoSuave}>{it.descricao}</Texto>
                </View>
                {estado ? (
                  <View accessibilityLabel={`${it.titulo}: ativo`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 34, borderRadius: 17, backgroundColor: c.limaoSuave }}>
                    <Icone.Check cor={c.destaque} tamanho={14} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: c.destaque }}>Ativo</Text>
                  </View>
                ) : (
                  <Toque
                    accessibilityRole="button"
                    accessibilityLabel={`Permitir ${it.titulo}`}
                    onPress={async () => {
                      const concedida = await it.pedir().catch(() => false);
                      if (concedida) haptico.sucesso();
                      setOk((o) => ({ ...o, [it.id]: concedida }));
                    }}
                    estilo={{ minWidth: 84, height: 38, paddingHorizontal: 12, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: estado === false ? c.perigoSuave : c.quadra }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: estado === false ? c.perigoTexto : c.quadraTexto }}>{estado === false ? 'Negado' : 'Permitir'}</Text>
                  </Toque>
                )}
              </View>
            </View>
          );
        })}
      </Grupo>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4 }}>
        <Icone.Escudo cor={c.textoSuave} tamanho={18} />
        <Texto tamanho={13} cor={c.textoSuave} estilo={{ flex: 1 }}>
          O áudio é processado pelo reconhecedor do próprio sistema (Google ou Apple) e <Negrito>nunca é gravado</Negrito> pelo NockHug.
        </Texto>
      </View>
      <Rodape aoTocar={() => router.push('/onboarding/conectar')} />
    </Tela>
  );
}
