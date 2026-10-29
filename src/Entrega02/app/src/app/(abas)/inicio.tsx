import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { intensidade } from '@/dominio/gamificacao';
import { useApp } from '@/estado/app';
import { useProgresso } from '@/estado/progresso';
import { useLancadora } from '@/lancadora/cliente';
import { ItemSessao } from '@/telas/ItemSessao';
import { Avatar, FaixaStatus, Barra, Botao, BotaoIcone, Cartao, Numero, Quadra, Segmentos, Texto, Titulo, Toque } from '@/ui/componentes';
import { milhar, saudacao } from '@/ui/formato';
import * as Icone from '@/ui/icones';
import { useTema } from '@/ui/tema';

type Aba = 'dia' | 'semana' | 'mes';
const DIAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function Barras({ valores, rotulos }: { valores: number[]; rotulos: string[] }) {
  const { c } = useTema();
  const max = Math.max(1, ...valores);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, height: 112 }}>
      {valores.map((v, i) => (
        <View key={i} style={{ flex: 1, maxWidth: 52, alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%' }}>
          <Texto tamanho={12} peso="semi" cor={c.textoSuave}>{v || ''}</Texto>
          <View style={{ width: '100%', height: Math.max(6, Math.round((v / max) * 72)), borderRadius: 8, backgroundColor: v ? c.progresso : c.trilho }} />
          <Texto tamanho={12} cor={c.textoFraco}>{rotulos[i]}</Texto>
        </View>
      ))}
    </View>
  );
}

