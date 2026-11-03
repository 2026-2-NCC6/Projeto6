import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Sessao } from '../api';

const ENCERRAMENTO: Record<string, string> = {
  concluida: 'Concluída',
  praticante: 'Praticante',
  parada_segura: 'Parada segura',
};

function bolas(s: Sessao): number {
  return s.series.reduce((total, serie) => total + serie.bolas, 0);
}

export function Sessoes() {
  const [itens, setItens] = useState<Sessao[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    void api.sessoes().then((pagina) => {
      if (vivo) setItens(pagina.itens);
    }).catch((e: unknown) => {
      if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível listar as sessões.');
    });
    return () => { vivo = false; };
  }, []);

  return (
    <main>
      <h1>Sessões</h1>
      {erro && <p role="alert">{erro}</p>}
      {itens && itens.length === 0 && <p>Nenhuma sessão ainda.</p>}
      {itens && itens.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Treino</th>
              <th>Quando</th>
              <th>Bolas</th>
              <th>XP</th>
              <th>Encerramento</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((s) => (
              <tr key={s.id}>
                <td><Link to={`/sessoes/${s.id}`}>{s.treino.nome}</Link></td>
                <td>{new Date(s.inicio).toLocaleString('pt-BR')}</td>
                <td>{bolas(s)} bolas</td>
                <td>{s.xp}</td>
                <td>{ENCERRAMENTO[s.encerradaPor] ?? s.encerradaPor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
