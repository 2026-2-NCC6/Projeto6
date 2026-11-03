// Diagnóstico da lançadora: o estado que o firmware reporta, por que o último
// comando foi recusado e o reparo (desliga, desarma e deixa em repouso).

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { lerToken } from '@/dados/segredos';
import { useLancadora } from '@/lancadora/cliente';
import type { FalhaLancadora } from '@/lancadora/falhas';
import { repararLancadora } from '@/lancadora/manutencao';
import { CartaoFalha } from '@/telas/CartaoFalha';
import { Botao, Cartao, Divisor, Texto, Titulo } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { useTema } from '@/ui/tema';

// O diagnóstico mostra o valor técnico, mas começa pela palavra que o
// praticante já viu nas outras telas.
const ESTADO_LEGIVEL: Record<string, string> = {
  REPOUSO: 'Em repouso',
  ARMADO: 'Armada',
  LANCANDO: 'Lançando',
  PAUSADO: 'Pausada',
  PARADA_SEGURA: 'Parada segura',
};

const MOTIVO_LEGIVEL: Record<string, string> = {
  checklist: 'checklist',
  desarmada: 'desarmada',
  ligar: 'comando ligar',
  desligar: 'comando desligar',
  pausar: 'comando pausar',
  retomar: 'comando retomar',
  emergencia: 'emergência',
  reiniciada: 'reiniciada',
  serie_concluida: 'série concluída',
  tempo_concluido: 'tempo concluído',
  conexao_perdida: 'conexão perdida',
};

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: string }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 7 }}>
      <Texto tamanho={13} cor={c.textoSuave} estilo={{ width: 112 }}>{rotulo}</Texto>
      <Texto tamanho={14} peso="medio" cor={destaque ?? c.texto} estilo={{ flex: 1, fontVariant: ['tabular-nums'] }}>{valor}</Texto>
    </View>
  );
}

export function DiagnosticoLancadora() {
  const { c } = useTema();
  const { status, conexao, alvo, ultimaLatenciaMs } = useLancadora();
  const [reparo, setReparo] = useState<string | null>(null);
  const [falha, setFalha] = useState<FalhaLancadora | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [token, setToken] = useState<boolean | null>(null);

  useEffect(() => {
    void lerToken()
      .then((t) => setToken(!!t))
      .catch(() => setToken(null));
  }, []);

  const reparar = async () => {
    setOcupado(true);
    setFalha(null);
    const r = await repararLancadora();
    setOcupado(false);
    setReparo(r.relato);
    if (!r.ok) setFalha(r.falha ?? null);
  };

  const estado = status?.estado;
  const transporte = alvo?.simulado ? 'Simulada (sem motores)' : alvo?.tipo === 'ble' ? 'Bluetooth' : 'Wi-Fi';
  const conectada = conexao === 'conectada';
  const corEstado = estado === 'PARADA_SEGURA' ? c.perigoTexto : estado === 'LANCANDO' ? c.destaque : estado === 'PAUSADO' ? c.begeTexto : c.texto;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <Icone.Engrenagem cor={c.textoSuave} tamanho={16} />
        <Titulo tamanho={19}>Diagnóstico</Titulo>
      </View>

      {!conectada ? (
        <Cartao estilo={{ gap: 6 }}>
          <Texto tamanho={15} peso="negrito">Conecte a lançadora para ver o diagnóstico</Texto>
          <Texto tamanho={13} cor={c.textoSuave}>Aqui aparecem o estado, o motivo da última recusa e o comando que o firmware respondeu.</Texto>
        </Cartao>
      ) : (
        <Cartao estilo={{ paddingVertical: 6 }}>
          <Linha rotulo="Conexão" valor={conexao} destaque={conectada ? c.destaque : c.perigoTexto} />
          <Divisor />
          <Linha rotulo="Transporte" valor={transporte} />
          <Divisor />
          <Linha rotulo="Estado" valor={estado ? `${ESTADO_LEGIVEL[estado] ?? estado} (${estado})` : 'sem status'} destaque={estado ? corEstado : c.textoSuave} />
          <Divisor />
          <Linha rotulo="Motivo" valor={status?.motivo ? `${MOTIVO_LEGIVEL[status.motivo] ?? status.motivo} (${status.motivo})` : '—'} />
          <Divisor />
          <Linha rotulo="Último comando" valor={status?.op ?? '—'} />
          <Divisor />
          <Linha rotulo="Resultado" valor={status?.resultado ?? '—'} />
          <Divisor />
          <Linha rotulo="Recusa" valor={status?.erro ?? '—'} destaque={status?.erro ? c.perigoTexto : c.textoSuave} />
          <Divisor />
          <Linha rotulo="Firmware" valor={status?.fw ?? '—'} />
          <Divisor />
          <Linha rotulo="Sequência" valor={status?.seq != null ? String(status.seq) : '—'} />
          <Divisor />
          <Linha rotulo="Latência" valor={ultimaLatenciaMs != null ? `${ultimaLatenciaMs} ms` : '—'} />
          <Divisor />
          <Linha rotulo="Token" valor={token == null ? 'verificando…' : token ? 'configurado' : 'não configurado'} destaque={token === false ? c.perigoTexto : undefined} />
        </Cartao>
      )}

      <Texto tamanho={13} cor={c.textoSuave}>
        Resetar zera os motores e deixa a lançadora em repouso, de qualquer estado em que ela tenha ficado presa (ligada, pausada pelo watchdog ou armada pela metade). Depois é só passar pelo checklist de novo. Em parada segura, o reinício é manual: segure o botão por 2 segundos na preparação.
      </Texto>

      <Botao
        titulo="Resetar lançadora"
        variante="contorno"
        altura={50}
        tamanhoTexto={16}
        icone={<Icone.Repetir cor={c.texto} tamanho={18} />}
        desabilitado={!conectada}
        carregando={ocupado}
        aoTocar={() => void reparar()}
      />

      {reparo && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: falha ? c.perigoSuave : c.limaoSuave, borderRadius: 14, padding: 12 }}>
          {falha ? <Icone.Alerta cor={c.perigoTexto} tamanho={17} /> : <Icone.Check cor={c.destaque} tamanho={17} />}
          <Texto tamanho={13} peso="semi" cor={falha ? c.perigoTexto : c.destaque} estilo={{ flex: 1 }}>{reparo}</Texto>
        </View>
      )}

      {falha && (
        <CartaoFalha
          falha={falha}
          ocupado={ocupado}
          onReparar={() => void reparar()}
          onReconectar={() => void useLancadora.getState().reconectar()}
          onReiniciar={() => router.push('/sessao/checklist')}
          onRearmar={() => router.push('/sessao/checklist')}
          onFechar={() => setFalha(null)}
        />
      )}
    </View>
  );
}
