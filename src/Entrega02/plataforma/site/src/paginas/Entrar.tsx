import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErroApi, api, guardarToken, lerToken, papelDoToken } from '../api';

export function Entrar() {
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (lerToken()) return <Navigate to={papelDoToken() === 'praticante' ? '/sessoes' : '/treinos'} replace />;

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setErro('');
    try {
      const resposta = await api.entrar(email.trim(), senha);
      guardarToken(resposta.token);
      navegar(resposta.usuario.papel === 'praticante' ? '/sessoes' : '/treinos');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível entrar.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <main className="moldura">
      <h1>Entrar</h1>
      <form className="cartao grade" onSubmit={(evento) => void enviar(evento)}>
        <div>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p role="alert">{erro}</p>}
        <button className="principal" type="submit" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Entrar'}</button>
      </form>
    </main>
  );
}
