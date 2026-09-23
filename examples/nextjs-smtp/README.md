# Send email from Next.js over SMTP

A minimal Next.js App Router example that sends transactional email with
[Nodemailer](https://nodemailer.com) over plain SMTP — no provider SDK, so it works with
[Email4VibeCoder](https://email4vibecoder.com), or with any other SMTP server by changing
four environment variables.

## The settings

```bash
cp .env.example .env.local
```

```
SMTP_HOST=smtp.email4vibecoder.com
SMTP_PORT=587
SMTP_USER=<username from the dashboard>
SMTP_PASS=<password from the dashboard>
MAIL_FROM="Your App <hello@yourdomain.com>"
```

`MAIL_FROM` has to be on a domain you have verified with your provider; that is what lets
the message be DKIM-signed, and unverified senders are rejected at SMTP time.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, enter an address, send.

## The two things that catch people out

**The Edge runtime cannot send email.** It has no TCP sockets, so Nodemailer cannot open a
connection, and the error it produces — a missing `net` or `tls` module — never mentions
SMTP. Every route that sends needs:

```ts
export const runtime = 'nodejs';
```

Middleware always runs on the edge, so never send from middleware.

**Create the transport once.** A transporter at module scope is reused by warm serverless
invocations; one created per request opens a new connection and authenticates again every
time, which is the usual cause of a function timing out under load.

## Files

- `lib/mailer.ts` — the shared transporter
- `app/api/send/route.ts` — the route handler that sends
- `app/page.tsx` — a form that calls it

## Notes on going to production

- Keep SMTP values out of `NEXT_PUBLIC_*`: that prefix inlines them into the browser bundle.
- Set the same variables in your host's dashboard; `.env.local` is local only.
- Guard the route with your own auth, and decide the recipient server-side. An endpoint
  that mails anything to anyone is an open relay, and it will be found.
