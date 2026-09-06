import { describe, expect, it } from 'vitest';
import {
  decryptString,
  dkimPublicKeyToDnsValue,
  encryptString,
  generateDkimKeyPair,
  generateSmtpPassword,
  generateSmtpUsername,
} from './crypto.js';

describe('encryptString / decryptString', () => {
  it('round-trips', () => {
    const secret = 'PRIVATE KEY MATERIAL 🔐';
    expect(decryptString(encryptString(secret))).toBe(secret);
  });
  it('produces different ciphertext each time (random IV)', () => {
    expect(encryptString('x')).not.toBe(encryptString('x'));
  });
  it('rejects a tampered payload', () => {
    const enc = encryptString('hello');
    const bad = Buffer.from(enc, 'base64');
    bad.writeUInt8(bad[bad.length - 1]! ^ 0xff, bad.length - 1);
    expect(() => decryptString(bad.toString('base64'))).toThrow();
  });
});

describe('generators', () => {
  it('smtp username has the expected shape', () => {
    expect(generateSmtpUsername()).toMatch(/^smtp-[0-9a-f]{12}$/);
  });
  it('smtp password is 24 chars', () => {
    expect(generateSmtpPassword()).toHaveLength(24);
  });
});

describe('dkimPublicKeyToDnsValue', () => {
  it('strips PEM armour and whitespace', () => {
    const { publicKey } = generateDkimKeyPair();
    const dns = dkimPublicKeyToDnsValue(publicKey);
    expect(dns).not.toMatch(/BEGIN|END|\s/);
    expect(dns.length).toBeGreaterThan(300);
  });
});
