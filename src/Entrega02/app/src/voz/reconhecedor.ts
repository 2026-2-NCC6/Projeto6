// Reconhecedor de fala atrás de uma interface trocável (ADR 0002). Hoje: o
// reconhecedor nativo da plataforma (Google no Android, Apple no iOS), na
// nuvem quando há internet e no aparelho quando não há. Se a qualidade em
// quadra não bastar, um ReconhecedorDeepgram entra aqui sem mexer nas telas.
//
// Escuta com a tela apagada: no iOS o app declara UIBackgroundModes audio e a
// sessão playAndRecord do reconhecedor mantém o processo vivo. No Android não
// existe um serviço em primeiro plano nesta biblioteca, então o sistema pode
// pausar o microfone; o app tenta garantir a escuta ao voltar para a frente.

import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export type ModoReconhecimento = 'nuvem' | 'aparelho';
export type PreferenciaReconhecimento = 'auto' | 'aparelho';

export type OuvintesReconhecedor = {
  aoTexto(texto: string, final: boolean, alternativas: string[]): void;
  aoErro(msg: string, fatal: boolean): void;
  aoMudarModo(modo: ModoReconhecimento): void;
  // A sessão de escuta acabou; a próxima transcrição começa do zero.
  aoFimDaEscuta(): void;
  aoVolume?(nivel: number): void;
};

export type OpcoesEscuta = {
  modo?: PreferenciaReconhecimento;
  monitorarVolume?: boolean;
};

export interface ReconhecedorDeFala {
  pedirPermissao(): Promise<boolean>;
  temPermissao(): Promise<boolean>;
  iniciar(contexto: string[], ouvintes: OuvintesReconhecedor, opcoes?: OpcoesEscuta): void;
  parar(): void;
  estaAtivo(): boolean;
  estaEscutando(): boolean;
  garantirEscuta(): void;
}

// Erros em que basta recomeçar a escuta.
const TRANSITORIOS = new Set(['no-speech', 'speech-timeout', 'nomatch', 'aborted', 'busy', 'client', 'interrupted']);

export class ReconhecedorNativo implements ReconhecedorDeFala {
  private ativo = false;
  private escutando = false;
  private modo: ModoReconhecimento = 'nuvem';
  private modoPreferido: PreferenciaReconhecimento = 'auto';
  private monitorarVolume = false;
  private subs: { remove(): void }[] = [];
  private contexto: string[] = [];
  private ouvintes: OuvintesReconhecedor | null = null;
  private religar: ReturnType<typeof setTimeout> | null = null;
  private ultimoInicio = 0;
  private recomecosSeguidos = 0;
  // Cada início de escuta conta uma vez no recuo, mesmo que o sistema mande o
  // 'error' e o 'end' da mesma escuta.
  private inicios = 0;
  private recomecoContado = -1;

  async pedirPermissao(): Promise<boolean> {
    const r = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return r.granted;
  }

  async temPermissao(): Promise<boolean> {
    const r = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    return r.granted;
  }

  estaAtivo() {
    return this.ativo;
  }

  estaEscutando() {
    return this.escutando;
  }

