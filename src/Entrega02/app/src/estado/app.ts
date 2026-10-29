// Estado do app em memória: perfil, configuração, treinos e sessões, carregados
// do repositório na abertura e gravados de volta a cada mudança.

import { create } from 'zustand';
import { repositorio } from '@/dados/repositorio';
import { conquistasDesbloqueadas, type IdConquista, type ResumoSessao } from '@/dominio/gamificacao';
import { TREINOS_PRONTOS } from '@/dominio/treinos';
import { bolasDaSessao, type Configuracao, type Perfil, type Sessao, type Treino } from '@/dominio/tipos';

export const CONFIG_PADRAO: Configuracao = {
  palavraAtivacao: 'Nock',
  retornoFalado: true,
  tema: 'sistema',
  transportePadrao: 'wifi',
  dispositivoBle: null,
  modoDemonstracao: false,
  velocidadePadrao: { lancador: 100, alimentador: 25 }, // o duty da Entrega 01
};

type EstadoApp = {
  carregado: boolean;
  perfil: Perfil | null;
  config: Configuracao;
  treinos: Treino[]; // só os criados pelo praticante
  sessoes: Sessao[]; // da mais recente para a mais antiga
  conquistas: Map<IdConquista, number>;
  carregar(): Promise<void>;
  salvarPerfil(p: Perfil): Promise<void>;
  atualizarConfig(c: Partial<Configuracao>): Promise<void>;
  salvarTreino(t: Treino): Promise<void>;
  apagarTreino(id: string): Promise<void>;
  // Grava a sessão e devolve as conquistas que ela desbloqueou.
  registrarSessao(s: Sessao): Promise<IdConquista[]>;
  apagarTudo(): Promise<void>;
};

export function resumir(s: Sessao): ResumoSessao {
  const paradaSegura = s.encerradaPor === 'parada_segura' || s.series.some((x) => x.motivo === 'emergencia');
  return { inicio: s.inicio, bolas: bolasDaSessao(s), xp: s.xp, paradaSegura };
}

export const useApp = create<EstadoApp>((set, get) => ({
  carregado: false,
  perfil: null,
  config: CONFIG_PADRAO,
  treinos: [],
  sessoes: [],
  conquistas: new Map(),

  async carregar() {
    const [perfil, config, treinos, sessoes, conquistas] = await Promise.all([
      repositorio.lerPerfil(),
      repositorio.lerConfig(),
      repositorio.listarTreinos(),
      repositorio.listarSessoes(),
      repositorio.listarConquistas(),
    ]);
    // Antes de 'tema' existir, a configuração guardava só temaEscuro.
    const antigo = config as (Partial<Configuracao> & { temaEscuro?: boolean }) | null;
    const tema = antigo?.tema ?? (antigo?.temaEscuro ? 'escuro' : 'sistema');
    set({ carregado: true, perfil, config: { ...CONFIG_PADRAO, ...config, tema }, treinos, sessoes, conquistas });
  },

  async salvarPerfil(p) {
    await repositorio.salvarPerfil(p);
    set({ perfil: p });
  },

  async atualizarConfig(c) {
    const config = { ...get().config, ...c };
    await repositorio.salvarConfig(config);
    set({ config });
  },

  async salvarTreino(t) {
    await repositorio.salvarTreino(t);
    const treinos = [...get().treinos.filter((x) => x.id !== t.id), t];
    set({ treinos });
    await desbloquear(get, set);
  },

  async apagarTreino(id) {
    await repositorio.apagarTreino(id);
    set({ treinos: get().treinos.filter((t) => t.id !== id) });
  },

  async registrarSessao(s) {
    await repositorio.salvarSessao(s);
    set({ sessoes: [s, ...get().sessoes.filter((x) => x.id !== s.id)] });
    return desbloquear(get, set);
  },

  async apagarTudo() {
    await repositorio.apagarTudo();
    set({ perfil: null, config: CONFIG_PADRAO, treinos: [], sessoes: [], conquistas: new Map() });
  },
}));

async function desbloquear(get: () => EstadoApp, set: (p: Partial<EstadoApp>) => void): Promise<IdConquista[]> {
  const { sessoes, treinos, perfil, conquistas } = get();
  const agora = conquistasDesbloqueadas(sessoes.map(resumir), { treinosCriados: treinos.length, metaSemanal: perfil?.metaSemanal ?? 0 });
  const novas = [...agora].filter((id) => !conquistas.has(id));
  if (novas.length === 0) return [];
  const em = Date.now();
  await repositorio.registrarConquistas(novas, em);
  const m = new Map(conquistas);
  novas.forEach((id) => m.set(id, em));
  set({ conquistas: m });
  return novas;
}

export function todosOsTreinos(criados: Treino[]): Treino[] {
  return [...TREINOS_PRONTOS, ...criados];
}
