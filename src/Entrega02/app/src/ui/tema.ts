// Design system do NockHug: quadra à noite sob refletores. O verde profundo
// (#15370D) é a quadra e ocupa regiões inteiras; o limão óptico (#DFFF4F) é a
// bola, e só aparece no que se move e importa: a ação principal, o estado ao
// vivo, o progresso. Bege e amarelo são a recompensa (XP, conquistas).
//
// Limão nunca vira texto sobre fundo claro (contraste ~1:1): no tema claro ele
// é preenchimento sob tinta verde, ou aparece dentro de uma superfície "quadra".

import { useColorScheme } from 'react-native';
import { useApp } from '@/estado/app';

export const paleta = {
  verde: '#15370D',
  verdeSec: '#728E6D',
  bege: '#E5CD82',
  amarelo: '#FFF2B4',
  limao: '#DFFF4F',
} as const;

export type Cores = {
  fundo: string;
  cartao: string;
  sutil: string; // trilhos, campos, superfícies recuadas
  borda: string;
  bordaForte: string;
  texto: string;
  textoSuave: string;
  textoFraco: string;
  destaque: string; // texto de ênfase sobre o fundo (verde no claro, limão no escuro)
  selecao: string; // chip/opção escolhida
  selecaoTexto: string;
  progresso: string; // preenchimento de barras sobre o fundo
  trilho: string;
  // A quadra: superfície verde que carrega o conteúdo principal nos dois temas.
  quadra: string;
  quadraAlta: string;
  quadraLinha: string;
  quadraTexto: string;
  quadraTextoSuave: string;
  limao: string;
  limaoBorda: string;
  limaoTinta: string;
  limaoSuave: string;
  bege: string;
  begeSuave: string;
  begeTexto: string;
  amarelo: string;
  perigo: string;
  perigoSuave: string;
  perigoTexto: string;
  perigoFundo: string;
  calor: [string, string, string, string];
  sombra: string; // boxShadow dos cartões ('' no escuro: a borda já separa)
  sombraBotao: string;
};

const claro: Cores = {
  fundo: '#F2F1E8',
  cartao: '#FFFFFF',
  sutil: '#E8E7DB',
  borda: '#DEDCCD',
  bordaForte: '#B9B8A4',
  texto: '#11240D',
  textoSuave: '#4A5D44',
  textoFraco: '#66785F',
  destaque: paleta.verde,
  selecao: paleta.verde,
  selecaoTexto: '#F6F9E8',
  progresso: paleta.verde,
  trilho: '#E3E2D5',
  quadra: paleta.verde,
  quadraAlta: '#204A16',
  quadraLinha: 'rgba(223,255,79,0.16)',
  quadraTexto: '#F6F9E8',
  quadraTextoSuave: '#BCCBB2',
  limao: paleta.limao,
  limaoBorda: '#BFDD2E',
  limaoTinta: paleta.verde,
  limaoSuave: '#ECF6C0',
  bege: paleta.bege,
  begeSuave: '#F6EAC2',
  begeTexto: '#6E5410',
  amarelo: paleta.amarelo,
  perigo: '#D7332E',
  perigoSuave: '#FBE4E0',
  perigoTexto: '#9E1A16',
  perigoFundo: '#5C1311',
  calor: ['#E5E4D7', '#C6D69A', paleta.verdeSec, paleta.verde],
  sombra: '0px 1px 2px rgba(21,55,13,0.06), 0px 10px 24px -14px rgba(21,55,13,0.28)',
  sombraBotao: '0px 1px 1px rgba(21,55,13,0.18), 0px 8px 18px -8px rgba(102,128,0,0.55)',
};

const escuro: Cores = {
  fundo: '#0A1607',
  cartao: '#12230E',
  sutil: '#1A3015',
  borda: '#223A1C',
  bordaForte: '#365330',
  texto: '#F1F5E3',
  textoSuave: '#B2C1A9',
  textoFraco: '#8A9B83',
  destaque: paleta.limao,
  selecao: paleta.limao,
  selecaoTexto: paleta.verde,
  progresso: paleta.limao,
  trilho: '#1F3519',
  quadra: '#15370D',
  quadraAlta: '#1E4615',
  quadraLinha: 'rgba(223,255,79,0.14)',
  quadraTexto: '#F6F9E8',
  quadraTextoSuave: '#B5C6AA',
  limao: paleta.limao,
  limaoBorda: '#EEFF9A',
  limaoTinta: paleta.verde,
  limaoSuave: '#25340B',
  bege: paleta.bege,
  begeSuave: '#2A2512',
  begeTexto: paleta.bege,
  amarelo: paleta.amarelo,
  perigo: '#EE4D45',
  perigoSuave: '#3A1513',
  perigoTexto: '#FF9F97',
  perigoFundo: '#4A0F0D',
  calor: ['#18291A', '#33501A', '#83A82A', paleta.limao],
  sombra: '',
  sombraBotao: '0px 8px 22px -10px rgba(223,255,79,0.35)',
};

// Bricolage Grotesque nos títulos e números; o texto corrido fica na fonte do
// sistema (SF / Roboto), que acompanha o tamanho de leitura do celular.
export const fontes = {
  titulo: 'BricolageGrotesque_800ExtraBold',
  tituloForte: 'BricolageGrotesque_700Bold',
  tituloMedio: 'BricolageGrotesque_600SemiBold',
} as const;

export const pesos = { texto: '400', medio: '500', semi: '600', negrito: '700' } as const;
export type Peso = keyof typeof pesos;

export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';

export function useTema(): { c: Cores; escuro: boolean } {
  const preferencia = useApp((s) => s.config.tema);
  const sistema = useColorScheme();
  const ehEscuro = preferencia === 'escuro' || (preferencia === 'sistema' && sistema === 'dark');
  return { c: ehEscuro ? escuro : claro, escuro: ehEscuro };
}