function Atividade() {
  const { c } = useTema();
  const p = useProgresso();
  const [aba, setAba] = useState<Aba>('mes');

  const porDiaSemana = p.calor[p.calor.length - 1].map((d) => d.bolas);
  const totalSemana = porDiaSemana.reduce((a, b) => a + b, 0);
  const deHoje = p.seriesDeHoje.map((s) => s.bolas);
  const bolasMapa = p.calor.flat().reduce((t, d) => t + d.bolas, 0);

  return (
    <Cartao estilo={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Titulo tamanho={20}>Atividade</Titulo>
        <View style={{ width: 218 }}>
          <Segmentos opcoes={[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']]} valor={aba} aoMudar={setAba} altura={32} />
        </View>
      </View>
      {aba === 'mes' && (
        <>
          <View style={{ flexDirection: 'row', gap: 3 }} accessibilityLabel={`Mapa de calor das últimas 15 semanas, ${bolasMapa} bolas`}>
            {p.calor.map((semana, w) => (
              <View key={w} style={{ flex: 1, gap: 3 }}>
                {semana.map((d) => (
                  <View key={d.chave} style={{ aspectRatio: 1, borderRadius: 4, backgroundColor: d.futuro ? 'transparent' : c.calor[intensidade(d.bolas)] }} />
                ))}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto tamanho={13} cor={c.textoSuave}>15 semanas · {milhar(bolasMapa)} bolas</Texto>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Texto tamanho={12} cor={c.textoFraco}>menos</Texto>
              {c.calor.map((t) => <View key={t} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: t }} />)}
              <Texto tamanho={12} cor={c.textoFraco}>mais</Texto>
            </View>
          </View>
        </>
      )}
      {aba === 'semana' && (
        <>
          <Barras valores={porDiaSemana} rotulos={DIAS} />
          <Texto tamanho={13} cor={c.textoSuave}>Esta semana · bolas por dia · {milhar(totalSemana)} no total</Texto>
        </>
      )}
      {aba === 'dia' && (
        <>
          {deHoje.length ? (
            <Barras valores={deHoje} rotulos={deHoje.map((_, i) => `S${i + 1}`)} />
          ) : (
            <View style={{ height: 112, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icone.Bola tamanho={30} id="vazio-dia" />
              <Texto tamanho={14} cor={c.textoSuave}>Nenhuma série hoje ainda.</Texto>
            </View>
          )}
          <Texto tamanho={13} cor={c.textoSuave}>Hoje · bolas por série · {milhar(deHoje.reduce((a, b) => a + b, 0))} no total</Texto>
        </>
      )}
    </Cartao>
  );
}

// Placar da semana: sequência grande à esquerda, meta em bolas à direita.
function Placar() {
  const { c } = useTema();
  const p = useProgresso();
  const hoje = (new Date().getDay() + 6) % 7;
  return (
    <Quadra estilo={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icone.Fogo tamanho={34} />
            <Numero tamanho={64} cor={c.quadraTexto}>{p.sequencia}</Numero>
          </View>
          <Texto tamanho={14} cor={c.quadraTextoSuave}>{p.sequencia === 1 ? 'dia de sequência' : 'dias de sequência'}</Texto>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Numero tamanho={30} cor={c.limao}>
            {p.diasNaSemana}
            <Numero tamanho={18} cor={c.quadraTextoSuave}> / {p.meta}</Numero>
          </Numero>
          <Texto tamanho={14} cor={c.quadraTextoSuave}>dias na meta</Texto>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityLabel={`${p.diasNaSemana} de ${p.meta} dias treinados nesta semana`}>
        {p.semana.map((feito, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: i === hoje && !feito ? 1.5 : 0, borderColor: c.limao, backgroundColor: feito ? 'transparent' : 'rgba(246,249,232,0.08)' }}>
              {feito && <Icone.Bola tamanho={30} id={`sem-${i}`} />}
            </View>
            <Texto tamanho={12} peso={i === hoje ? 'negrito' : 'medio'} cor={i === hoje ? c.limao : c.quadraTextoSuave}>{DIAS[i]}</Texto>
          </View>
        ))}
      </View>
    </Quadra>
  );
}

export default function Home() {
  const { c } = useTema();
  const perfil = useApp((s) => s.perfil);
  const sessoes = useApp((s) => s.sessoes);
  const p = useProgresso();
  // Só o que a tela usa: o status muda a cada 250–500 ms e redesenharia o mapa inteiro.
  const { conexao, alvo } = useLancadora(useShallow((s) => ({ conexao: s.conexao, alvo: s.alvo })));
  const iniciais = `${perfil?.nome[0] ?? ''}${perfil?.sobrenome[0] ?? ''}`.toUpperCase();
  const topo = useSafeAreaInsets().top;
  const conectada = conexao === 'conectada';
  const IconeConexao = alvo?.simulado ? Icone.Simulada : alvo?.tipo === 'ble' ? Icone.Bluetooth : Icone.Wifi;

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: topo + 10, gap: 16, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar fotoUri={perfil?.fotoUri} iniciais={iniciais} />
          <View style={{ flex: 1 }}>
            <Texto tamanho={14} cor={c.textoSuave}>{saudacao()}</Texto>
            <Titulo tamanho={26} linhas={1}>{perfil?.nome ?? ''}</Titulo>
          </View>
          <Toque
            accessibilityRole="button"
            accessibilityLabel={conectada ? 'Lançadora conectada' : 'Lançadora desconectada. Configurar'}
            onPress={() => router.push('/lancadora')}
            estilo={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: conectada ? c.limaoSuave : c.sutil }}
          >
            {conectada ? <IconeConexao cor={c.destaque} tamanho={15} /> : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.textoFraco }} />}
            <Texto tamanho={13} peso="semi" cor={conectada ? c.destaque : c.textoSuave}>{conectada ? (alvo?.simulado ? 'Simulada' : alvo?.tipo === 'ble' ? 'Bluetooth' : 'Wi-Fi') : 'Desconectada'}</Texto>
          </Toque>
          <BotaoIcone rotulo="Configurações" aoTocar={() => router.push('/configuracoes')}>
            <Icone.Engrenagem cor={c.texto} />
          </BotaoIcone>
        </View>

        <Placar />

        <Link href="/conquistas" asChild>
          <Toque accessibilityRole="button" accessibilityLabel={`Nível ${p.nivel.nivel}, ${p.nivel.xpNoNivel} de ${p.nivel.xpDoNivel} XP`} estilo={{ backgroundColor: c.cartao, borderWidth: c.sombra ? 0 : 1, borderColor: c.borda, boxShadow: c.sombra, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.bege, alignItems: 'center', justifyContent: 'center' }}>
              <Numero tamanho={22} cor={c.quadra}>{p.nivel.nivel}</Numero>
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Texto tamanho={15} peso="negrito">Nível {p.nivel.nivel}</Texto>
                <Texto tamanho={13} cor={c.textoSuave} estilo={{ fontVariant: ['tabular-nums'] }}>{p.nivel.xpNoNivel} / {p.nivel.xpDoNivel} XP</Texto>
              </View>
              <Barra fracao={p.nivel.xpNoNivel / p.nivel.xpDoNivel} cor={c.bege} />
            </View>
            <Icone.Avancar cor={c.textoFraco} />
          </Toque>
        </Link>

        <Atividade />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <Titulo tamanho={20}>Últimas sessões</Titulo>
          {sessoes.length > 0 && (
            <Link href="/historico" style={{ fontSize: 15, fontWeight: '600', color: c.destaque, padding: 6 }}>Ver tudo</Link>
          )}
        </View>
        {sessoes.length === 0 ? (
          <Cartao estilo={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Icone.Fogo tamanho={30} cor={c.bege} miolo={c.amarelo} />
            <Texto tamanho={15} cor={c.textoSuave} estilo={{ flex: 1 }}>Nenhuma sessão ainda. Sua primeira série acende o foguinho.</Texto>
          </Cartao>
        ) : (
          <View style={{ gap: 10 }}>
            {sessoes.slice(0, 3).map((s) => <ItemSessao key={s.id} s={s} />)}
          </View>
        )}
      </ScrollView>
      <FaixaStatus />
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: 14, paddingTop: 28, experimental_backgroundImage: `linear-gradient(to bottom, ${c.fundo}00 0%, ${c.fundo} 55%)` }}
      >
        <Botao titulo="Começar sessão" icone={<Icone.Play cor={c.limaoTinta} />} aoTocar={() => router.push('/sessao/checklist')} tamanhoTexto={19} />
      </View>
    </View>
  );
}

