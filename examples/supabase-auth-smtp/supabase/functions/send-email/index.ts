/**
 * Sends one email over SMTP from a Supabase edge function.
 *
 * Edge functions run on Deno, so this uses denomailer rather than Nodemailer. The four
 * SMTP values come from function secrets:
 *
 *   supabase secrets set SMTP_HOST=... SMTP_USER=... SMTP_PASS=... MAIL_FROM=...
 */
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing secret: ${key}`);
  return value;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // JWT verification is on by default, so a token is present — use it to find out who is
  // asking. A send endpoint that trusts the request body alone is an open relay.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { subject, html } = await req.json();

  // Deliberately the signed-in user's own address, not one the caller chose. Widen this
  // only where your product genuinely needs it, and validate what you allow.
  const to = user.email;
  if (!to) {
    return new Response(JSON.stringify({ error: 'This account has no email address' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const client = new SMTPClient({
    connection: {
      hostname: env('SMTP_HOST'),
      port: 587,
      // false on 587: STARTTLS upgrades the connection after it opens.
      // Use true only for port 465.
      tls: false,
      auth: { username: env('SMTP_USER'), password: env('SMTP_PASS') },
    },
  });

  try {
    await client.send({
      from: env('MAIL_FROM'),
      to,
      subject: subject ?? 'Hello from Supabase',
      html: html ?? '<p>Sent over plain SMTP from a Supabase edge function.</p>',
    });
  } catch (error) {
    console.error('send failed', error);
    return new Response(JSON.stringify({ error: 'Could not send email' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await client.close();
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
