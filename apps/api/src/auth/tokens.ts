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

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof decoded === 'string' || (decoded as jwt.JwtPayload).typ !== 'refresh') {
    throw new Error('not a refresh token');
  }
  return { sub: String(decoded.sub) };
}

export const REFRESH_COOKIE = 'smtp_saas_rt';
