// Reconhecedor de fala atrás de uma interface trocável (ADR 0002). Hoje: o
// reconhecedor nativo da plataforma (Google no Android, Apple no iOS), na
// nuvem quando há internet e no aparelho quando não há. Se a qualidade em
// quadra não bastar, um ReconhecedorDeepgram entra aqui sem mexer nas telas.

import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export type ModoReconhecimento = 'nuvem' | 'aparelho';

export type OuvintesReconhecedor = {
  aoTexto(texto: string, final: boolean): void;
  aoErro(msg: string, fatal: boolean): void;
  aoMudarModo(modo: ModoReconhecimento): void;
  // A sessão de escuta acabou; a próxima transcrição começa do zero.
  aoFimDaEscuta(): void;
};

export interface ReconhecedorDeFala {
  pedirPermissao(): Promise<boolean>;
  temPermissao(): Promise<boolean>;
  iniciar(contexto: string[], ouvintes: OuvintesReconhecedor): void;
  parar(): void;
}

// Erros em que basta recomeçar a escuta.
const TRANSITORIOS = new Set(['no-speech', 'speech-timeout', 'nomatch', 'aborted', 'busy', 'client', 'interrupted']);

export class ReconhecedorNativo implements ReconhecedorDeFala {
  private ativo = false;
  private modo: ModoReconhecimento = 'nuvem';
  private subs: { remove(): void }[] = [];
  private contexto: string[] = [];
  private ouvintes: OuvintesReconhecedor | null = null;
  private religar: ReturnType<typeof setTimeout> | null = null;

  async pedirPermissao(): Promise<boolean> {
    const r = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return r.granted;
  }

  async temPermissao(): Promise<boolean> {
    const r = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    return r.granted;
  }

  private comecar() {
    const noAparelho = this.modo === 'aparelho';
    ExpoSpeechRecognitionModule.start({
      lang: 'pt-BR',
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      addsPunctuation: false,
      requiresOnDeviceRecognition: noAparelho,
      contextualStrings: this.contexto,
      iosTaskHint: 'confirmation',
      // Grava e toca ao mesmo tempo: o retorno falado sai pelo alto-falante.
      iosCategory: { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth'], mode: 'measurement' },
    });
  }

  private agendarRecomeco() {
    if (!this.ativo) return;
    if (this.religar) clearTimeout(this.religar);
    this.religar = setTimeout(() => this.ativo && this.comecar(), 150);
  }

  iniciar(contexto: string[], ouvintes: OuvintesReconhecedor) {
    this.parar();
    this.ativo = true;
    this.contexto = contexto;
    this.ouvintes = ouvintes;
    const M = ExpoSpeechRecognitionModule;
    this.subs = [
      M.addListener('result', (e) => {
        const texto = e.results[0]?.transcript ?? '';
        if (texto) this.ouvintes?.aoTexto(texto, e.isFinal);
      }),
      // O reconhecedor encerra sozinho depois de silêncio ou de cada frase em
      // alguns aparelhos; enquanto o microfone estiver ligado, recomeçamos.
      M.addListener('end', () => {
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
        if (TRANSITORIOS.has(e.error)) return;
        const fatal = e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture';
        if (fatal) this.ativo = false;
        this.ouvintes?.aoErro(e.message || e.error, fatal);
      }),
    ];
    this.comecar();
  }

  parar() {
    this.ativo = false;
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
