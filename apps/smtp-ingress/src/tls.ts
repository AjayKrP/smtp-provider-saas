import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logger } from '@smtp-saas/shared';
import { env } from './env.js';

export interface TlsMaterial {
  key: string;
  cert: string;
}

/**
 * Load the configured PEM cert/key, or generate a throwaway self-signed pair for local
 * development (clients must then disable cert verification).
 */
export function loadTls(): TlsMaterial {
  if (env.SMTP_TLS_CERT_PATH && env.SMTP_TLS_KEY_PATH) {
    return {
      cert: readFileSync(env.SMTP_TLS_CERT_PATH, 'utf8'),
      key: readFileSync(env.SMTP_TLS_KEY_PATH, 'utf8'),
    };
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('SMTP_TLS_CERT_PATH and SMTP_TLS_KEY_PATH are required in production');
  }

  logger.warn('no TLS cert configured — generating a self-signed pair for development');
  const dir = tmpdir();
  const keyPath = join(dir, 'smtp-dev-key.pem');
  const certPath = join(dir, 'smtp-dev-cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath, '-out', certPath, '-days', '365',
    '-subj', `/CN=${env.SMTP_HOSTNAME}`,
  ]);
  return { key: readFileSync(keyPath, 'utf8'), cert: readFileSync(certPath, 'utf8') };
}
