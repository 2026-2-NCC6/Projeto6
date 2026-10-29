// Escolha da palavra de ativação com teste ao vivo (onboarding passo 5 e
// Configurações). O teste reconhece a fala de verdade, mas não aciona nada.

import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { interpretar, palavraDeAtivacaoValida, termosDeContexto } from '@/dominio/vocabulario';
import { Negrito, Opcao, Quadra, Texto, Titulo } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { haptico } from '@/ui/movimento';
import { OrbeVoz } from '@/ui/OrbeVoz';
import { fontes, paleta, useTema } from '@/ui/tema';
import { type ModoReconhecimento, reconhecedor } from '@/voz/reconhecedor';

type Fase = 'parado' | 'ouvindo' | 'ok' | 'errou';

export function EscolhaPalavra({ palavra, aoMudar }: { palavra: string; aoMudar: (p: string) => void }) {
  const { c } = useTema();
  const [fase, setFase] = useState<Fase>('parado');
  const [ouvido, setOuvido] = useState('');
  const [modo, setModo] = useState<ModoReconhecimento>('nuvem');
  const [erro, setErro] = useState<string | null>(null);
  const [foco, setFoco] = useState(false);
  const limite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validacao = palavraDeAtivacaoValida(palavra);
  const nome = palavra.trim() || 'Nock';

  const parar = () => {
    reconhecedor.parar();
    if (limite.current) clearTimeout(limite.current);
  };
  useEffect(() => parar, []);

  const testar = async () => {
    if (!validacao.ok) return;
    setErro(null);
    setOuvido('');
    if (!(await reconhecedor.pedirPermissao())) {
      setErro('Permita o microfone e o reconhecimento de fala para testar.');
      return;
    }
    setFase('ouvindo');
    reconhecedor.iniciar(termosDeContexto(nome), {
      aoTexto: (texto, final) => {
        setOuvido(texto);
        const r = interpretar(texto, nome, false);
        if (r.tipo === 'comando' && r.comando === 'ligar') {
          parar();
          haptico.sucesso();
          setFase('ok');
        } else if (final) {
          haptico.erro();
          setFase('errou');
        }
      },
      aoErro: (msg, fatal) => {
        if (fatal) {
          parar();
          setFase('parado');
        }
        setErro(msg);
      },
      aoMudarModo: setModo,
      aoFimDaEscuta: () => undefined,
    });
    limite.current = setTimeout(() => {
      parar();
      setFase((f) => (f === 'ouvindo' ? 'errou' : f));
    }, 8000);
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Texto tamanho={13} peso="semi" cor={c.textoSuave}>Palavra</Texto>
        <TextInput
          accessibilityLabel="Palavra de ativação"
          value={palavra}
          onChangeText={(t) => {
            aoMudar(t);
            setFase('parado');
          }}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          autoCapitalize="words"
          autoCorrect={false}
          selectionColor={c.destaque}
          cursorColor={c.destaque}
          style={{ height: 64, borderRadius: 18, borderWidth: 1.5, borderColor: !validacao.ok ? c.perigo : foco ? c.destaque : c.borda, backgroundColor: c.cartao, paddingHorizontal: 18, fontFamily: fontes.titulo, fontSize: 30, letterSpacing: -0.8, color: c.texto }}
        />
        {!validacao.ok && <Texto tamanho={14} peso="semi" cor={c.perigoTexto}>{validacao.motivo}</Texto>}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Texto tamanho={14} cor={c.textoSuave} estilo={{ marginRight: 2 }}>Sugestões</Texto>
        {['Nock', 'Arena', 'Bolinha'].map((s) => <Opcao key={s} redondo texto={s} ativo={palavra === s} aoTocar={() => aoMudar(s)} />)}
      </View>

      <Quadra estilo={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
        <Titulo tamanho={22} cor={c.quadraTexto}>Teste ao vivo</Titulo>
        <Texto tamanho={15} cor={c.quadraTextoSuave}>Toque na bola e diga <Negrito cor={paleta.limao}>“{nome}, liga”</Negrito></Texto>
        <View style={{ marginLeft: 35 /* compensa a área das ondas, à direita da bola */ }}>
          <OrbeVoz
            estado={fase === 'ouvindo' ? 'ouvindo' : 'esperando'}
            tamanho={84}
            sobreQuadra
            rotulo={fase === 'ouvindo' ? 'Parar o teste' : 'Testar palavra de ativação'}
            aoTocar={fase === 'ouvindo' ? () => { parar(); setFase('parado'); } : testar}
          />
        </View>
        <View accessibilityLiveRegion="polite" style={{ minHeight: 52, alignItems: 'center', gap: 6 }}>
          {ouvido ? <Texto tamanho={15} cor={c.quadraTexto} estilo={{ textAlign: 'center' }}>Ouvi: <Texto tamanho={15} cor={c.quadraTexto} estilo={{ fontStyle: 'italic' }}>“{ouvido}”</Texto></Texto> : null}
          {fase === 'ok' && (
            <Animated.View entering={FadeIn.duration(180)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: paleta.limao }}>
              <Icone.Check cor={paleta.verde} tamanho={15} />
              <Texto tamanho={14} peso="negrito" cor={paleta.verde}>Entendi: Ligar · nada foi acionado</Texto>
            </Animated.View>
          )}
          {fase === 'errou' && <Texto tamanho={15} peso="negrito" cor="#FFB4AD" estilo={{ textAlign: 'center' }}>Não reconheci “{nome}, liga”. Tente de novo.</Texto>}
          {fase === 'parado' && !ouvido && <Texto tamanho={13} cor={c.quadraTextoSuave} estilo={{ textAlign: 'center' }}>{modo === 'aparelho' ? 'Reconhecendo no aparelho (sem internet).' : 'Reconhecimento no aparelho quando não houver internet.'}</Texto>}
          {erro && <Texto tamanho={13} cor="#FFB4AD" estilo={{ textAlign: 'center' }}>{erro}</Texto>}
        </View>
      </Quadra>
    </View>
  );
}
