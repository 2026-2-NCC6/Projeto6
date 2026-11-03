import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import type { Armazenamento } from './armazenamento.js';
import { LimiteEntrar } from './auth.js';
import { falha, middlewareErro, responderErro } from './erros.js';
import { LIMITE_CORPO, segredoAceito } from './limites.js';
import { middlewareLog } from './log.js';
import { registrarRotas } from './rotas.js';

export type OpcoesApp = {
  armazenamento: Armazenamento;
  jwtSecret: string;
  siteOrigem: string;
  escreverLog?: (linha: string) => void;
  limiteEntrar?: number;
  verificarBanco?: () => Promise<void>;
  producao?: boolean;
};

export function lerOpenapiDoDisco(): string {
  return readFileSync(fileURLToPath(new URL('../openapi.yaml', import.meta.url)), 'utf8');
}

export function criarApp(opcoes: OpcoesApp): Express {
  const nodeEnv = opcoes.producao ? 'production' : process.env.NODE_ENV;
  if (!segredoAceito(opcoes.jwtSecret, nodeEnv === 'production' ? 'production' : nodeEnv)) {
    throw new Error('JWT_SECRET com menos de 32 caracteres impede o boot.');
  }
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(middlewareLog(opcoes.escreverLog ?? ((linha) => console.log(linha))));
  app.use(cors({
    origin: opcoes.siteOrigem,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'If-Match', 'Idempotency-Key'],
    credentials: false,
  }));
  app.use('/v1', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: LIMITE_CORPO }));
  registrarRotas(app, {
    armazenamento: opcoes.armazenamento,
    jwtSecret: opcoes.jwtSecret,
    limite: new LimiteEntrar(opcoes.limiteEntrar ?? 30),
    verificarBanco: opcoes.verificarBanco ?? (async () => {}),
    lerOpenapi: lerOpenapiDoDisco,
  });
  app.use('/v1', (req, res) => {
    responderErro(req, res, falha(404, 'nao_encontrado', 'Não encontrado.'));
  });
  app.use(middlewareErro);
  return app;
}
