// Ícones de traço desenhados para o NockHug: grade de 24, traço 2, pontas
// redondas. A bola de tênis e as linhas de quadra são as peças da marca.

import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { paleta } from './tema';

type P = { cor: string; tamanho?: number; espessura?: number };

const base = (t = 22) => ({ width: t, height: t, viewBox: '0 0 24 24', fill: 'none' as const });
const traco = (cor: string, e = 2) => ({ stroke: cor, strokeWidth: e, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const Voltar = ({ cor, tamanho }: P) => (
  <Svg {...base(tamanho)}><Path d="M15 18l-6-6 6-6" {...traco(cor, 2.2)} /></Svg>
);
export const Avancar = ({ cor, tamanho = 18 }: P) => (
  <Svg {...base(tamanho)}><Path d="M9 6l6 6-6 6" {...traco(cor, 2.2)} /></Svg>
);
export const Mais = ({ cor, tamanho = 18 }: P) => (
  <Svg {...base(tamanho)}><Path d="M12 5v14M5 12h14" {...traco(cor, 2.4)} /></Svg>
);
export const Menos = ({ cor, tamanho = 18 }: P) => (
  <Svg {...base(tamanho)}><Path d="M5 12h14" {...traco(cor, 2.4)} /></Svg>
);
export const Infinito = ({ cor, tamanho = 22 }: P) => (
  <Svg {...base(tamanho)}>
    <Path d="M12 12c-1.8-2.4-3.3-3.6-5-3.6a3.6 3.6 0 0 0 0 7.2c1.7 0 3.2-1.2 5-3.6zm0 0c1.8 2.4 3.3 3.6 5 3.6a3.6 3.6 0 0 0 0-7.2c-1.7 0-3.2 1.2-5 3.6z" {...traco(cor, 2.2)} />
  </Svg>
);
export const Microfone = ({ cor, tamanho = 28 }: P) => (
  <Svg {...base(tamanho)}>
    <Rect x={9} y={2.5} width={6} height={12} rx={3} {...traco(cor)} />
    <Path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" {...traco(cor)} />
  </Svg>
);
export const MicrofoneMudo = ({ cor, tamanho = 28 }: P) => (
  <Svg {...base(tamanho)}>
    <Path d="M15 9.5V5.5a3 3 0 0 0-5.6-1.5M9 9v2.5a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3.5M3.5 3.5l17 17" {...traco(cor)} />
  </Svg>
);
export const Parar = ({ cor, tamanho = 26 }: P) => (
  <Svg {...base(tamanho)}>
    <Path d="M7.9 2.5h8.2l5.4 5.4v8.2l-5.4 5.4H7.9l-5.4-5.4V7.9z" {...traco(cor, 2.2)} />
    <Rect x={8.5} y={8.5} width={7} height={7} rx={1.2} fill={cor} />
  </Svg>
);
export const Pausa = ({ cor, tamanho = 20 }: P) => (
  <Svg {...base(tamanho)}><Path d="M8.5 5.5v13M15.5 5.5v13" {...traco(cor, 2.8)} /></Svg>
);
export const Quadrado = ({ cor, tamanho = 18 }: P) => (
  <Svg {...base(tamanho)}><Rect x={6} y={6} width={12} height={12} rx={2.5} fill={cor} /></Svg>
);
export const Cadeado = ({ cor, tamanho = 60 }: P) => (
  <Svg {...base(tamanho)}>
    <Rect x={4.5} y={10.5} width={15} height={11} rx={3} {...traco(cor, 1.8)} />
    <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5M12 15v2.5" {...traco(cor, 1.8)} />
  </Svg>
);
export const Check = ({ cor, tamanho = 18, espessura = 2.8 }: P) => (
  <Svg {...base(tamanho)}><Path d="M5 12.5l4.5 4.5L19 7.5" {...traco(cor, espessura)} /></Svg>
);
export const Alerta = ({ cor, tamanho = 22 }: P) => (
  <Svg {...base(tamanho)}>
    <Path d="M10.3 4.2a2 2 0 0 1 3.4 0l7.6 13.2a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3z" {...traco(cor)} />
    <Path d="M12 9.5v4" {...traco(cor)} />
    <Circle cx={12} cy={16.9} r={1.1} fill={cor} />
  </Svg>
);
export const Wifi = ({ cor, tamanho = 16 }: P) => (
  <Svg {...base(tamanho)}>
    <Path d="M4.5 10.5a11 11 0 0 1 15 0 M7.8 14a6.2 6.2 0 0 1 8.4 0" {...traco(cor, 2.2)} />
    <Circle cx={12} cy={18} r={1.5} fill={cor} />
  </Svg>
);
export const Bluetooth = ({ cor, tamanho = 16 }: P) => (
  <Svg {...base(tamanho)}><Path d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9" {...traco(cor, 2.2)} /></Svg>
);
export const Simulada = ({ cor, tamanho = 16 }: P) => (
  <Svg {...base(tamanho)}>
    <Rect x={3.5} y={5} width={17} height={12} rx={2.5} {...traco(cor, 2.2)} />
    <Path d="M9 20.5h6" {...traco(cor, 2.2)} />
  </Svg>
);
export const Engrenagem = ({ cor, tamanho }: P) => (
  <Svg {...base(tamanho)}>
    <Circle cx={12} cy={12} r={3.2} {...traco(cor, 1.9)} />
    <Path
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
      {...traco(cor, 1.9)}
    />
  </Svg>
);
export const Casa = ({ cor, tamanho }: P) => (
  <Svg {...base(tamanho)}><Path d="M3.5 10.5L12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z" {...traco(cor)} /></Svg>
);
// Treinos: uma série de bolas em fila.
export const Series = ({ cor, tamanho }: P) => (
  <Svg {...base(tamanho)}>
    <Circle cx={6} cy={7} r={2.4} {...traco(cor)} />
    <Path d="M11.5 7h9M11.5 17h9" {...traco(cor)} />
    <Circle cx={6} cy={17} r={2.4} {...traco(cor)} />
  </Svg>
);
export const Relogio = ({ cor, tamanho }: P) => (
  <Svg {...base(tamanho)}>
    <Circle cx={12} cy={12} r={8.5} {...traco(cor)} />
    <Path d="M12 7.5V12l3 2" {...traco(cor)} />
  </Svg>
);
export const Trofeu = ({ cor, tamanho }: P) => (
  <Svg {...base(tamanho)}>
    <Path d="M8 21h8M12 16.5V21M7 3.5h10V9a5 5 0 0 1-10 0z M17 5h2.5v1.5A3.5 3.5 0 0 1 17 10M7 5H4.5v1.5A3.5 3.5 0 0 0 7 10" {...traco(cor)} />
  </Svg>
);
export const Play = ({ cor, tamanho = 22 }: P) => (
  <Svg {...base(tamanho)}><Path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l10.6-6.8a1 1 0 0 0 0-1.7L9.5 4.3A1 1 0 0 0 8 5.2z" fill={cor} /></Svg>
);
export const Camera = ({ cor, tamanho = 26 }: P) => (
  <Svg {...base(tamanho)}>
    <Path d="M4 8.5h3l1.8-3h6.4l1.8 3h3v10.5H4z" {...traco(cor, 1.9)} />
    <Circle cx={12} cy={13.5} r={3.5} {...traco(cor, 1.9)} />
  </Svg>
);
export const Escudo = ({ cor, tamanho = 22, preenchido }: P & { preenchido?: string }) => (
  <Svg {...base(tamanho)}>
    <Path d="M12 2.8l7.5 2.8v6.1c0 4.7-3.2 8.1-7.5 9.6-4.3-1.5-7.5-4.9-7.5-9.6V5.6z" fill={preenchido ?? 'none'} {...traco(cor, 1.9)} />
    <Path d="M8.6 12.2l2.4 2.4 4.5-4.8" {...traco(cor, 2)} />
  </Svg>
);
export const Fogo = ({ tamanho = 30, cor = paleta.limao, miolo = paleta.amarelo }: { tamanho?: number; cor?: string; miolo?: string }) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
    <Path d="M12 2.2c1 3.5 5.2 5.6 5.2 10.6A5.2 5.2 0 0 1 6.8 12.8c0-2 1-3.6 2-4.6 0 2 1 3.1 2 3.1 0-3-.5-6.1 1.2-9.1z" fill={cor} />
    <Path d="M12 12.1c.6 1.4 2.3 2.2 2.3 4.1a2.3 2.3 0 0 1-4.6 0c0-1 .6-1.9 1.2-2.4.1.8.5 1.2 1 1.2 0-1-.3-2 .1-2.9z" fill={miolo} />
  </Svg>
);
export const Raio = ({ cor, tamanho = 18 }: P) => (
  <Svg {...base(tamanho)}><Path d="M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z" fill={cor} /></Svg>
);
export const Exportar = ({ cor, tamanho = 20 }: P) => (
  <Svg {...base(tamanho)}><Path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" {...traco(cor)} /></Svg>
);
export const Lixeira = ({ cor, tamanho = 20 }: P) => (
  <Svg {...base(tamanho)}><Path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l.8 12.4A1.6 1.6 0 0 0 8.9 20.5h6.2a1.6 1.6 0 0 0 1.6-1.6l.8-12.4M10 10.5v6M14 10.5v6" {...traco(cor)} /></Svg>
);
export const Lua = ({ cor, tamanho = 20 }: P) => (
  <Svg {...base(tamanho)}><Path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" {...traco(cor)} /></Svg>
);
export const Sol = ({ cor, tamanho = 20 }: P) => (
  <Svg {...base(tamanho)}>
    <Circle cx={12} cy={12} r={4} {...traco(cor)} />
    <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...traco(cor)} />
  </Svg>
);
export const Celular = ({ cor, tamanho = 20 }: P) => (
  <Svg {...base(tamanho)}>
    <Rect x={6.5} y={2.5} width={11} height={19} rx={2.5} {...traco(cor)} />
    <Path d="M10.5 18.5h3" {...traco(cor)} />
  </Svg>
);
export const Fala = ({ cor, tamanho = 20 }: P) => (
  <Svg {...base(tamanho)}><Path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H11l-4.5 3.5v-3.5h-2a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" {...traco(cor)} /></Svg>
);
export const Alvo = ({ cor, tamanho = 20 }: P) => (
  <Svg {...base(tamanho)}>
    <Circle cx={12} cy={12} r={8.5} {...traco(cor)} />
    <Circle cx={12} cy={12} r={4} {...traco(cor)} />
    <Circle cx={12} cy={12} r={0.9} fill={cor} />
  </Svg>
);

