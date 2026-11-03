import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErroApi, api } from '../api';

export function Versoes() {
  const { id = '' } = useParams();
  const [itens, setItens] = useState<{ versao: number; publicadoEm: string; nome: string }[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const lista = await api.versoes(id);
        const completos = await Promise.all(lista.itens.map(async (item) => {
          const doc = await api.versao(id, item.versao);
          return { versao: item.versao, publicadoEm: item.publicadoEm, nome: doc.nome };
        }));
        if (vivo) setItens(completos);
      } catch (e) {
        if (vivo) setErro(e instanceof ErroApi ? 'Nenhuma versão publicada.' : 'Não foi possível ler as versões.');
      }
    })();
    return () => { vivo = false; };
  }, [id]);

  return (
    <main>
      <h1>Versões</h1>
      {erro && <p>{erro}</p>}
      <ul>
        {itens.map((item) => (
          <li key={item.versao}>{item.nome} · versão {item.versao} · {new Date(item.publicadoEm).toLocaleString('pt-BR')}</li>
        ))}
      </ul>
    </main>
  );
}
