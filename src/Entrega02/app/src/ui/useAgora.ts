import { useEffect, useState } from 'react';

// O relógio como estado: o render fica puro e a tela atualiza no intervalo.
export function useAgora(intervaloMs = 60_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return agora;
}
