// Tradução das respostas da lançadora para algo que o praticante entenda e
// possa resolver. O detalhe técnico aparece escondido no cartão de erro: é o
// que responde "por que não armou?" sem obrigar a abrir o monitor serial.

import { TIMEOUT_COMANDO_MS, type Operacao, type Resposta, type StatusLancadora } from './contrato';

export type AcaoFalha = 'tentar' | 'reparar' | 'reconectar' | 'reiniciar' | 'token' | 'rearmar' | 'diagnostico';

export type FalhaLancadora = {
  codigo: number;
  titulo: string;
  corpo: string;
  tecnico: string;
  acao: AcaoFalha;
};

const NOME_ESTADO: Record<string, string> = {
  REPOUSO: 'em repouso',
  ARMADO: 'armada',
  LANCANDO: 'ligada',
  PAUSADO: 'pausada',
  PARADA_SEGURA: 'em parada segura',
};

export function detalheTecnico(op: Operacao, r: Resposta, statusAtual: StatusLancadora | null = null): string {
  const s = statusAtual ?? r.status;
  const partes = [
    op,
    r.falha ? `falha=${r.falha}` : `HTTP ${r.codigo}`,
    s ? `estado=${s.estado}` : 'sem status',
    s?.motivo ? `motivo=${s.motivo}` : null,
    s?.resultado ? `resultado=${s.resultado}` : null,
    s?.erro ? `erro=${s.erro}` : null,
    s?.transporte ? `transporte=${s.transporte}` : null,
    s?.fw ? `fw=${s.fw}` : null,
    r.latenciaMs != null ? `${r.latenciaMs} ms` : null,
  ];
  return partes.filter(Boolean).join(' · ');
}

function falha(op: Operacao, r: Resposta, status: StatusLancadora | null, campos: Omit<FalhaLancadora, 'codigo' | 'tecnico'>): FalhaLancadora {
  return { codigo: r.codigo, tecnico: detalheTecnico(op, r, status), ...campos };
}

export function classificarFalha(op: Operacao, r: Resposta, statusAtual: StatusLancadora | null = null): FalhaLancadora | null {
  if (r.codigo === 200) return null;
  const status = r.status ?? statusAtual;

  if (r.codigo === 0) {
    if (r.falha === 'resposta_invalida') {
      return falha(op, r, status, {
        titulo: 'Resposta que o app não entendeu',
        corpo: 'A lançadora respondeu algo fora do contrato. Confira se o firmware é da mesma versão do app e reconecte.',
        acao: 'diagnostico',
      });
    }
    if (r.falha === 'rede') {
      return falha(op, r, status, {
        titulo: 'Sem conexão com a lançadora',
        corpo: 'O celular não alcançou a lançadora. Confira se ainda está na rede Wi-Fi dela ou se o Bluetooth está ligado e por perto.',
        acao: 'reconectar',
      });
    }
    return falha(op, r, status, {
      titulo: 'A lançadora não respondeu',
      corpo: `O comando não voltou em ${Math.round(TIMEOUT_COMANDO_MS / 1000)} s. Pode ser sinal fraco, distância ou a lançadora ocupada. Reconecte e tente de novo.`,
      acao: 'reconectar',
    });
  }

  if (r.codigo === 401) {
    return falha(op, r, status, {
      titulo: 'Token recusado',
      corpo: 'A lançadora não reconheceu o token deste celular. Confira a etiqueta da máquina e digite de novo em Configurações › Lançadora.',
      acao: 'token',
    });
  }

  if (r.codigo === 429) {
    return falha(op, r, status, {
      titulo: 'Muitos comandos seguidos',
      corpo: 'Aguarde 1 s e tente de novo.',
      acao: 'tentar',
    });
  }

  if (r.codigo === 400) {
    return falha(op, r, status, {
      titulo: 'Comando inválido',
      corpo: 'A lançadora recusou os parâmetros deste comando. Atualize o app e o firmware para a mesma versão e tente de novo.',
      acao: 'tentar',
    });
  }

  if (r.codigo === 409) {
    switch (status?.estado) {
      case 'PARADA_SEGURA':
        return falha(op, r, status, {
          titulo: 'A lançadora está em parada segura',
          corpo: 'Ela ignora comandos até ser reiniciada. Na preparação da sessão, segure o botão de reiniciar por 2 segundos.',
          acao: 'reiniciar',
        });
      case 'LANCANDO':
        return falha(op, r, status, {
          titulo: 'A lançadora ainda está ligada',
          corpo: 'Ela ficou disparando de uma sessão anterior. Resetar zera os motores e deixa a lançadora pronta para armar de novo.',
          acao: 'reparar',
        });
      case 'PAUSADO':
        return falha(op, r, status, {
          titulo: 'A lançadora ficou pausada',
          corpo: 'Uma sessão anterior perdeu a conexão (app fechado, tela apagada ou Wi-Fi caiu) e a lançadora pausou os motores por segurança. Resetar zera tudo e deixa pronta para armar de novo.',
          acao: 'reparar',
        });
      case 'REPOUSO':
        return falha(op, r, status, {
          titulo: 'A lançadora não está armada',
          corpo: 'Sem o checklist, os motores não ligam. Volte à preparação, confirme os quatro itens e arme de novo.',
          acao: 'rearmar',
        });
      default:
        return falha(op, r, status, {
          titulo: 'A lançadora recusou o comando',
          corpo: `Ela está ${status?.estado ? (NOME_ESTADO[status.estado] ?? status.estado) : 'num estado inesperado'} e não aceitou este comando agora. Tente reparar a lançadora.`,
          acao: 'reparar',
        });
    }
  }

  return falha(op, r, status, {
    titulo: 'A lançadora recusou o comando',
    corpo: `Código ${r.codigo}. Reconecte e, se continuar, repare a lançadora.`,
    acao: 'diagnostico',
  });
}

export function precisaReparar(f: FalhaLancadora | null | undefined): boolean {
  return f?.acao === 'reparar';
}

// Um comando que estourou o tempo pode ter chegado. O status diz a verdade:
// se a lançadora está LANCANDO depois de um "ligar", o comando valeu.
export function comandoAplicado(op: Operacao, r: Resposta): boolean {
  const e = r.status?.estado;
  if (e === 'LANCANDO' && (op === 'ligar' || op === 'retomar')) return true;
  if (e === 'PAUSADO' && op === 'pausar') return true;
  if (e === 'PARADA_SEGURA' && op === 'emergencia') return true;
  if (e === 'ARMADO' && op === 'desligar') return true;
  if (e === 'REPOUSO' && (op === 'desarmar' || op === 'resetar')) return true;
  return false;
}
