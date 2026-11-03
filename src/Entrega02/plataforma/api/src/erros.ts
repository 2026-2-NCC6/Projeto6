import type { NextFunction, Request, Response } from 'express';

export class ErroHttp extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ErroHttp';
  }
}

export function falha(status: number, code: string, message: string, details: Record<string, unknown> = {}): ErroHttp {
  return new ErroHttp(status, code, message, details);
}

export function invalido(campos: Record<string, string>): ErroHttp {
  return new ErroHttp(422, 'pedido_invalido', 'Algum campo não passou na validação.', { campos });
}

export function responderErro(req: Request, res: Response, erro: ErroHttp): void {
  res.status(erro.status).json({
    error: {
      code: erro.code,
      message: erro.message,
      details: erro.details,
      requestId: req.requestId,
    },
  });
}

export function middlewareErro(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;
  if (err instanceof ErroHttp) {
    responderErro(req, res, err);
    return;
  }
  const bruto = err as { type?: string; status?: number };
  if (bruto?.type === 'entity.too.large' || bruto?.status === 413) {
    responderErro(req, res, falha(413, 'pedido_invalido', 'O corpo passa de 256 KB.'));
    return;
  }
  if (err instanceof SyntaxError) {
    responderErro(req, res, falha(400, 'pedido_invalido', 'O JSON está quebrado.'));
    return;
  }
  responderErro(req, res, falha(500, 'erro_interno', 'Erro interno.'));
}
