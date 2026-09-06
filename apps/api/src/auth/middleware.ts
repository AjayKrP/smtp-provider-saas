import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../http/errors.js';
import { verifyAccessToken } from './tokens.js';

export interface AuthContext {
  userId: string;
  organizationId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing bearer token');
  try {
    const claims = verifyAccessToken(header.slice('Bearer '.length));
    req.auth = { userId: claims.sub, organizationId: claims.org };
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

export function auth(req: Request): AuthContext {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth;
}
