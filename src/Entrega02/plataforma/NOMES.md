# Nomes na Azure

Implantação em **centralus**, grupo `rg-nockhug-pi`, em 02/11/2026. Sem segredos e sem IP.

| Recurso | Nome | Hostname |
|---------|------|----------|
| SQL server | `sql-nockhug-pi-61a461` | `sql-nockhug-pi-61a461.database.windows.net` |
| Banco | `nockhug` | free offer, `useFreeLimit`, esgotamento `AutoPause` |
| Static Web App | `stapp-nockhug-pi` | `nice-flower-09deffb10.6.azurestaticapps.net` |
| Ambiente | `cae-nockhug-pi` | centralus, ConsumptionOnly, sem perfil dedicado |
| Container App | `ca-nockhug-pi-61a461` | `ca-nockhug-pi-61a461.orangerock-9c5c28fb.centralus.azurecontainerapps.io` |
| Registro | `acrnockhugpi61a461` | Basic. A imagem fica nele para a réplica voltar de zero |

A API está em Container Apps, consumption, com no mínimo 0 réplicas e no máximo 1. CPU 0,25 e memória 0,5Gi. A cota de App Service nesta assinatura é 0, então o plano não foi criado.

Regiões da política: `brazilsouth`, `centralus`, `canadacentral`, `spaincentral` e `southafricanorth`. Dessas, só `centralus` oferece Static Web App Free.
