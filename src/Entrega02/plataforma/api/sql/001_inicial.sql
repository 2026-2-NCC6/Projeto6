-- Única migração da plataforma mãe. A identidade do App Service não roda este arquivo.
-- Quem aplica é npm run migrar, com o token Entra de quem está logado no az.

IF OBJECT_ID(N'dbo.usuarios', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.usuarios (
    id nvarchar(40) NOT NULL PRIMARY KEY,
    email nvarchar(200) NOT NULL UNIQUE,
    senha_hash nvarchar(200) NOT NULL,
    nome nvarchar(80) NOT NULL,
    papel nvarchar(20) NOT NULL CHECK (papel IN (N'autor', N'praticante')),
    criado_em datetimeoffset NOT NULL
  );
END;

IF OBJECT_ID(N'dbo.treinos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.treinos (
    id nvarchar(40) NOT NULL PRIMARY KEY,
    autor_id nvarchar(40) NOT NULL,
    status nvarchar(20) NOT NULL CHECK (status IN (N'rascunho', N'publicado')),
    versao int NOT NULL,
    json nvarchar(max) NOT NULL,
    atualizado_em datetimeoffset NOT NULL
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_treinos_status_atualizado' AND object_id = OBJECT_ID(N'dbo.treinos'))
  CREATE INDEX ix_treinos_status_atualizado ON dbo.treinos (status, atualizado_em DESC, id);

IF OBJECT_ID(N'dbo.treino_versoes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.treino_versoes (
    treino_id nvarchar(40) NOT NULL,
    versao int NOT NULL,
    json nvarchar(max) NOT NULL,
    publicado_em datetimeoffset NOT NULL,
    CONSTRAINT pk_treino_versoes PRIMARY KEY (treino_id, versao)
  );
END;

IF OBJECT_ID(N'dbo.sessoes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sessoes (
    id nvarchar(40) NOT NULL PRIMARY KEY,
    praticante_id nvarchar(40) NOT NULL,
    treino_id nvarchar(40) NULL,
    inicio bigint NOT NULL,
    json nvarchar(max) NOT NULL,
    recebida_em datetimeoffset NOT NULL
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sessoes_inicio' AND object_id = OBJECT_ID(N'dbo.sessoes'))
  CREATE INDEX ix_sessoes_inicio ON dbo.sessoes (inicio DESC, id);

IF OBJECT_ID(N'dbo.auditoria', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.auditoria (
    id bigint IDENTITY NOT NULL PRIMARY KEY,
    em datetimeoffset NOT NULL,
    ator_id nvarchar(40) NULL,
    acao nvarchar(40) NOT NULL,
    recurso nvarchar(80) NOT NULL,
    request_id nvarchar(40) NOT NULL
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_auditoria_em' AND object_id = OBJECT_ID(N'dbo.auditoria'))
  CREATE INDEX ix_auditoria_em ON dbo.auditoria (em DESC, id);
