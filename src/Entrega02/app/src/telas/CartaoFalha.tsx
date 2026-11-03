// Cartão de erro da lançadora: o que aconteceu, o que fazer e (escondido) o
// detalhe técnico que responde "por que não armou?".

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import type { FalhaLancadora } from '@/lancadora/falhas';
import { Botao, Cartao, Texto, Toque } from '@/ui/componentes';
import * as Icone from '@/ui/icones';
import { useTema } from '@/ui/tema';

const CODIGO: Record<number, string> = {
  0: 'sem resposta',
  400: '400',
  401: '401',
  409: '409',
  429: '429',
};

export function CartaoFalha({
  falha,
  onReparar,
  onReconectar,
  onReiniciar,
  onToken,
  onRearmar,
  onTentar,
  onDiagnostico,
  onFechar,
  ocupado,
}: {
  falha: FalhaLancadora;
  onReparar?: () => void;
  onReconectar?: () => void;
  onReiniciar?: () => void;
  onToken?: () => void;
  onRearmar?: () => void;
  onTentar?: () => void;
  onDiagnostico?: () => void;
  onFechar?: () => void;
  ocupado?: boolean;
}) {
  const { c } = useTema();
  const [tecnico, setTecnico] = useState(false);

  // iOS não usa a live region do Android: anuncia o cartão ao aparecer.
  useEffect(() => {
    // Só o título: o corpo pode conter palavras que o microfone entende como
    // comando se o leitor de tela estiver no alto-falante.
    AccessibilityInfo.announceForAccessibility(falha.titulo);
  }, [falha.titulo, falha.corpo]);

  const acoes: Record<FalhaLancadora['acao'], { titulo: string; aoTocar?: () => void }> = {
    reparar: { titulo: 'Resetar lançadora', aoTocar: onReparar },
    reconectar: { titulo: 'Reconectar', aoTocar: onReconectar },
    reiniciar: { titulo: 'Como reiniciar', aoTocar: onReiniciar },
    token: { titulo: 'Abrir configurações', aoTocar: onToken },
    rearmar: { titulo: 'Rearmar a sessão', aoTocar: onRearmar },
    tentar: { titulo: 'Tentar de novo', aoTocar: onTentar },
    diagnostico: { titulo: 'Ver diagnóstico', aoTocar: onDiagnostico },
  };
  const principal = acoes[falha.acao];
  const icone = falha.acao === 'token' || falha.acao === 'diagnostico'
    ? <Icone.Engrenagem cor={c.limaoTinta} tamanho={18} />
    : falha.acao === 'rearmar'
      ? <Icone.Escudo cor={c.limaoTinta} tamanho={18} />
      : <Icone.Repetir cor={c.limaoTinta} tamanho={18} />;

  return (
    <Cartao destaque={c.perigo} estilo={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.perigoSuave, alignItems: 'center', justifyContent: 'center' }}>
          <Icone.Alerta cor={c.perigoTexto} tamanho={19} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto tamanho={16} peso="negrito" cor={c.perigoTexto}>{falha.titulo}</Texto>
          <Texto tamanho={14} cor={c.textoSuave}>{falha.corpo}</Texto>
        </View>
        <View style={{ paddingHorizontal: 7, paddingVertical: 2, minHeight: 22, borderRadius: 11, justifyContent: 'center', backgroundColor: c.perigoSuave }}>
          <Texto tamanho={11} peso="negrito" max={1.3} linhas={1} cor={c.perigoTexto}>{CODIGO[falha.codigo] ?? falha.codigo}</Texto>
        </View>
      </View>

      <Toque
        accessibilityRole="button"
        accessibilityState={{ expanded: tecnico }}
        accessibilityLabel="Detalhes técnicos do erro"
        onPress={() => setTecnico((t) => !t)}
        hitSlop={4}
        escala={0.99}
        estilo={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, alignSelf: 'flex-start', paddingRight: 6 }}
      >
        <Texto tamanho={12} peso="semi" cor={c.textoSuave}>Detalhes técnicos</Texto>
        <View style={{ transform: [{ rotate: tecnico ? '180deg' : '0deg' }] }}>
          <Icone.SetaBaixo cor={c.textoSuave} tamanho={14} />
        </View>
      </Toque>

      {tecnico && (
        <View style={{ backgroundColor: c.sutil, borderRadius: 10, padding: 10 }}>
          <Texto
            selectable
            tamanho={11}
            cor={c.textoSuave}
            estilo={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined }), lineHeight: 16 }}
          >
            {falha.tecnico}
          </Texto>
        </View>
      )}

      {(principal.aoTocar || onFechar) && (
        <View style={{ gap: 8, marginTop: 2 }}>
          {principal.aoTocar && (
            <Botao titulo={principal.titulo} altura={50} tamanhoTexto={16} carregando={ocupado} icone={icone} aoTocar={principal.aoTocar} />
          )}
          {onFechar && <Botao titulo="Fechar" variante="suave" altura={44} tamanhoTexto={15} desabilitado={ocupado} aoTocar={onFechar} />}
        </View>
      )}
    </Cartao>
  );
}
