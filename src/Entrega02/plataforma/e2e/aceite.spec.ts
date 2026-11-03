import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:3099';

test('autor publica Cruzado e a sessão volta uma vez', async ({ page, request }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('autor@nockhug.local');
  await page.getByLabel('Senha').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: 'Novo treino' }).click();

  await page.getByLabel('Nome').fill('Cruzado');
  await page.getByLabel('Bolas por série').fill('10');
  await page.getByLabel('Séries').fill('3');
  await page.getByLabel('Descanso').fill('30');
  await page.getByRole('button', { name: 'Salvar' }).click();

  const publicar = page.getByRole('button', { name: 'Publicar' });
  await expect(publicar).toBeDisabled();
  await expect(page.getByText('Falta: velocidade.')).toBeVisible();
  await expect(page.getByText('Série 1 de 3, 10 bolas')).toBeVisible();
  await expect(page.getByText('Série 2 de 3, 10 bolas')).toBeVisible();
  await expect(page.getByText('Série 3 de 3, 10 bolas')).toBeVisible();
  await expect(page.getByText('Descanso 30 s')).toHaveCount(2);

  await page.getByRole('button', { name: 'Forte' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(publicar).toBeEnabled();
  await publicar.click();
  await expect(page.getByText('Situação: publicado')).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();

  const entrada = await request.post(`${API}/v1/entrar`, {
    data: { email: 'praticante@nockhug.local', senha: 'demo1234' },
  });
  expect(entrada.ok()).toBeTruthy();
  const { token } = await entrada.json() as { token: string };
  const catalogo = await request.get(`${API}/v1/treinos?status=publicado`);
  const { itens } = await catalogo.json() as { itens: { id: string; nome: string }[] };
  const cruzado = itens.find((item) => item.nome === 'Cruzado');
  expect(cruzado?.id).toMatch(/^pub-[0-9a-f]{12}$/);

  const sessao = {
    id: 's-demo-1',
    treino: {
      id: cruzado!.id,
      nome: 'Cruzado',
      bolasPorSerie: 10,
      series: 3,
      descansoS: 30,
      padrao: false,
      velocidade: { lancador: 153, alimentador: 77 },
      preset: 'forte',
    },
    inicio: 1762100000000,
    fim: 1762101800000,
    transporte: 'ble',
    series: [{ indice: 1, bolas: 10, inicio: 1762100000000, fim: 1762100060000, motivo: 'serie_concluida' }],
    comandos: [{ ts: 1762100001000, origem: 'voz', transcricao: 'Nock, liga', comando: 'ligar', aceito: true, motivo: null, latenciaMs: 400 }],
    encerradaPor: 'concluida',
    xp: 30,
  };
  const primeira = await request.post(`${API}/v1/sessoes`, {
    headers: { authorization: `Bearer ${token}` },
    data: sessao,
  });
  expect(primeira.status()).toBe(201);
  const segunda = await request.post(`${API}/v1/sessoes`, {
    headers: { authorization: `Bearer ${token}` },
    data: sessao,
  });
  expect(segunda.status()).toBe(200);

  await page.getByLabel('E-mail').fill('autor@nockhug.local');
  await page.getByLabel('Senha').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: 'Sessões' }).click();
  const linha = page.getByRole('row', { name: /Cruzado/ });
  await expect(linha).toHaveCount(1);
  await expect(linha).toContainText('10 bolas');
  await expect(linha).toContainText('30');
});
