// Contagem simples de 5 s com um bip por segundo, para as telas que ligam os
// motores fora da sessão (a calibração). A sessão tem a sua, ligada à voz e
// ao descanso (usePartidaAgendada).
//
// Como na sessão, o relógio é de parede: se o app foi suspenso no meio e só
// voltou depois do zero, os motores NÃO ligam (aoExpirar).

import * as Haptics from 'expo-haptics';
import { avisoComAntecedencia, decidirFimDoDescanso } from '@/dominio/descanso';
import { bipDevido, CONTAGEM_MS } from '@/dominio/partida';
import { renovarBips, tocarBip } from './sons';

type Opcoes = { aoSegundo(segundo: number): void; aoFim(): void; aoExpirar(): void };

export function iniciarContagem({ aoSegundo, aoFim, aoExpirar }: Opcoes): () => void {
  const fim = Date.now() + CONTAGEM_MS;
  let ultimo = 6;
  let primeiroBipEm = 0;
  let ativo = true;
  const id = setInterval(() => {
    if (!ativo) return;
    const agora = Date.now();
    const resta = fim - agora;
    const s = bipDevido(resta, ultimo);
    if (s !== null) {
      ultimo = s;
      if (!primeiroBipEm) {
        primeiroBipEm = agora;
        renovarBips();
      }
      tocarBip('contagem');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      aoSegundo(s);
    }
    if (resta > 0) return;
    ativo = false;
    clearInterval(id);
    if (decidirFimDoDescanso(resta, true) === 'retomar' && avisoComAntecedencia(primeiroBipEm, agora)) {
      tocarBip('inicio');
      aoFim();
    } else {
      aoExpirar();
    }
  }, 200);
  return () => {
    ativo = false;
    clearInterval(id);
  };
}
