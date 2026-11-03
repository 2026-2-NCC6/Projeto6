// Estado do app em memória: perfil, configuração, treinos e sessões, carregados
// do repositório na abertura e gravados de volta a cada mudança.

import { create } from 'zustand';
import { enfileirarSessao, sincronizarPlataforma, urlPlataforma } from '@/dados/plataforma';
import { repositorio } from '@/dados/repositorio';
import { apagarJwtPlataforma } from '@/dados/segredos';
import type { EstadoFila } from '@/dados/sincronizacao';
import { conquistasDesbloqueadas, type IdConquista, type ResumoSessao } from '@/dominio/gamificacao';
import { restaurarTreinoPadrao, sanitizarTreino, TREINOS_PRONTOS, unirTreinos } from '@/dominio/treinos';
import { bolasDaSessao, type Configuracao, type Perfil, type Sessao, type Treino } from '@/dominio/tipos';

export const CONFIG_PADRAO: Configuracao = {
  palavraAtivacao: 'Nock',
  retornoFalado: true,
  tema: 'sistema',
  transportePadrao: 'wifi',
  dispositivoBle: null,
  modoDemonstracao: false,
  // A velocidade agora mora em cada treino; estes campos controlam a escuta
  // no bolso e o comportamento do descanso.
  escutaTelaBloqueada: true,
  manterTelaAcesa: true,
  bips: true,
  retomarSozinho: true,
  reconhecimento: 'auto',
};

type EstadoApp = {
  carregado: boolean;
  perfil: Perfil | null;
  config: Configuracao;
  // Edições dos treinos prontos e treinos criados pelo praticante. A lista
  // completa (prontos + criados) sai de `todosOsTreinos`.
  treinos: Treino[];
  sessoes: Sessao[]; // da mais recente para a mais antiga
  conquistas: Map<IdConquista, number>;
  envios: Record<string, EstadoFila>;
  sincronizacao: { em: number; ok: boolean; mensagem: string } | null;
  carregar(): Promise<void>;
  sincronizar(): Promise<void>;
  salvarPerfil(p: Perfil): Promise<void>;
  atualizarConfig(c: Partial<Configuracao>): Promise<void>;
  salvarTreino(t: Treino): Promise<void>;
  apagarTreino(id: string): Promise<void>;
  // Descarta a edição de um treino pronto e volta ao que veio com o app.
  restaurarTreino(id: string): Promise<void>;
  // Grava a sessão e devolve as conquistas que ela desbloqueou.
  registrarSessao(s: Sessao): Promise<IdConquista[]>;
  apagarTudo(): Promise<void>;
};

export function resumir(s: Sessao): ResumoSessao {
  const paradaSegura = s.encerradaPor === 'parada_segura' || s.series.some((x) => x.motivo === 'emergencia');
  return { inicio: s.inicio, bolas: bolasDaSessao(s), xp: s.xp, paradaSegura };
}

// Configuração salva por qualquer versão do app. A velocidade global das
// Configurações da versão antiga é descartada: cada treino passa a ter a sua.
function normalizarConfig(bruto: unknown): Configuracao {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Partial<Configuracao> & { temaEscuro?: boolean; velocidadePadrao?: unknown };
  const temaEscuro = b.temaEscuro;
  const resto: Partial<Configuracao> = { ...b };
  delete (resto as { velocidadePadrao?: unknown }).velocidadePadrao;
  delete (resto as { temaEscuro?: boolean }).temaEscuro;
  const tema = resto.tema === 'claro' || resto.tema === 'escuro' || resto.tema === 'sistema' ? resto.tema : temaEscuro ? 'escuro' : 'sistema';
  const bool = (v: unknown, padrao: boolean) => (typeof v === 'boolean' ? v : padrao);
  const ble = resto.dispositivoBle;
  const dispositivoBle = ble && typeof ble === 'object' && typeof ble.id === 'string' && typeof ble.nome === 'string' ? { id: ble.id, nome: ble.nome } : null;
  return {
    ...CONFIG_PADRAO,
    ...resto,
    tema,
    palavraAtivacao: typeof resto.palavraAtivacao === 'string' ? resto.palavraAtivacao.trim() || 'Nock' : 'Nock',
    reconhecimento: resto.reconhecimento === 'aparelho' ? 'aparelho' : 'auto',
    transportePadrao: resto.transportePadrao === 'ble' ? 'ble' : 'wifi',
    dispositivoBle,
    modoDemonstracao: bool(resto.modoDemonstracao, CONFIG_PADRAO.modoDemonstracao),
    retornoFalado: bool(resto.retornoFalado, CONFIG_PADRAO.retornoFalado),
    escutaTelaBloqueada: bool(resto.escutaTelaBloqueada, CONFIG_PADRAO.escutaTelaBloqueada),
    manterTelaAcesa: bool(resto.manterTelaAcesa, CONFIG_PADRAO.manterTelaAcesa),
    bips: bool(resto.bips, CONFIG_PADRAO.bips),
    retomarSozinho: bool(resto.retomarSozinho, CONFIG_PADRAO.retomarSozinho),
  };
}

