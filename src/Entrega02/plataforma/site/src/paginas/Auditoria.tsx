import { useEffect, useState } from 'react';
import { api } from '../api';

type Linha = { id: number; em: string; acao: string; recurso: string };

export function Auditoria() {
  const [itens, setItens] = useState<Linha[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    void api.auditoria().then((pagina) => {
      if (vivo) setItens(pagina.itens);
    }).catch((e: unknown) => {
      if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível ler a auditoria.');
    });
    return () => { vivo = false; };
  }, []);

  return (
    <main>
      <h1>Auditoria</h1>
      {erro && <p role="alert">{erro}</p>}
      <table>
        <thead>
          <tr><th>Ação</th><th>Recurso</th><th>Hora</th></tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id}>
              <td>{item.acao}</td>
              <td>{item.recurso}</td>
              <td>{new Date(item.em).toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
