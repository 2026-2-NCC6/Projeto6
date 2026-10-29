// Tipos do domínio. Os nomes seguem o GLOSSARY.md da bancada.

export type Nivel = 'iniciante' | 'intermediario' | 'avancado';
export type Mao = 'destro' | 'canhoto';
export type Objetivo = 'golpes' | 'condicionamento' | 'lazer' | 'competir';

export type Perfil = {
  nome: string;
  sobrenome: string;
  idade: number;
  nivel: Nivel;
  mao: Mao;
  objetivos: Objetivo[];
  metaSemanal: number; // dias de treino por semana
  fotoUri: string | null;
  cienciaResponsavel: boolean; // exigida de 13 a 17 anos
  aceiteLgpdEm: number;
};

export type TipoTransporte = 'wifi' | 'ble';

export type Configuracao = {
  palavraAtivacao: string;
  retornoFalado: boolean;
  // Claro, escuro ou o que o celular estiver usando.
  tema: 'sistema' | 'claro' | 'escuro';
  transportePadrao: TipoTransporte;
  dispositivoBle: { id: string; nome: string } | null;
  // Usa a lançadora simulada no lugar do ESP32 (desenvolvimento e demonstração).
  modoDemonstracao: boolean;
  // Velocidade dos treinos prontos e ponto de partida dos treinos novos.
  velocidadePadrao: Velocidade;
};

// Duty PWM de cada motor, de 0 a 255 (o app mostra em %).
export type Velocidade = { lancador: number; alimentador: number };

// Treino: bolas por série × séries × descanso. bolasPorSerie = 0 é o treino Livre.
export type Treino = {
  id: string;
  nome: string;
  bolasPorSerie: number;
  series: number;
  descansoS: number;
  pronto: boolean; // pré-definido, não editável
  velocidade?: Velocidade; // ausente = padrão das Configurações
};

export type MotivoFimSerie = 'serie_concluida' | 'desligar' | 'emergencia' | 'conexao_perdida' | 'encerrada';
export type MotivoFimSessao = 'concluida' | 'praticante' | 'parada_segura';

export type Serie = {
  indice: number;
  bolas: number;
  inicio: number;
  fim: number;
  motivo: MotivoFimSerie;
};

export type OrigemComando = 'voz' | 'botao';

export type RegistroComando = {
  ts: number;
  origem: OrigemComando;
  transcricao: string;
  comando: string;
  aceito: boolean;
  motivo: string | null;
  latenciaMs: number | null;
};

export type Sessao = {
  id: string;
  treino: Treino;
  inicio: number;
  fim: number;
  // 'simulada' separa os testes sem hardware das sessões reais.
  transporte: TipoTransporte | 'simulada';
  series: Serie[];
  comandos: RegistroComando[];
  encerradaPor: MotivoFimSessao;
  xp: number;
};

export function bolasDaSessao(s: Pick<Sessao, 'series'>): number {
  return s.series.reduce((t, x) => t + x.bolas, 0);
}
