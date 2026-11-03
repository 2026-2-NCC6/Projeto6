import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErroApi, api, papelDoToken, type Treino } from '../api';
import { PRESETS, REGRA_XP, linhasPrevia, presetDaVelocidade, type PresetNome } from '../previa';

type Estado = {
  nome: string;
  bolas: number;
  series: number;
  descanso: number;
  livre: boolean;
  preset: PresetNome | '';
  categoria: string;
  objetivo: string;
  nivel: string;
};

const INICIAL: Estado = {
  nome: '',
  bolas: 10,
  series: 3,
  descanso: 30,
  livre: false,
  preset: '',
  categoria: 'personalizado',
  objetivo: 'golpes',
  nivel: 'intermediario',
};

function corpoDe(estado: Estado) {
  const livre = estado.livre;
  return {
    nome: estado.nome.trim(),
    bolasPorSerie: livre ? 0 : estado.bolas,
    series: livre ? 0 : estado.series,
    descansoS: livre ? 0 : estado.descanso,
    categoria: estado.categoria,
    objetivo: estado.objetivo,
    nivel: estado.nivel,
    publico: 'adulto',
    licenca: 'uso-academico',
    remuneracao: 'gratuito',
    ...(estado.preset ? { preset: estado.preset, velocidade: { lancador: PRESETS[estado.preset].lancador, alimentador: PRESETS[estado.preset].alimentador } } : {}),
  };
}

function estadoDe(doc: Treino): Estado {
  const livre = doc.bolasPorSerie === 0;
  return {
    nome: doc.nome,
    bolas: livre ? 10 : doc.bolasPorSerie ?? 10,
    series: livre ? 3 : doc.series ?? 3,
    descanso: livre ? 30 : doc.descansoS ?? 30,
    livre,
    preset: presetDaVelocidade(doc.velocidade),
    categoria: doc.categoria ?? 'personalizado',
    objetivo: doc.objetivo ?? 'golpes',
    nivel: doc.nivel ?? 'intermediario',
  };
}

function faltando(estado: Estado): string[] {
  const lista: string[] = [];
  if (!estado.nome.trim()) lista.push('nome');
  if (!estado.livre) {
    if (!Number.isInteger(estado.bolas) || estado.bolas < 5 || estado.bolas > 60 || (estado.bolas - 5) % 5 !== 0) lista.push('bolas por série');
    if (!Number.isInteger(estado.series) || estado.series < 1 || estado.series > 10) lista.push('séries');
    if (!Number.isInteger(estado.descanso) || estado.descanso < 10 || estado.descanso > 120 || (estado.descanso - 10) % 5 !== 0) lista.push('descanso');
  }
  if (!estado.preset) lista.push('velocidade');
  if (!estado.categoria) lista.push('categoria');
  if (!estado.objetivo) lista.push('objetivo');
  if (!estado.nivel) lista.push('nível');
  return lista;
}

