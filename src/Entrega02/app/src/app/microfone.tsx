// Teste de microfone: mostra o que o app ouviu, a confiança do momento e qual
// comando entendeu. Não aciona a lançadora — serve para posicionar o celular,
// conferir o fone de ouvido e ver se a tela apagada continua ouvindo.

import type { Comando } from '@/dominio/vocabulario';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useApp } from '@/estado/app';
import { Barra, Botao, Cabecalho, Cartao, Negrito, Pilula, Quadra, Tela, Texto, Titulo } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { OrbeVoz } from '@/ui/OrbeVoz';
import { paleta, useTema } from '@/ui/tema';
import { useVoz } from '@/voz/useVoz';

const NOME: Record<Comando, string> = {
  ligar: 'Ligar',
  desligar: 'Desligar',
  pausar: 'Pausar',
  retomar: 'Retomar',
  emergencia: 'Emergência',
};

export default function Microfone() {
  const { c } = useTema();
  const config = useApp((s) => s.config);
  const [comando, setComando] = useState<{ nome: Comando; texto: string; ativada: boolean } | null>(null);
  const [ignorado, setIgnorado] = useState<string | null>(null);

  const voz = useVoz({
    palavra: config.palavraAtivacao,
    retornoFalado: false,
    modoReconhecimento: config.reconhecimento,
    // O teste é na tela: sem serviço em segundo plano.
    manterEmSegundoPlano: false,
    sinalSonoro: config.bips,
    monitorarNivel: true,
    microfone: config.microfone,
    aoComando: (nome, texto, ativada) => {
      setComando({ nome, texto, ativada });
      setIgnorado(null);
    },
    aoIgnorado: (_, motivo) => setIgnorado(motivo === 'sem_ativacao' ? `sem a palavra “${config.palavraAtivacao}”` : 'não entendi'),
  });

  const ligada = voz.estado !== 'desligada';
  const estadoTexto = voz.estado === 'ouvindo_comando' ? 'Ouvindo o comando…' : ligada ? 'Esperando a palavra de ativação' : 'Teste parado';

  return (
    <Tela>
      <Cabecalho titulo="Microfone" sub="Teste de voz" />
      <ScrollView style={{ flex: 1, marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Texto cor={c.textoSuave}>
          Fale “<Negrito>{config.palavraAtivacao}</Negrito>” e o comando, por exemplo “{config.palavraAtivacao}, liga”. O teste mostra o que o app entendeu e não aciona nenhum motor.
        </Texto>

        <Quadra estilo={{ gap: 14, paddingVertical: 18 }}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <OrbeVoz
              estado={voz.estado === 'desligada' ? 'desligada' : voz.estado === 'ouvindo_comando' ? 'ouvindo' : 'esperando'}
              rotulo={ligada ? 'Parar teste de microfone' : 'Começar teste de microfone'}
              aoTocar={() => (ligada ? voz.desligar() : void voz.ligar())}
              tamanho={92}
            />
            <Texto tamanho={15} peso="semi" cor={c.quadraTexto}>{estadoTexto}</Texto>
            <View style={{ alignSelf: 'stretch', gap: 5, paddingHorizontal: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Texto tamanho={11} cor={c.quadraTextoSuave}>volume do microfone</Texto>
                <Texto tamanho={11} cor={c.quadraTextoSuave}>{Math.round(voz.nivel * 100)}%</Texto>
              </View>
              <Barra fracao={voz.nivel} cor={paleta.limao} trilho="rgba(246,249,232,0.12)" altura={8} />
            </View>
          </View>

          <View style={{ backgroundColor: 'rgba(246,249,232,0.08)', borderRadius: 16, padding: 12, gap: 4 }} accessibilityLiveRegion="polite">
            <Texto tamanho={11} peso="semi" cor={c.quadraTextoSuave} estilo={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>O que o app ouviu</Texto>
            <Texto tamanho={17} cor={voz.ultimaFala ? c.quadraTexto : c.quadraTextoSuave} linhas={3} estilo={{ fontStyle: voz.ultimaFala ? 'italic' : 'normal' }}>
              {voz.ultimaFala ? `“${voz.ultimaFala}”` : 'Fale alguma coisa.'}
            </Texto>
          </View>

          {comando ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: paleta.limao, borderRadius: 16, padding: 12 }}>
              <Icone.Check cor={paleta.verde} tamanho={20} espessura={3} />
              <View style={{ flex: 1 }}>
                <Texto tamanho={15} peso="negrito" cor={paleta.verde}>Entendeu: {NOME[comando.nome]}</Texto>
                <Texto tamanho={12} cor="rgba(21,55,13,0.72)" linhas={1}>{comando.ativada ? 'com a palavra de ativação' : 'sem a palavra de ativação (só a emergência vale assim)'}</Texto>
              </View>
            </View>
          ) : ignorado ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(229,205,130,0.16)', borderRadius: 16, padding: 12 }}>
              <Icone.Alerta cor={paleta.bege} tamanho={18} />
              <Texto tamanho={13} cor={paleta.bege} estilo={{ flex: 1 }}>Ignorado: {ignorado}. Tente dizer a palavra e o comando juntos.</Texto>
            </View>
          ) : null}

          {voz.erro && <Texto tamanho={13} peso="semi" cor={c.perigoQuadra}>{voz.erro}</Texto>}
        </Quadra>

        <Botao
          titulo={ligada ? 'Parar teste' : 'Começar teste'}
          variante={ligada ? 'contorno' : 'primario'}
          altura={54}
          tamanhoTexto={17}
          icone={ligada ? <Icone.Pausa cor={c.texto} tamanho={18} /> : <Icone.Microfone cor={c.limaoTinta} tamanho={20} />}
          aoTocar={() => (ligada ? voz.desligar() : void voz.ligar())}
        />

        <Cartao estilo={{ gap: 10 }}>
          <Titulo tamanho={18}>Para ouvir melhor</Titulo>
          {[
            'Fale a uns 30 cm do microfone, sem cobrir a entrada com a mão.',
            config.microfone === 'fone'
              ? 'Com um fone Bluetooth conectado, o app ouve pelo microfone do fone. Para usar o do celular, troque em Configurações → Microfone.'
              : 'O app está ouvindo pelo microfone do celular, mesmo com fone conectado. Para usar o do fone, troque em Configurações → Microfone.',
            'Com a tela apagada, o iPhone continua ouvindo. No Android, o sistema pode pausar o microfone: mantenha a tela ligada para garantir.',
            `Diga “${config.palavraAtivacao}” e o comando na mesma frase. Só “para”, “pare” ou “socorro” valem sem a palavra.`,
          ].map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.destaque, marginTop: 8 }} />
              <Texto tamanho={13} cor={c.textoSuave} estilo={{ flex: 1 }}>{t}</Texto>
            </View>
          ))}
        </Cartao>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pilula texto={voz.modo === 'aparelho' ? 'No aparelho' : 'Nuvem'} fundo={c.sutil} cor={c.textoSuave} />
          <Texto tamanho={12} cor={c.textoFraco} estilo={{ flex: 1 }}>
            {voz.modo === 'aparelho'
              ? 'O áudio é reconhecido no próprio celular, sem internet.'
              : 'Com internet o reconhecimento usa a nuvem; sem ela, cai para o aparelho.'}
          </Texto>
        </View>
      </ScrollView>
    </Tela>
  );
}
