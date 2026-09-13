import { describe, expect, it } from 'vitest';
import { simpleParser } from 'mailparser';
import { resolveSenderIdentity } from './senderIdentity.js';

const parse = (headers: string) =>
  simpleParser(Buffer.from(`${headers}\r\nTo: rcpt@example.net\r\nSubject: t\r\n\r\nbody\r\n`));

describe('resolveSenderIdentity', () => {
  it('accepts a normal From header', async () => {
    expect(resolveSenderIdentity(await parse('From: "Me" <Me@Verified.com>'))).toEqual({
      ok: true,
      fromAddress: 'me@verified.com',
      senderAddress: null,
    });
    expect(resolveSenderIdentity(await parse('From: me@verified.com'))).toMatchObject({
      ok: true,
      fromAddress: 'me@verified.com',
    });
  });

  it('reads the real address when the display name hides a decoy address', async () => {
    // Previously our regex saw verified.com here while clients show ceo@bank.com.
    const result = resolveSenderIdentity(await parse('From: "<me@verified.com>" <ceo@bank.com>'));
    expect(result).toMatchObject({ ok: true, fromAddress: 'ceo@bank.com' });
  });

  it('reads the real address when a comment hides a decoy address', async () => {
    const result = resolveSenderIdentity(await parse('From: ceo@bank.com (<me@verified.com>)'));
    expect(result).toMatchObject({ ok: true, fromAddress: 'ceo@bank.com' });
  });

  it('rejects multiple From headers in either order', async () => {
    for (const headers of [
      'From: <me@verified.com>\r\nFrom: <ceo@bank.com>',
      'From: <ceo@bank.com>\r\nFrom: <me@verified.com>',
    ]) {
      expect(resolveSenderIdentity(await parse(headers))).toEqual({
        ok: false,
        reason: 'Exactly one From header is allowed',
      });
    }
  });

  it('rejects several addresses or a group in From', async () => {
    for (const headers of [
      'From: <me@verified.com>, <ceo@bank.com>',
      'From: Team: me@verified.com, ceo@bank.com;',
    ]) {
      expect(resolveSenderIdentity(await parse(headers))).toMatchObject({ ok: false });
    }
  });

  it('rejects a missing or malformed From', async () => {
    expect(resolveSenderIdentity(await parse('X-Nothing: 1'))).toMatchObject({ ok: false });
    expect(resolveSenderIdentity(await parse('From: not an address'))).toMatchObject({ ok: false });
  });

  it('returns the Sender address so it can be verified too, and rejects duplicates', async () => {
    expect(
      resolveSenderIdentity(await parse('From: <me@verified.com>\r\nSender: <boss@bank.com>')),
    ).toEqual({ ok: true, fromAddress: 'me@verified.com', senderAddress: 'boss@bank.com' });
    expect(
      resolveSenderIdentity(
        await parse('From: <me@verified.com>\r\nSender: <a@verified.com>\r\nSender: <b@bank.com>'),
      ),
    ).toMatchObject({ ok: false });
  });
});
