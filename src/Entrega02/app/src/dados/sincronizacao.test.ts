import type { Treino } from '@/dominio/tipos';
import { marcarEnvio, mesclarTreinos, pendentes, type ItemFila } from './sincronizacao';

const treino = (id: string, nome = 'Local'): Treino => ({
  id,
  nome,
  bolasPorSerie: 10,
  series: 3,
  descansoS: 30,
  padrao: false,
});

const item = (id = 's1'): ItemFila => ({
  id,
  tipo: 'sessao',
  json: '{}',
  tentativas: 0,
  estado: 'pendente',
  ultimoErro: null,
});

test('a mescla não apaga o treino local e não duplica o publicado', () => {
  const local = treino('t-local');
  const publicado = { ...treino('pub-abc', 'Cruzado'), origem: 'plataforma' as const, versaoPublicada: 1 };
  const atualizado = { ...publicado, nome: 'Cruzado novo', versaoPublicada: 2 };
  const lista = mesclarTreinos([local, publicado], [atualizado]);
  expect(lista.map((t) => t.id)).toEqual(['t-local', 'pub-abc']);
  expect(lista[0]).toEqual(local);
  expect(lista[1]?.nome).toBe('Cruzado novo');
  expect(mesclarTreinos([local], [{ ...local, nome: 'Não mexe' }])[0]?.nome).toBe('Local');
  expect(mesclarTreinos([], [treino('t-remoto')])).toEqual([]);
});

test('a fila sai em 201, soma tentativa na rede e para em 409', () => {
  const fila = [item()];
  expect(marcarEnvio(fila, { id: 's1', status: 201 })).toEqual([]);
  expect(marcarEnvio(fila, { id: 's1', status: 200 })).toEqual([]);
  const rede = marcarEnvio(fila, { id: 's1', rede: true });
  expect(rede[0]?.tentativas).toBe(1);
  expect(rede[0]?.estado).toBe('pendente');
  const indisponivel = marcarEnvio(fila, { id: 's1', status: 503 });
  expect(indisponivel[0]?.tentativas).toBe(1);
  expect(indisponivel[0]?.ultimoErro).toBe('503');
  const conflito = marcarEnvio(fila, { id: 's1', status: 409 });
  expect(conflito[0]?.estado).toBe('conflito');
  expect(pendentes(conflito)).toEqual([]);
  expect(pendentes(marcarEnvio(conflito, { id: 's1', rede: true }))).toEqual([]);
});
