import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  randomInt,
} from 'node:crypto';
import { loadSharedEnv } from './config.js';

const ALGO = 'aes-256-gcm';

function key(): Buffer {
  return Buffer.from(loadSharedEnv().ENCRYPTION_KEY, 'base64');
}

/** Encrypt a UTF-8 string. Output: base64("iv(12) | tag(16) | ciphertext"). */
export function encryptString(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptString(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

const UNAMBIGUOUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';

function randomFrom(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** URL-safe opaque token (refresh tokens, verification tokens). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SMTP username, e.g. "smtp-a1b2c3d4e5f6". */
export function generateSmtpUsername(): string {
  return `smtp-${randomBytes(6).toString('hex')}`;
}

/** SMTP password shown to the user exactly once. */
export function generateSmtpPassword(): string {
  return randomFrom(UNAMBIGUOUS, 24);
}

/** DKIM selector, e.g. "s1a2b3c4". */
export function generateDkimSelector(): string {
  return `s${randomBytes(4).toString('hex')}`;
}

/** Generate a 2048-bit RSA keypair for DKIM signing (PEM). */
export function generateDkimKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
}

/** The base64 body of an SPKI PEM, for the DKIM DNS TXT record's `p=` tag. */
export function dkimPublicKeyToDnsValue(publicKeyPem: string): string {
  return publicKeyPem
    .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
}