export const useApp = create<EstadoApp>((set, get) => ({
  carregado: false,
  perfil: null,
  config: CONFIG_PADRAO,
  treinos: [],
  sessoes: [],
  conquistas: new Map(),
  envios: {},
  sincronizacao: null,

  async carregar() {
    const [perfil, configSalva, treinosSalvos, sessoes, conquistas, fila] = await Promise.all([
      repositorio.lerPerfil(),
      repositorio.lerConfig(),
      repositorio.listarTreinos(),
      repositorio.listarSessoes(),
      repositorio.listarConquistas(),
      repositorio.listarFila(),
    ]);
    const config = normalizarConfig(configSalva);
    const treinos = treinosSalvos.map(sanitizarTreino).filter((t): t is Treino => !!t);
    const envios = Object.fromEntries(fila.filter((item) => item.tipo === 'sessao').map((item) => [item.id, item.estado]));

    // Grava a configuração migrada uma vez, sem a velocidade global.
    if (configSalva) {
      const antiga = configSalva as Partial<Configuracao> & { velocidadePadrao?: unknown };
      if (configSalva.tema === undefined || 'velocidadePadrao' in antiga) await repositorio.salvarConfig(config);
    }
    set({ carregado: true, perfil, config, treinos, sessoes, conquistas, envios });
    void aplicarSincronizacao(set);
  },

  sincronizar() {
    return aplicarSincronizacao(set);
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
    const limpo = sanitizarTreino(t);
    if (!limpo) return;
    await repositorio.salvarTreino(limpo);
    const atuais = get().treinos;
    const treinos = atuais.some((x) => x.id === limpo.id) ? atuais.map((x) => (x.id === limpo.id ? limpo : x)) : [...atuais, limpo];
    set({ treinos });
    await desbloquear(get, set);
  },

  async apagarTreino(id) {
    // Treino pronto não se apaga; use restaurarTreino.
    if (TREINOS_PRONTOS.some((t) => t.id === id)) return;
    await repositorio.apagarTreino(id);
    set({ treinos: get().treinos.filter((t) => t.id !== id) });
  },

  async restaurarTreino(id) {
    if (!restaurarTreinoPadrao(id)) return;
    await repositorio.apagarTreino(id);
    set({ treinos: get().treinos.filter((t) => t.id !== id) });
  },

  async registrarSessao(s) {
    await repositorio.salvarSessao(s);
    const envios = { ...get().envios };
    try {
      await enfileirarSessao(s);
      if (urlPlataforma()) envios[s.id] = 'pendente';
    } catch {
      // A sessão já está no aparelho. A fila tenta de novo na próxima sincronização.
    }
    set({ sessoes: [s, ...get().sessoes.filter((x) => x.id !== s.id)], envios });
    const novas = await desbloquear(get, set);
    void aplicarSincronizacao(set);
    return novas;
  },

  async apagarTudo() {
    await repositorio.apagarTudo();
    await apagarJwtPlataforma();
    set({ perfil: null, config: CONFIG_PADRAO, treinos: [], sessoes: [], conquistas: new Map(), envios: {}, sincronizacao: null });
  },
}));

async function aplicarSincronizacao(set: (p: Partial<EstadoApp>) => void) {
  try {
    const resultado = await sincronizarPlataforma();
    const parcial: Partial<EstadoApp> = {
      envios: resultado.envios,
      sincronizacao: { em: Date.now(), ok: resultado.ok, mensagem: resultado.mensagem },
    };
    if (resultado.treinos) parcial.treinos = resultado.treinos;
    set(parcial);
  } catch {
    set({ sincronizacao: { em: Date.now(), ok: false, mensagem: 'Não foi possível sincronizar. Os treinos deste aparelho foram mantidos.' } });
  }
}

async function desbloquear(get: () => EstadoApp, set: (p: Partial<EstadoApp>) => void): Promise<IdConquista[]> {
  const { sessoes, treinos, perfil, conquistas } = get();
  const agora = conquistasDesbloqueadas(sessoes.map(resumir), {
    // Editar um treino pronto não conta como criar um treino.
    treinosCriados: treinos.filter((t) => !t.padrao).length,
    metaSemanal: perfil?.metaSemanal ?? 0,
  });
  const novas = [...agora].filter((id) => !conquistas.has(id));
  if (novas.length === 0) return [];
  const em = Date.now();
  await repositorio.registrarConquistas(novas, em);
  const m = new Map(conquistas);
  novas.forEach((id) => m.set(id, em));
  set({ conquistas: m });
  return novas;
}

// Todos os treinos: os prontos (com eventuais edições) e os criados.
export function todosOsTreinos(salvos: Treino[]): Treino[] {
  return unirTreinos(salvos);
}
