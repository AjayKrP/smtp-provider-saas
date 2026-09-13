import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface AccessClaims {
  sub: string; // userId
  org: string; // organizationId
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
}

export function verifyAccessToken(token: string): AccessClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === 'string') throw new Error('malformed token');
  return { sub: String(decoded.sub), org: String((decoded as jwt.JwtPayload).org) };
}

/** `ver` is the user's sessionVersion at sign-in; a bump invalidates the token. */
export function signRefreshToken(userId: string, sessionVersion: number): string {
  return jwt.sign({ sub: userId, typ: 'refresh', ver: sessionVersion }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  });
}

export function verifyRefreshToken(token: string): { sub: string; ver: number } {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof decoded === 'string' || (decoded as jwt.JwtPayload).typ !== 'refresh') {
    throw new Error('not a refresh token');
  }
  // Tokens issued before session versioning carry no `ver`; they match version 0.
  return { sub: String(decoded.sub), ver: Number((decoded as jwt.JwtPayload).ver ?? 0) };
}

export const REFRESH_COOKIE = 'smtp_saas_rt';