  private comecar() {
    const noAparelho = this.modo === 'aparelho';
    this.ultimoInicio = Date.now();
    this.inicios++;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: true,
        maxAlternatives: 3,
        addsPunctuation: false,
        requiresOnDeviceRecognition: noAparelho,
        contextualStrings: this.contexto,
        iosTaskHint: 'confirmation',
        // Grava e toca ao mesmo tempo: o retorno falado e os bips saem pelo
        // alto-falante, e o fone Bluetooth vira o microfone quando conectado.
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'],
          mode: 'measurement',
        },
        // Nível do microfone: só o teste de voz pede, para não re-renderizar a
        // sessão inteira a cada 200 ms.
        volumeChangeEventOptions: { enabled: this.monitorarVolume, intervalMillis: 200 },
        ...(noAparelho ? { androidIntentOptions: { EXTRA_PREFER_OFFLINE: true } } : {}),
      });
    } catch (e) {
      this.escutando = false;
      this.ativo = false;
      this.ouvintes?.aoErro(e instanceof Error ? e.message : 'O microfone não iniciou.', true);
    }
  }

  // Se o sistema encerrou a escuta repetidamente, espera mais para não virar
  // um laço de start/abort gastando bateria. O teto é baixo (1,2 s): com o
  // motor ligado o ruído encerra escutas curtas em sequência, e cada espera é
  // um intervalo em que um "Nock, desliga" não é ouvido.
  private agendarRecomeco() {
    if (!this.ativo) return;
    if (this.religar) clearTimeout(this.religar);
    if (this.recomecoContado !== this.inicios) {
      this.recomecoContado = this.inicios;
      const curto = Date.now() - this.ultimoInicio < 1200;
      this.recomecosSeguidos = curto ? Math.min(this.recomecosSeguidos + 1, 3) : 0;
    }
    const atraso = 150 * 2 ** this.recomecosSeguidos;
    this.religar = setTimeout(() => {
      if (this.ativo) this.comecar();
    }, atraso);
  }

  iniciar(contexto: string[], ouvintes: OuvintesReconhecedor, opcoes?: OpcoesEscuta) {
    this.parar();
    this.ativo = true;
    this.contexto = contexto;
    this.ouvintes = ouvintes;
    this.modoPreferido = opcoes?.modo ?? 'auto';
    this.monitorarVolume = opcoes?.monitorarVolume === true;
    this.modo = this.modoPreferido === 'aparelho' ? 'aparelho' : 'nuvem';
    this.recomecosSeguidos = 0;

    if (this.modo === 'aparelho' && !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      this.modo = 'nuvem';
      ouvintes.aoErro('Este celular não reconhece fala no aparelho. Usando a nuvem.', false);
      ouvintes.aoMudarModo('nuvem');
    }

    const M = ExpoSpeechRecognitionModule;
    this.subs = [
      M.addListener('start', () => {
        this.escutando = true;
      }),
      M.addListener('result', (e) => {
        this.recomecosSeguidos = 0;
        const textos = e.results.map((r) => r.transcript).filter(Boolean);
        if (textos.length) this.ouvintes?.aoTexto(textos[0], e.isFinal, textos);
      }),
      // O reconhecedor encerra sozinho depois de silêncio ou de cada frase em
      // alguns aparelhos; enquanto o microfone estiver ligado, recomeçamos.
      M.addListener('end', () => {
        this.escutando = false;
        this.ouvintes?.aoFimDaEscuta();
        this.agendarRecomeco();
      }),
      M.addListener('error', (e) => {
        if (e.error === 'network' && this.modo === 'nuvem' && M.supportsOnDeviceRecognition()) {
          this.modo = 'aparelho';
          this.ouvintes?.aoMudarModo('aparelho');
          return; // o 'end' que vem em seguida recomeça já no aparelho
        }
        if (e.error === 'language-not-supported' && this.modo === 'aparelho') {
          this.ouvintes?.aoErro('Baixe o pacote de voz pt-BR offline nas configurações do celular.', true);
          this.ativo = false;
          return;
        }
        if (TRANSITORIOS.has(e.error)) {
          this.escutando = false;
          // Alguns aparelhos emitem o erro sem o 'end'; reage do mesmo jeito.
          this.agendarRecomeco();
          return;
        }
        const fatal = e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture';
        if (fatal) {
          this.ativo = false;
          this.escutando = false;
        }
        this.ouvintes?.aoErro(e.message || e.error, fatal);
      }),
      ...(this.monitorarVolume
        ? [M.addListener('volumechange', (e) => this.ouvintes?.aoVolume?.(e.value))]
        : []),
    ];
    this.comecar();
  }

  // Volta do segundo plano: se a intenção de ouvir continua e o sistema parou
  // o reconhecedor, começa de novo sem esperar o próximo 'end'.
  garantirEscuta() {
    if (!this.ativo) return;
    if (!this.escutando) this.agendarRecomeco();
  }

  parar() {
    this.ativo = false;
    this.escutando = false;
    this.recomecosSeguidos = 0;
    if (this.religar) clearTimeout(this.religar);
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // já estava parado
    }
  }
}

export const reconhecedor: ReconhecedorDeFala = new ReconhecedorNativo();
