// Seletor de velocidade: Forte, Médio e Fraco de um toque, ou cada motor no
// Personalizado. O praticante nunca vê duty: vê porcentagem.
//
// Usado no formulário do treino, na primeira sessão de um treino pronto e na
// calibração. O pai decide quando persistir; este componente só entrega a
// velocidade escolhida.

import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { PresetVelocidade, Velocidade } from '@/dominio/tipos';
import {
  ajustarMotor,
  LIMITES_MOTOR,
  type Motor,
  pct,
  PRESETS,
  PRESETS_EM_ORDEM,
  presetDaVelocidade,
  rotuloPreset,
  velocidadeDoPreset,
  velocidadeEmPct,
} from '@/dominio/velocidade';
import { Barra, Botao, Cartao, Negrito, Numero, Passo, Texto, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { haptico } from '@/ui/movimento';
import { useTema } from '@/ui/tema';

const ROTULO_MOTOR: Record<Motor, string> = { lancador: 'Lançador', alimentador: 'Alimentador' };

function CartaoPreset({ preset, selecionado, aoTocar, compacto, larguraTotal }: { preset: (typeof PRESETS_EM_ORDEM)[number]; selecionado: boolean; aoTocar: () => void; compacto?: boolean; larguraTotal?: boolean }) {
  const { c } = useTema();
  const p = PRESETS[preset];
  const tinta = selecionado ? c.limaoTinta : c.texto;
  const suave = selecionado ? 'rgba(21,55,13,0.62)' : c.textoSuave;
  const barraLancador = selecionado ? c.limaoTinta : c.progresso;
  const barraAlimentador = selecionado ? 'rgba(21,55,13,0.55)' : c.begeTexto;
  return (
    <Toque
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionado }}
      accessibilityLabel={`${p.rotulo}. Lançador ${p.lancador}%, alimentador ${p.alimentador}%. ${p.descricao}`}
      onPress={() => {
        haptico.selecao();
        aoTocar();
      }}
      escala={0.96}
      estilo={{
        flex: larguraTotal ? 0 : 1,
        alignSelf: larguraTotal ? 'stretch' : undefined,
        minHeight: compacto ? 92 : 104,
        borderRadius: 18,
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 9,
        gap: 4,
        borderWidth: 1.5,
        borderColor: selecionado ? c.limaoBorda : c.borda,
        backgroundColor: selecionado ? c.limao : c.cartao,
        boxShadow: selecionado ? '' : c.sombra,
        transitionProperty: ['backgroundColor', 'borderColor'],
        transitionDuration: 160,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Texto tamanho={16} peso="negrito" cor={tinta} linhas={1} max={1.3}>{p.rotulo}</Texto>
        {selecionado && <Icone.Check cor={c.limaoTinta} tamanho={15} espessura={3} />}
      </View>
      <Numero tamanho={19} cor={tinta} estilo={{ letterSpacing: -0.4 }}>{p.lancador}/{p.alimentador}</Numero>
      <View style={{ gap: 2 }}>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: selecionado ? 'rgba(21,55,13,0.18)' : c.trilho }}>
          <View style={{ height: 3, width: `${p.lancador}%`, borderRadius: 2, backgroundColor: barraLancador }} />
        </View>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: selecionado ? 'rgba(21,55,13,0.18)' : c.trilho }}>
          <View style={{ height: 3, width: `${p.alimentador}%`, borderRadius: 2, backgroundColor: barraAlimentador }} />
        </View>
      </View>
      <Texto tamanho={11} peso="semi" cor={suave} max={1.3}>lanç. / alim.</Texto>
    </Toque>
  );
}

