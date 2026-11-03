# Plataforma mãe

Site, API e banco da Smart Tennis Arena. O treino na quadra continua no celular e na lançadora. A nuvem guarda o catálogo publicado e as sessões já encerradas.

E-mails semente, sem senha neste arquivo: `autor@nockhug.local` e `praticante@nockhug.local`.

A base da API não termina com `/v1`. O cliente concatena `/v1/...`.

## Rodar na máquina

Na pasta `api`, copie `.env.example` para `.env` e preencha. `JWT_SECRET` precisa de pelo menos 32 caracteres (`openssl rand -base64 32`). As senhas semente ficam em `SEED_AUTOR_SENHA` e `SEED_PRATICANTE_SENHA`. Sem `SQL_SERVER`, a API usa memória.

```bash
cd api
npm install
npm run dev
```

O processo escuta em `http://127.0.0.1:3099`. `GET /v1/saude` não abre banco.

Na pasta `site`:

```bash
cd site
npm install
VITE_API_URL=http://127.0.0.1:3099 npm run dev
```

O site abre em `http://127.0.0.1:5173`. O JWT fica em `sessionStorage`, na chave `nockhug.plataforma.jwt`.

No app, a variável é `EXPO_PUBLIC_API_URL`, com o mesmo formato, sem `/v1`. Vazia, o app não chama a nuvem.

## Testar

A partir desta pasta:

```bash
(cd api && npm test && npm run typecheck)
(cd site && npm run typecheck && npm run build)
(cd ../app && npm test && npm run typecheck)
(cd e2e && node rodar.mjs)
```

`node e2e/fumaça.mjs` sem `API_URL` imprime `fumaça ignorada` e sai com código 0. O roteiro de celular está em `e2e/ROTEIRO-CELULAR.md` e não afirma que já foi executado.

O teste de Azure SQL em `api` termina com skip quando `SQL_SERVER` não está definido.

## Implantar

A API está no Azure Container Apps porque a cota do App Service nesta assinatura é 0; ela deve ir a zero réplica, e uma réplica que permanecer ligada gasta o crédito de estudante.

Não rode estes comandos sem `az login` na assinatura de estudante. Em 02/11/2026 o token da CLI estava expirado.

Crie o grupo numa região e, se a cota do F1 ou do SQL gratuito falhar, apague o grupo só se ele tiver sido criado nessa tentativa e não tiver dados, e tente a próxima: `brazilsouth`, depois `eastus2`, depois `westus3`. Se o what-if mostrar custo mensal diferente de zero, não aplique.

```bash
az group create --name rg-nockhug-pi --location brazilsouth
az deployment group what-if \
  --resource-group rg-nockhug-pi \
  --template-file infra/main.bicep \
  --parameters entraAdminLogin=<login Entra> entraAdminObjectId=<object id>
az deployment group create \
  --resource-group rg-nockhug-pi \
  --template-file infra/main.bicep \
  --parameters entraAdminLogin=<login Entra> entraAdminObjectId=<object id>
```

O Bicep não tem senha de SQL. O administrador do servidor é Entra ID, com `azureADOnlyAuthentication`. A regra de firewall no arquivo é a regra especial dos serviços da Azure. A regra `dev-uma-vez`, com o IP do notebook, é criada na hora da migração e não entra no Git. Rode o what-if antes de um `create`: o modelo não cria mais App Service.

Depois do create: `npm run migrar` e `npm run seed` na pasta `api`, com `SQL_SERVER` apontando para o hostname. Em seguida, quem é administrador Entra do servidor cria o usuário da identidade do Container App. O `<sufixo>` é a saída `sufixo` do deployment. Essa identidade não roda DDL.

```sql
CREATE USER [ca-nockhug-pi-<sufixo>] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [ca-nockhug-pi-<sufixo>];
ALTER ROLE db_datawriter ADD MEMBER [ca-nockhug-pi-<sufixo>];
```

Os segredos `jwt-secret`, `seed-autor` e `seed-praticante` não vão no Bicep. Gere o JWT fora do Git e grave com `az containerapp secret set`. O site recebe `VITE_API_URL` na hora do build, apontando para `https://<container app>`, sem `/v1`.

A imagem da API continua `nockhug-api:entrega02`. O site vai pelo Static Web Apps, com `outputLocation` `dist`. Os hostnames ficam neste diretório, em `NOMES.md`, sem segredo.

## Nota

O exemplo de JSON da spec mostra `duracaoEstimadaMin: 2` para 3 séries de 10 bolas e descanso de 30 s. A publicação usa `duracaoEstimadaMin` do app, com 3000 ms por bola, e esse caso dá 3.
