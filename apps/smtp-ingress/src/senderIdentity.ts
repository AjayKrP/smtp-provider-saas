import type { AddressObject, EmailAddress, HeaderValue, ParsedMail } from 'mailparser';

export type SenderIdentity =
  { ok: true; fromAddress: string; senderAddress: string | null } | { ok: false; reason: string };

// Local part without whitespace or address punctuation; ASCII (or punycode) domain.
const ADDRESS =
  /^[^\s@<>()[\]",;:\\]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

function isAddressObject(v: HeaderValue | undefined): v is AddressObject {
  return !!v && typeof v === 'object' && 'value' in v && Array.isArray((v as AddressObject).value);
}

/** Every mailbox in a parsed address header, with group members expanded. */
function mailboxes(header: AddressObject | AddressObject[] | undefined): EmailAddress[] {
  const objects = header === undefined ? [] : Array.isArray(header) ? header : [header];
  return objects.flatMap((o) =>
    o.value.flatMap((entry) => (entry.group ? [entry, ...entry.group] : [entry])),
  );
}

function single(
  parsed: ParsedMail,
  key: 'from' | 'sender',
  label: string,
): { address: string | null; error?: string } {
  const lines = parsed.headerLines.filter((l) => l.key === key).length;
  if (lines === 0) return { address: null };
  if (lines > 1) return { address: null, error: `Exactly one ${label} header is allowed` };

  const header = key === 'from' ? parsed.from : parsed.headers.get('sender');
  const boxes = mailboxes(
    isAddressObject(header) || Array.isArray(header) ? (header as AddressObject) : undefined,
  );
  if (boxes.length !== 1 || boxes[0]!.group) {
    return { address: null, error: `The ${label} header must contain exactly one address` };
  }
  const address = (boxes[0]!.address ?? '').trim().toLowerCase();
  if (!ADDRESS.test(address)) {
    return { address: null, error: `A valid ${label} address is required` };
  }
  return { address };
}

/**
 * Work out who a message claims to be from, the way recipients' mail clients will.
 *
 * The sending domain check must use the parser's own reading of the header, never a
 * pattern match on its raw text: a display name or comment can contain a second
 * "<address>" (`"<me@mine.com>" <ceo@bank.com>`), and a regex that grabs the first
 * one passes our check while every client shows the other address.
 */
export function resolveSenderIdentity(parsed: ParsedMail): SenderIdentity {
  const from = single(parsed, 'from', 'From');
  if (from.error) return { ok: false, reason: from.error };
  if (!from.address) return { ok: false, reason: 'A From header is required' };

  const sender = single(parsed, 'sender', 'Sender');
  if (sender.error) return { ok: false, reason: sender.error };

  return { ok: true, fromAddress: from.address, senderAddress: sender.address };
}
