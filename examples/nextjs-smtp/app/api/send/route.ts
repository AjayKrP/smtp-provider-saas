import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';

// Required. The Edge runtime has no TCP sockets, so SMTP cannot work there — and the
// error it gives you is a missing 'net' module, which does not sound like this at all.
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { to } = (await request.json()) as { to?: string };

  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  try {
    await sendEmail(
      to,
      'Hello from Next.js',
      '<p>This message was sent over plain SMTP from a Next.js route handler.</p>',
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Log the real reason, return a vague one: SMTP replies sometimes quote the
    // recipient back, and that is not something to hand an anonymous caller.
    console.error('send failed', error);
    return NextResponse.json({ error: 'Could not send email' }, { status: 502 });
  }
}