export function SeletorVelocidade({
  valor,
  aoMudar,
  msPorBola,
  compacto,
}: {
  valor?: Velocidade;
  aoMudar(v: Velocidade, preset: PresetVelocidade): void;
  msPorBola?: number | null;
  compacto?: boolean;
}) {
  const { c } = useTema();
  const reduzir = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const empilhado = width < 360 || fontScale > 1.2;
  const atual = valor ? presetDaVelocidade(valor) : null;
  const aplicado = valor ? velocidadeEmPct(valor) : null;
  const [personalizado, setPersonalizado] = useState<Velocidade>(valor ?? velocidadeDoPreset('medio'));
  const [editor, setEditor] = useState(atual === 'personalizado');

  const aplicar = (v: Velocidade, preset: PresetVelocidade) => {
    aoMudar(v, preset);
  };

  const trocarMotor = (motor: Motor, direcao: 1 | -1) => {
    const proximo = ajustarMotor(personalizado, motor, direcao);
    setPersonalizado(proximo);
    haptico.selecao();
  };

  const custom = velocidadeEmPct(personalizado);

  return (
    <View style={{ gap: 8 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Velocidade dos motores" style={{ flexDirection: empilhado ? 'column' : 'row', gap: 6 }}>
        {PRESETS_EM_ORDEM.map((p) => (
          <CartaoPreset
            key={p}
            preset={p}
            selecionado={atual === p}
            compacto={compacto}
            larguraTotal={empilhado}
            aoTocar={() => {
              setEditor(false);
              aplicar(velocidadeDoPreset(p), p);
            }}
          />
        ))}
      </View>

      <Toque
        accessibilityRole="button"
        accessibilityState={{ expanded: editor }}
        accessibilityLabel={`Personalizado. ${aplicado && atual === 'personalizado' ? `${aplicado.lancador}% no lançador e ${aplicado.alimentador}% no alimentador` : 'Escolher cada motor'}`}
        onPress={() => {
          haptico.selecao();
          // Abrir o editor parte sempre do valor aplicado hoje; fechá-lo
          // mantém o rascunho para o praticante continuar ajustando.
          if (!editor) setPersonalizado(valor ?? velocidadeDoPreset('medio'));
          setEditor((e) => !e);
        }}
        escala={0.99}
        estilo={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 52,
          paddingHorizontal: 13,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: atual === 'personalizado' ? c.limaoBorda : c.borda,
          backgroundColor: atual === 'personalizado' ? c.limaoSuave : c.cartao,
        }}
      >
        <Icone.Raio cor={atual === 'personalizado' ? c.destaque : c.textoSuave} tamanho={18} />
        <View style={{ flex: 1 }}>
          <Texto tamanho={15} peso="negrito" cor={atual === 'personalizado' ? c.destaque : c.texto} max={1.3}>Personalizado</Texto>
          <Texto tamanho={12} cor={c.textoSuave} max={1.3}>
            {aplicado && atual === 'personalizado' ? `${aplicado.lancador}% no lançador · ${aplicado.alimentador}% no alimentador` : 'Escolher cada motor'}
          </Texto>
        </View>
        <View style={{ transform: [{ rotate: editor ? '180deg' : '0deg' }], transitionProperty: 'transform', transitionDuration: reduzir ? 0 : 200 }}>
          <Icone.SetaBaixo cor={c.textoSuave} tamanho={18} />
        </View>
      </Toque>

      {editor && (
        <Cartao estilo={{ gap: 12, padding: 14 }}>
          <Texto tamanho={13} cor={c.textoSuave}>
            Ajuste os motores e toque em Usar esta velocidade para aplicar.
          </Texto>
          <Texto tamanho={12} cor={c.textoFraco}>
            {LIMITES_MOTOR.lancador.min}% a {LIMITES_MOTOR.lancador.max}% no lançador · {LIMITES_MOTOR.alimentador.min}% a {LIMITES_MOTOR.alimentador.max}% no alimentador.
          </Texto>
          {(['lancador', 'alimentador'] as Motor[]).map((motor) => {
            const l = LIMITES_MOTOR[motor];
            const v = custom[motor];
            return (
              <View key={motor} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Texto tamanho={15} peso="medio">{ROTULO_MOTOR[motor]}</Texto>
                  <Passo
                    rotulo={`velocidade do ${motor === 'lancador' ? 'lançador' : 'alimentador'}`}
                    valor={`${v}%`}
                    minimo={l.min}
                    maximo={l.max}
                    aoMenos={() => trocarMotor(motor, -1)}
                    aoMais={() => trocarMotor(motor, 1)}
                  />
                </View>
                <Barra
                  fracao={(v - l.min) / Math.max(1, l.max - l.min)}
                  cor={motor === 'lancador' ? c.limao : c.bege}
                  altura={6}
                />
              </View>
            );
          })}
          {custom.lancador < 10 && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: c.begeSuave, borderRadius: 12, padding: 10 }}>
              <Icone.Alerta cor={c.begeTexto} tamanho={16} />
              <Texto tamanho={12} cor={c.begeTexto} estilo={{ flex: 1 }}>
                Com o lançador abaixo de 10%, a bola pode não sair do cano. Deixe assim só se quiser alimentar sem arremessar.
              </Texto>
            </View>
          )}
          <Botao
            titulo="Usar esta velocidade"
            altura={48}
            tamanhoTexto={16}
            haptico="sucesso"
            aoTocar={() => {
              aplicar(personalizado, 'personalizado');
              setEditor(false);
            }}
          />
        </Cartao>
      )}

      {!compacto && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 2 }}>
          <Texto tamanho={12} cor={c.textoFraco} max={1.3} estilo={{ flex: 1 }}>
            {valor && atual
              ? `${rotuloPreset(atual)} · lançador ${pct(valor.lancador)}% · alimentador ${pct(valor.alimentador)}%`
              : 'Escolha uma velocidade para liberar o treino.'}
          </Texto>
          {!!msPorBola && valor && (
            <Texto tamanho={12} cor={c.textoFraco}>
              1 bola a cada <Negrito cor={c.textoSuave}>{(msPorBola / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s</Negrito>
            </Texto>
          )}
        </View>
      )}
    </View>
  );
}
