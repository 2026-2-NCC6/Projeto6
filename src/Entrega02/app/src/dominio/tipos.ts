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

// Como o app fala com a lançadora e como ele se comporta na quadra.
export type Configuracao = {
  palavraAtivacao: string;
  retornoFalado: boolean;
  // Claro, escuro ou o que o celular estiver usando.
  tema: 'sistema' | 'claro' | 'escuro';
  transportePadrao: TipoTransporte;
  dispositivoBle: { id: string; nome: string } | null;
  // Usa a lançadora simulada no lugar do ESP32 (desenvolvimento e demonstração).
  modoDemonstracao: boolean;
  // Continua ouvindo com a tela apagada / app em segundo plano.
  escutaTelaBloqueada: boolean;
  // Mantém a tela acesa durante a sessão (desligue para treinar com o celular no bolso).
  manterTelaAcesa: boolean;
  // Bips antes de os motores ligarem e ao reconhecer a palavra de ativação.
  bips: boolean;
  // Retoma a série sozinho no fim do descanso (a menos que o praticante cancele).
  retomarSozinho: boolean;
  // Nuvem quando há internet, no aparelho quando não há; ou sempre no aparelho.
  reconhecimento: 'auto' | 'aparelho';
};

// Duty PWM de cada motor, de 0 a 255 (o app mostra e escolhe em %).
export type Velocidade = { lancador: number; alimentador: number };

// Forte, Médio e Fraco são combinações prontas; Personalizado aceita qualquer
// valor dentro dos limites de cada motor.
export type PresetVelocidade = 'forte' | 'medio' | 'fraco' | 'personalizado';

// Treino: bolas por série × séries × descanso. bolasPorSerie = 0 é o treino Livre.
// A velocidade é obrigatória para treinar: os prontos pedem a definição na
// primeira sessão, e a escolha fica gravada no treino.
export type Treino = {
  id: string;
  nome: string;
  bolasPorSerie: number;
  series: number;
  descansoS: number;
  // Treino que veio com o app (Aquecimento, Resistência, Livre).
  padrao: boolean;
  // Treino pronto que foi editado pelo praticante (mostra "Restaurar padrão").
  personalizado?: boolean;
  velocidade?: Velocidade;
  preset?: PresetVelocidade;
  // Cópia baixada da plataforma. O aparelho não edita nem apaga no servidor.
  origem?: 'plataforma';
  versaoPublicada?: number;
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

// 'auto' é a retomada que o próprio app dispara no fim do descanso.
export type OrigemComando = 'voz' | 'botao' | 'auto';

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
