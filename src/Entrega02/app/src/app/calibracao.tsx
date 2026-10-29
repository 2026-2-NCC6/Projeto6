// Calibração de segundos por bola (PRD CF-4): dispara por 30 s, o praticante
// conta as bolas e o resultado vai para a memória da lançadora (ADR 0004).

import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { pct } from '@/dominio/treinos';
import { useApp } from '@/estado/app';
import { useLancadora } from '@/lancadora/cliente';
import { Caixa } from '@/telas/FormPerfil';
import { Botao, BotaoEmergencia, Cabecalho, Numero, Passo, Quadra, Tela, Texto, Titulo } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { Lancadora } from '@/ui/Lancadora';
import { haptico } from '@/ui/movimento';
import { paleta, useTema } from '@/ui/tema';

const DURACAO_MS = 30_000;
type Fase = 'pronto' | 'disparando' | 'contar' | 'salvo';

export default function Calibracao() {
  useKeepAwake();
  const { c } = useTema();
  const { status, conexao, enviar } = useLancadora();
  // Mede na velocidade padrão; nos outros treinos a lançadora escala o tempo por bola.
  const velocidade = useApp((s) => s.config.velocidadePadrao);
  const [etapa, setEtapa] = useState<Fase>('pronto');
  const [seguro, setSeguro] = useState(false);
  const [n, setN] = useState(10);
  const [erro, setErro] = useState<string | null>(null);
  const [msSalvo, setMsSalvo] = useState(0);

  // A lançadora para sozinha ao fim dos 30 s e volta a ARMADO; a etapa de
  // contar sai do status dela. Se parar por outro motivo, foi interrompida.
  const terminou = etapa === 'disparando' && status?.estado === 'ARMADO' && status.motivo === 'tempo_concluido';
  const interrompida = etapa === 'disparando' && !!status && !terminou && status.estado !== 'LANCANDO';
  const fase: Fase = terminou ? 'contar' : interrompida ? 'pronto' : etapa;
  const tempoMedido = (terminou && status?.tempoMs) || DURACAO_MS;

  const disparar = async () => {
    setErro(null);
    if (status?.estado === 'REPOUSO') {
      const a = await enviar('armar');
      if (a.codigo !== 200) return setErro('Não foi possível armar a lançadora.');
    }
    const r = await enviar('ligar', { duracaoMs: DURACAO_MS, velocidade });
    if (r.codigo === 200) setEtapa('disparando');
    else setErro(r.codigo === 409 ? 'A lançadora está ocupada. Encerre a sessão antes de calibrar.' : 'A lançadora não respondeu.');
  };

  const msPorBola = fase === 'salvo' ? msSalvo : Math.round(tempoMedido / Math.max(1, n));

  const gravar = async () => {
    const r = await enviar('calibrar', { msPorBola });
    if (r.codigo === 200) {
      haptico.sucesso();
      setMsSalvo(msPorBola);
      setEtapa('salvo');
      await enviar('desarmar');
    } else setErro(r.codigo === 400 ? 'Valor fora do intervalo aceito (0,3 a 20 s por bola).' : 'A lançadora não respondeu.');
  };

  const restante = Math.max(0, Math.ceil((DURACAO_MS - (status?.tempoMs ?? 0)) / 1000));
  const passos = ['Disparar por 30 segundos', 'Contar as bolas que saíram', 'Gravar na lançadora'];
  const atual = { pronto: 0, disparando: 0, contar: 1, salvo: 3 }[fase];
  const s = (ms: number) => (ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  return (
    <Tela>
      <Cabecalho titulo="Calibração" sub="Segundos por bola" />
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Texto cor={c.textoSuave}>Sem sensor, o app estima as bolas pelo tempo. Meça uma vez para a contagem ficar certa nesta lançadora.</Texto>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {passos.map((t, i) => (
            <View key={t} style={{ flex: 1, gap: 8 }} accessibilityLabel={`${t}${i < atual ? ', feito' : i === atual ? ', agora' : ''}`}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: i < atual ? c.progresso : i === atual ? c.limao : c.trilho, borderWidth: i === atual ? 1 : 0, borderColor: c.limaoBorda }} />
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                {i < atual ? <Icone.Check cor={c.destaque} tamanho={14} /> : <Numero tamanho={14} cor={i === atual ? c.texto : c.textoFraco}>{i + 1}</Numero>}
                <Texto tamanho={12} peso={i === atual ? 'negrito' : 'medio'} cor={i === atual ? c.texto : c.textoSuave} estilo={{ flex: 1 }}>{t}</Texto>
              </View>
            </View>
          ))}
        </View>

        <Quadra estilo={{ alignItems: 'center', gap: 14, paddingVertical: 22 }}>
          {conexao !== 'conectada' && (
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
              <Icone.Wifi cor={c.quadraTextoSuave} tamanho={28} />
              <Texto peso="semi" cor={c.quadraTexto}>Conecte a lançadora para calibrar.</Texto>
            </View>
          )}
          {fase === 'pronto' && conexao === 'conectada' && (
            <>
              <Numero tamanho={72} cor={paleta.limao}>30 s</Numero>
              <View style={{ alignSelf: 'stretch', backgroundColor: c.cartao, borderRadius: 16, padding: 12 }}>
                <Caixa marcado={seguro} aoTrocar={() => setSeguro(!seguro)} texto="Área à frente livre, óculos de proteção e alimentador carregado." />
              </View>
              <Botao titulo="Disparar 30 s" icone={<Icone.Play cor={c.limaoTinta} />} desabilitado={!seguro} aoTocar={disparar} estilo={{ alignSelf: 'stretch' }} />
              {status && <Texto tamanho={13} cor={c.quadraTextoSuave}>Atual: {s(status.msPorBola)} s por bola{status.calibrado ? '' : ' (provisório)'}</Texto>}
              <Texto tamanho={13} cor={c.quadraTextoSuave} estilo={{ textAlign: 'center' }}>Mede com o lançador a {pct(velocidade.lancador)}% e o alimentador a {pct(velocidade.alimentador)}% (padrão das Configurações).</Texto>
            </>
          )}
          {fase === 'disparando' && (
            <>
              <Lancadora girando altura={110} />
              <Numero tamanho={96} cor={paleta.limao}>{restante}</Numero>
              <Texto cor={c.quadraTextoSuave}>Conte as bolas que saírem.</Texto>
              <Botao titulo="Desligar" variante="contorno" altura={50} tamanhoTexto={17} estilo={{ alignSelf: 'stretch', borderColor: 'rgba(246,249,232,0.35)' }} aoTocar={() => void enviar('desligar')} />
            </>
          )}
          {fase === 'contar' && (
            <>
              <Titulo tamanho={22} cor={c.quadraTexto}>Quantas bolas saíram?</Titulo>
              <View style={{ backgroundColor: c.cartao, borderRadius: 28, padding: 6 }}>
                <Passo rotulo="bolas" valor={n} aoMenos={() => setN(Math.max(1, n - 1))} aoMais={() => setN(n + 1)} />
              </View>
              <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 2, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(246,249,232,0.12)' }}>
                <Texto tamanho={14} cor={c.quadraTextoSuave} estilo={{ fontVariant: ['tabular-nums'] }}>{s(tempoMedido)} s ÷ {n} bolas</Texto>
                <Numero tamanho={44} cor={paleta.limao}>{s(msPorBola)} s</Numero>
                <Texto tamanho={12} peso="semi" cor={c.quadraTextoSuave}>por bola</Texto>
              </View>
              <Botao titulo="Gravar na lançadora" aoTocar={gravar} estilo={{ alignSelf: 'stretch' }} />
            </>
          )}
          {fase === 'salvo' && (
            <>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: paleta.limao, alignItems: 'center', justifyContent: 'center' }}>
                <Icone.Check cor={paleta.verde} tamanho={32} espessura={3} />
              </View>
              <Numero tamanho={44} cor={c.quadraTexto}>{s(msPorBola)} s</Numero>
              <Texto tamanho={14} cor={c.quadraTextoSuave} estilo={{ textAlign: 'center' }}>Calibrado. Gravado na memória da lançadora; vale para qualquer celular que se conectar.</Texto>
            </>
          )}
          {(erro || interrompida) && <Texto tamanho={14} peso="semi" cor="#FFB4AD" estilo={{ textAlign: 'center' }}>{erro ?? 'A calibração foi interrompida. Tente de novo.'}</Texto>}
        </Quadra>
      </ScrollView>
      {fase === 'disparando' && <BotaoEmergencia aoTocar={() => void enviar('emergencia')} />}
    </Tela>
  );
}
