import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErroApi, api, papelDoToken, type Treino } from '../api';

export function Treinos() {
  const autor = papelDoToken() === 'autor';
  const [rascunhos, setRascunhos] = useState<Treino[]>([]);
  const [publicados, setPublicados] = useState<Treino[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const catalogo = await api.publicados();
        const meus = autor ? await api.rascunhos().catch((e: unknown) => (e instanceof ErroApi ? { itens: [] } : Promise.reject(e))) : { itens: [] };
        if (!vivo) return;
        setPublicados(catalogo.itens);
        setRascunhos(meus.itens);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar os treinos.');
      }
    })();
    return () => { vivo = false; };
  }, [autor]);

  const vazio = rascunhos.length === 0 && publicados.length === 0;
  return (
    <main>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h1>Treinos</h1>
        {autor && <Link to="/treinos/novo">Novo treino</Link>}
      </div>
      {erro && <p role="alert">{erro}</p>}
      {vazio && !erro && <p>Nenhum treino ainda.</p>}
      {autor && rascunhos.length > 0 && (
        <section className="cartao">
          <h2>Rascunhos</h2>
          <ul>{rascunhos.map((t) => <li key={t.id}><Link to={`/treinos/${t.id}`}>{t.nome}</Link></li>)}</ul>
        </section>
      )}
      {publicados.length > 0 && (
        <section className="cartao">
          <h2>Publicados</h2>
          <ul>{publicados.map((t) => <li key={t.id}><Link to={`/treinos/${t.id}`}>{t.nome}</Link></li>)}</ul>
        </section>
      )}
    </main>
  );
}
