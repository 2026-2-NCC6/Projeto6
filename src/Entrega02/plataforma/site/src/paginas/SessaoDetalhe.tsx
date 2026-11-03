import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Sessao } from '../api';

export function SessaoDetalhe() {
  const { id = '' } = useParams();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    void api.sessao(id).then((doc) => {
      if (vivo) setSessao(doc);
    }).catch((e: unknown) => {
      if (vivo) setErro(e instanceof Error ? e.message : 'Sessão não encontrada.');
    });
    return () => { vivo = false; };
  }, [id]);

  if (erro) return <p role="alert">{erro}</p>;
  if (!sessao) return <p>Carregando sessão.</p>;
  return (
    <main>
      <h1>{sessao.treino.nome}</h1>
      <p>XP {sessao.xp}</p>
      <h2>Séries</h2>
      <ul>
        {sessao.series.map((serie) => (
          <li key={serie.indice}>Série {serie.indice}: {serie.bolas} bolas, {serie.motivo}</li>
        ))}
      </ul>
      <h2>Comandos</h2>
      <ul>
        {sessao.comandos.map((comando, indice) => (
          <li key={`${comando.ts}-${indice}`}>{comando.transcricao} · {comando.comando} · {comando.aceito ? 'aceito' : 'recusado'}</li>
        ))}
      </ul>
    </main>
  );
}
