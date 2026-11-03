import { Link, Outlet, useNavigate } from 'react-router-dom';
import { apagarToken, papelDoToken } from './api';

export function Layout() {
  const navegar = useNavigate();
  const papel = papelDoToken();
  const sair = () => {
    apagarToken();
    navegar('/entrar');
  };
  return (
    <div className="moldura">
      <header className="topo">
        <strong>NockHug</strong>
        <nav>
          {papel === 'autor' && <Link to="/treinos">Treinos</Link>}
          <Link to="/sessoes">Sessões</Link>
          {papel === 'autor' && <Link to="/auditoria">Auditoria</Link>}
          <button type="button" onClick={sair}>Sair</button>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
