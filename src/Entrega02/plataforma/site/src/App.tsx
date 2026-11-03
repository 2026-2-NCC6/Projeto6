import { Navigate, Route, Routes } from 'react-router-dom';
import { lerToken, papelDoToken } from './api';
import { Layout } from './Layout';
import { Auditoria } from './paginas/Auditoria';
import { Entrar } from './paginas/Entrar';
import { Ficha } from './paginas/Ficha';
import { SessaoDetalhe } from './paginas/SessaoDetalhe';
import { Sessoes } from './paginas/Sessoes';
import { Treinos } from './paginas/Treinos';
import { Versoes } from './paginas/Versoes';

function Protegido() {
  if (!lerToken()) return <Navigate to="/entrar" replace />;
  return <Layout />;
}

function Inicio() {
  return <Navigate to={papelDoToken() === 'praticante' ? '/sessoes' : '/treinos'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route element={<Protegido />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/treinos" element={<Treinos />} />
        <Route path="/treinos/novo" element={<Ficha novo />} />
        <Route path="/treinos/:id" element={<Ficha />} />
        <Route path="/treinos/:id/versoes" element={<Versoes />} />
        <Route path="/sessoes" element={<Sessoes />} />
        <Route path="/sessoes/:id" element={<SessaoDetalhe />} />
        <Route path="/auditoria" element={<Auditoria />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
