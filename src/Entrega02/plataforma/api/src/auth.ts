import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import type { Papel, UsuarioInterno, UsuarioPublico } from './armazenamento.js';
import { falha } from './erros.js';

const OITO_HORAS = 8 * 60 * 60;

export type UsuarioToken = { id: string; email: string; papel: Papel };

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

let hashFalsoCache: string | null = null;

export async function hashFalso(): Promise<string> {
  if (!hashFalsoCache) hashFalsoCache = await bcrypt.hash('nockhug-comparacao-falsa', 10);
  return hashFalsoCache;
}

export async function senhaConfere(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export function emitirToken(usuario: UsuarioInterno, secret: string): { token: string; expiraEm: number; usuario: UsuarioPublico } {
  const token = jwt.sign({ sub: usuario.id, papel: usuario.papel, email: usuario.email }, secret, {
    algorithm: 'HS256',
    expiresIn: OITO_HORAS,
  });
  const dec = jwt.decode(token) as { exp: number };
  return {
    token,
    expiraEm: dec.exp,
    usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome, papel: usuario.papel },
  };
}

export function lerToken(req: Request, secret: string): UsuarioToken | null {
  const header = req.header('authorization') ?? '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { sub?: unknown; papel?: unknown; email?: unknown };
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    if (payload.papel !== 'autor' && payload.papel !== 'praticante') return null;
    return { id: payload.sub, email: payload.email, papel: payload.papel };
  } catch {
    return null;
  }
}

export function exigirUsuario(req: Request, secret: string, papeis?: Papel[]): UsuarioToken {
  const header = req.header('authorization');
  if (!header) throw falha(401, 'nao_autenticado', 'Autenticação necessária.');
  const usuario = lerToken(req, secret);
  if (!usuario) throw falha(401, 'nao_autenticado', 'Autenticação necessária.');
  if (papeis && !papeis.includes(usuario.papel)) throw falha(403, 'proibido', 'Você não pode fazer isso.');
  return usuario;
}

export class LimiteEntrar {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max = 30,
    private readonly janelaMs = 60_000,
  ) {}

  tentar(ip: string, agora = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
    const lista = (this.hits.get(ip) ?? []).filter((t) => agora - t < this.janelaMs);
    if (lista.length >= this.max) {
      const retryAfter = Math.max(1, Math.ceil((lista[0]! + this.janelaMs - agora) / 1000));
      this.hits.set(ip, lista);
      return { ok: false, retryAfter };
    }
    lista.push(agora);
    this.hits.set(ip, lista);
    return { ok: true };
  }
}

export function ipDe(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'desconhecido';
}