export function Ficha({ novo = false }: { novo?: boolean }) {
  const { id } = useParams();
  const navegar = useNavigate();
  const autor = papelDoToken() === 'autor';
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const [gravado, setGravado] = useState(novo ? '' : JSON.stringify(corpoDe(INICIAL)));
  const [versao, setVersao] = useState(0);
  const [status, setStatus] = useState<'rascunho' | 'publicado'>('rascunho');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState('');
  const [acao, setAcao] = useState<'salvar' | 'publicar' | 'revisao' | null>(null);
  const [pronto, setPronto] = useState(novo);

  const aplicar = (doc: Treino) => {
    const proximo = estadoDe(doc);
    setEstado(proximo);
    setGravado(JSON.stringify(corpoDe(proximo)));
    setVersao(doc.versao);
    setStatus(doc.status);
  };

  const recarregar = async () => {
    if (!id) return;
    aplicar(await api.obterTreino(id));
  };

  useEffect(() => {
    if (novo || !id) return;
    let vivo = true;
    void api.obterTreino(id).then((doc) => {
      if (!vivo) return;
      aplicar(doc);
      setPronto(true);
    }).catch((e: unknown) => {
      if (vivo) setMensagem(e instanceof Error ? e.message : 'Treino não encontrado.');
    });
    return () => { vivo = false; };
  }, [id, novo]);

  if (!autor) return <p>Só o autor cria e publica treino. A lista de sessões continua disponível.</p>;

  const corpo = corpoDe(estado);
  const sujo = JSON.stringify(corpo) !== gravado;
  const pendencias = faltando(estado);
  const somenteLeitura = !novo && status === 'publicado';
  const previa = linhasPrevia({ bolasPorSerie: corpo.bolasPorSerie, series: corpo.series, descansoS: corpo.descansoS });
  const mudar = (parte: Partial<Estado>) => setEstado((atual) => ({ ...atual, ...parte }));

  const salvar = async () => {
    if (acao) return;
    setAcao('salvar');
    setCampos({});
    setMensagem('');
    try {
      if (novo) {
        const criado = await api.criarTreino(corpo);
        navegar(`/treinos/${criado.id}`);
        return;
      }
      if (!id) return;
      aplicar(await api.atualizarTreino(id, corpo, versao));
    } catch (e) {
      if (e instanceof ErroApi && e.status === 422) setCampos(e.campos);
      else if (e instanceof ErroApi && e.status === 409) {
        setMensagem(e.message);
        await recarregar();
      } else setMensagem(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setAcao(null);
    }
  };

  const publicar = async () => {
    if (acao || !id || pendencias.length > 0) return;
    setAcao('publicar');
    setCampos({});
    setMensagem('');
    try {
      let versaoAtual = versao;
      if (sujo) {
        const salvo = await api.atualizarTreino(id, corpo, versaoAtual);
        versaoAtual = salvo.versao;
        aplicar(salvo);
      }
      aplicar(await api.publicar(id, versaoAtual));
    } catch (e) {
      if (e instanceof ErroApi && e.status === 422) setCampos(e.campos);
      else if (e instanceof ErroApi && e.status === 409) {
        setMensagem(e.message);
        await recarregar();
      } else setMensagem(e instanceof Error ? e.message : 'Não foi possível publicar.');
    } finally {
      setAcao(null);
    }
  };

  const revisar = async () => {
    if (acao || !id) return;
    setAcao('revisao');
    setMensagem('');
    try {
      aplicar(await api.abrirRevisao(id));
    } catch (e) {
      if (e instanceof ErroApi && e.status === 409) {
        setMensagem(e.message);
        await recarregar();
      } else setMensagem(e instanceof Error ? e.message : 'Não foi possível abrir a revisão.');
    } finally {
      setAcao(null);
    }
  };

  if (!pronto) return <p>Carregando treino.</p>;

  return (
    <main>
      <h1>{novo ? 'Novo treino' : estado.nome || 'Treino'}</h1>
      <p>Situação: {novo ? 'rascunho' : status}</p>
      <form className="cartao grade" onSubmit={(evento) => { evento.preventDefault(); void salvar(); }}>
        <div>
          <label htmlFor="nome">Nome</label>
          <input id="nome" value={estado.nome} disabled={somenteLeitura} aria-invalid={!!campos.nome} onChange={(e) => mudar({ nome: e.target.value })} />
          {campos.nome && <p id="nome-erro" role="alert">{campos.nome}</p>}
        </div>
        <label><input type="checkbox" checked={estado.livre} disabled={somenteLeitura} onChange={(e) => mudar({ livre: e.target.checked })} /> Livre</label>
        <div>
          <label htmlFor="bolas">Bolas por série</label>
          <input id="bolas" type="number" min={5} max={60} step={5} value={estado.livre ? 0 : estado.bolas} disabled={somenteLeitura || estado.livre} onChange={(e) => mudar({ bolas: Number(e.target.value) })} />
          {campos.bolasPorSerie && <p role="alert">{campos.bolasPorSerie}</p>}
        </div>
        <div>
          <label htmlFor="series">Séries</label>
          <input id="series" type="number" min={1} max={10} step={1} value={estado.livre ? 0 : estado.series} disabled={somenteLeitura || estado.livre} onChange={(e) => mudar({ series: Number(e.target.value) })} />
          {campos.series && <p role="alert">{campos.series}</p>}
        </div>
        <div>
          <label htmlFor="descanso">Descanso</label>
          <input id="descanso" type="number" min={10} max={120} step={5} value={estado.livre ? 0 : estado.descanso} disabled={somenteLeitura || estado.livre} onChange={(e) => mudar({ descanso: Number(e.target.value) })} />
          {campos.descansoS && <p role="alert">{campos.descansoS}</p>}
        </div>
        <fieldset disabled={somenteLeitura}>
          <legend>Velocidade</legend>
          <div className="linha">
            {(Object.keys(PRESETS) as PresetNome[]).map((nome) => (
              <button key={nome} type="button" aria-pressed={estado.preset === nome} onClick={() => mudar({ preset: nome })}>{PRESETS[nome].rotulo}</button>
            ))}
          </div>
          {campos.velocidade && <p role="alert">{campos.velocidade}</p>}
        </fieldset>
        <div>
          <label htmlFor="categoria">Categoria</label>
          <select id="categoria" value={estado.categoria} disabled={somenteLeitura} onChange={(e) => mudar({ categoria: e.target.value })}>
            <option value="personalizado">Personalizado</option>
            <option value="aquecimento">Aquecimento</option>
            <option value="resistencia">Resistência</option>
            <option value="livre">Livre</option>
          </select>
        </div>
        <div>
          <label htmlFor="objetivo">Objetivo</label>
          <select id="objetivo" value={estado.objetivo} disabled={somenteLeitura} onChange={(e) => mudar({ objetivo: e.target.value })}>
            <option value="golpes">Golpes</option>
            <option value="condicionamento">Condicionamento</option>
            <option value="lazer">Lazer</option>
            <option value="competir">Competir</option>
          </select>
        </div>
        <div>
          <label htmlFor="nivel">Nível</label>
          <select id="nivel" value={estado.nivel} disabled={somenteLeitura} onChange={(e) => mudar({ nivel: e.target.value })}>
            <option value="iniciante">Iniciante</option>
            <option value="intermediario">Intermediário</option>
            <option value="avancado">Avançado</option>
          </select>
        </div>
        <p>Licença de uso acadêmico. Remuneração gratuita.</p>
        {mensagem && <p role="alert">{mensagem}</p>}
        {!somenteLeitura && <button className="principal" type="submit" disabled={acao !== null || !estado.nome.trim()}>{acao === 'salvar' ? 'Salvando...' : 'Salvar'}</button>}
      </form>

      <section className="cartao" aria-label="Prévia da sequência">
        <h2>Prévia da sequência</h2>
        <ol>
          {previa.map((linha, indice) => <li key={indice}>{linha}</li>)}
        </ol>
        <p>{REGRA_XP}</p>
      </section>

      {!novo && status === 'rascunho' && (
        <div className="cartao">
          {pendencias.length > 0 && <p>Falta: {pendencias.join(', ')}.</p>}
          <button className="principal" type="button" disabled={acao !== null || pendencias.length > 0} onClick={() => void publicar()}>
            {acao === 'publicar' ? 'Salvando...' : 'Publicar'}
          </button>
        </div>
      )}
      {!novo && status === 'publicado' && (
        <div className="cartao">
          <button className="principal" type="button" disabled={acao !== null} onClick={() => void revisar()}>
            {acao === 'revisao' ? 'Salvando...' : 'Abrir revisão'}
          </button>
        </div>
      )}
      {!novo && id && <p><Link to={`/treinos/${id}/versoes`}>Versões publicadas</Link></p>}
    </main>
  );
}
