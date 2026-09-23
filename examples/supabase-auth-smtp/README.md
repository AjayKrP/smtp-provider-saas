# Supabase Auth email over SMTP

Two things, because Supabase treats them very differently:

1. **Auth email** — signup confirmation, magic links, password resets. These are sent by
   Supabase itself. You write no code; you paste SMTP settings into the dashboard.
2. **Your own email** — welcome messages, receipts, notifications. These need an edge
   function, because a browser cannot open an SMTP connection and must never hold the
   password.

Both use the same credential from [Email4VibeCoder](https://email4vibecoder.com) (or any
other SMTP provider).

## 1. Auth email: dashboard settings

**Authentication → Emails → SMTP Settings → Enable Custom SMTP**

```
Sender email:  noreply@yourdomain.com   (must be on a domain you have verified)
Sender name:   Your App
Host:          smtp.email4vibecoder.com
Port:          587
Username:      <username from the dashboard>
Password:      <password from the dashboard>
```

Then raise **Authentication → Rate Limits → Rate limit for sending emails**. Enabling SMTP
does not lift Supabase's own cap, and leaving it low is the most common reason confirmation
emails still go missing after the settings are correct.

Supabase's built-in mailer, which this replaces, is throttled to a couple of messages an
hour and only delivers to members of your own organisation. It is for testing, not for a
product with users.

Running locally through the CLI, the same values go in [`supabase/config.toml`](./supabase/config.toml).

## 2. Your own email: the edge function

[`supabase/functions/send-email/index.ts`](./supabase/functions/send-email/index.ts) sends
with [denomailer](https://deno.land/x/denomailer). Edge functions run on Deno, so
Nodemailer is not available there.

```bash
supabase secrets set \
  SMTP_HOST=smtp.email4vibecoder.com \
  SMTP_USER=<username> \
  SMTP_PASS=<password> \
  MAIL_FROM="Your App <hello@yourdomain.com>"

supabase functions deploy send-email
```

Call it from your app:

```ts
const { error } = await supabase.functions.invoke('send-email', {
  body: { to: 'customer@example.com', subject: 'Welcome aboard', html: '<p>Thanks!</p>' },
});
```

### Keep JWT verification on

It is on by default; leave it that way. A function that sends arbitrary content to
arbitrary addresses with no check on the caller is an open relay, and an open relay is
found and abused within days. Where you can, derive the recipient from the signed-in user
on the server rather than trusting the request body — the function here shows both the
check and the pattern.

## Port 587 and `tls: false`

That combination looks wrong and is correct: the connection opens in the clear and is
upgraded with STARTTLS during the handshake. `tls: true` means "TLS from the first byte",
which is port 465.