// Bola de tênis: feltro limão com luz no alto e as duas costuras.
export function Bola({ tamanho = 24, costura = paleta.amarelo, id = 'b' }: { tamanho?: number; costura?: string; id?: string }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={`luz-${id}`} cx="36%" cy="30%" r="72%">
          <Stop offset="0" stopColor="#F4FFAE" />
          <Stop offset="0.55" stopColor={paleta.limao} />
          <Stop offset="1" stopColor="#A9CC1E" />
        </RadialGradient>
      </Defs>
      <Circle cx={24} cy={24} r={23} fill={`url(#luz-${id})`} />
      <Path d="M9.5 6.8c6.3 4.6 8.8 10.4 8.8 17.2S15.8 36.6 9.5 41.2" stroke={costura} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M38.5 6.8c-6.3 4.6-8.8 10.4-8.8 17.2s2.5 12.6 8.8 17.2" stroke={costura} strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// Linhas de quadra (os arcos da logo), decoração discreta das superfícies verdes.
export function LinhasQuadra({ cor, largura, altura }: { cor: string; largura: number; altura: number }) {
  return (
    <Svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Path d={`M${largura * 0.58} -10 C ${largura * 0.62} ${altura * 0.45}, ${largura * 0.88} ${altura * 0.7}, ${largura + 20} ${altura * 0.74}`} stroke={cor} strokeWidth={2} fill="none" />
      <Path d={`M-20 ${altura * 0.86} C ${largura * 0.3} ${altura * 0.66}, ${largura * 0.7} ${altura * 0.7}, ${largura + 20} ${altura * 1.02}`} stroke={cor} strokeWidth={2} fill="none" />
    </Svg>
  );
}
