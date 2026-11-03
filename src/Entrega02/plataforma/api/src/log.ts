import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      usuario?: { id: string; email: string; papel: string };
    }
  }
}

export function middlewareLog(escrever: (linha: string) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.requestId = `req_${randomBytes(8).toString('hex')}`;
    res.setHeader('X-Request-Id', req.requestId);
    const inicio = Date.now();
    res.on('finish', () => {
      escrever(JSON.stringify({
        requestId: req.requestId,
        metodo: req.method,
        caminho: req.path,
        status: res.statusCode,
        duracaoMs: Date.now() - inicio,
        usuarioId: req.usuario?.id ?? null,
      }));
    });
    next();
  };
}
