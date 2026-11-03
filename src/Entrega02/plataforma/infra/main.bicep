// Plataforma mãe no nível gratuito.
// Versões mais recentes em `az provider show` nesta assinatura, em 02/11/2026:
// servers e databases 2026-08-01-preview, staticSites 2026-03-01-preview,
// Microsoft.App managedEnvironments e containerApps 2026-07-01,
// Microsoft.ContainerRegistry registries 2026-11-01.
// Não há senha de administrador do SQL neste arquivo.
// JWT_SECRET e as senhas semente ficam fora daqui: entram com `az` depois do create.
// A cota de App Service (Microsoft.Web serverfarms/sites) é 0. Não declarar esses recursos:
// o deployment falha e reverte o grupo.

@description('Região do grupo. Entre as regiões da política, só centralus oferece Static Web App.')
param location string = 'centralus'

@description('Login do administrador Entra do servidor SQL. Não é senha.')
param entraAdminLogin string

@description('Object id do administrador Entra.')
param entraAdminObjectId string

@description('Tenant do administrador Entra.')
param tenantId string = subscription().tenantId

var sufixo = substring(replace(subscription().subscriptionId, '-', ''), 0, 6)
var acrPull = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

// Basic é o menor SKU do registro. Não há SKU gratuito. A imagem precisa permanecer
// lá para a réplica voltar de zero. O login do registro é Entra ID, sem usuário admin.

resource site 'Microsoft.Web/staticSites@2026-03-01-preview' = {
  name: 'stapp-nockhug-pi'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

resource sql 'Microsoft.Sql/servers@2026-08-01-preview' = {
  name: 'sql-nockhug-pi-${sufixo}'
  location: location
  properties: {
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'User'
      login: entraAdminLogin
      sid: entraAdminObjectId
      tenantId: tenantId
      azureADOnlyAuthentication: true
    }
  }
}

// Regra especial documentada que libera os serviços da Azure. Não é a faixa 0.0.0.0–255.255.255.255.
resource regraAzure 'Microsoft.Sql/servers/firewallRules@2026-08-01-preview' = {
  parent: sql
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource banco 'Microsoft.Sql/servers/databases@2026-08-01-preview' = {
  parent: sql
  name: 'nockhug'
  location: location
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
    zoneRedundant: false
    requestedBackupStorageRedundancy: 'Local'
  }
}

resource registro 'Microsoft.ContainerRegistry/registries@2026-11-01' = {
  name: 'acrnockhugpi${sufixo}'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

// ConsumptionOnly: sem perfil dedicado. O perfil dedicado cobra cerca de US$ 0,10 por hora ociosa.
resource ambiente 'Microsoft.App/managedEnvironments@2026-07-01' = {
  name: 'cae-nockhug-pi'
  location: location
  properties: {
    environmentMode: 'ConsumptionOnly'
    zoneRedundant: false
    publicNetworkAccess: 'Enabled'
    peerAuthentication: {
      mtls: {
        enabled: false
      }
    }
    peerTrafficConfiguration: {
      encryption: {
        enabled: false
      }
    }
    appLogsConfiguration: {
      destination: null
    }
  }
}

resource api 'Microsoft.App/containerApps@2026-07-01' = {
  name: 'ca-nockhug-pi-${sufixo}'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: ambiente.id
    configuration: {
      activeRevisionsMode: 'Single'
      // Os valores ficam de fora. Um deploy futuro reaproveita o segredo já gravado com az.
      secrets: [
        { name: 'jwt-secret' }
        { name: 'seed-autor' }
        { name: 'seed-praticante' }
      ]
      registries: [
        {
          server: registro.properties.loginServer
          identity: 'system'
        }
      ]
      ingress: {
        external: true
        targetPort: 3099
        transport: 'http'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${registro.properties.loginServer}/nockhug-api:entrega02'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'PORT', value: '3099' }
            { name: 'NODE_ENV', value: 'production' }
            { name: 'SQL_DATABASE', value: 'nockhug' }
            { name: 'SQL_SERVER', value: '${sql.name}${environment().suffixes.sqlServerHostname}' }
            { name: 'SITE_ORIGEM', value: 'https://${site.properties.defaultHostname}' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'SEED_AUTOR_SENHA', secretRef: 'seed-autor' }
            { name: 'SEED_PRATICANTE_SENHA', secretRef: 'seed-praticante' }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

output sufixo string = sufixo
output apiNome string = api.name
output apiHostname string = api.properties.configuration.ingress.fqdn
output siteHostname string = site.properties.defaultHostname
output sqlServidor string = '${sql.name}${environment().suffixes.sqlServerHostname}'
output apiPrincipalId string = api.identity.principalId
output registroServidor string = registro.properties.loginServer

resource puxarImagem 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registro.id, api.id, acrPull)
  scope: registro
  properties: {
    roleDefinitionId: acrPull
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
