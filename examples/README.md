# Examples

Three small, working examples of sending transactional email over SMTP with
[Email4VibeCoder](https://email4vibecoder.com) — or with any other SMTP provider, since
none of them import an SDK.

| Example | What it shows |
| --- | --- |
| [`nextjs-smtp`](./nextjs-smtp) | A route handler that sends, with the Node runtime setting the Edge runtime needs |
| [`django-smtp`](./django-smtp) | Django's built-in mail backend, configured from environment variables |
| [`supabase-auth-smtp`](./supabase-auth-smtp) | Supabase Auth email plus an edge function for your own messages |

Each directory is self-contained and meant to be published as its own public repository:
they are here so they stay in step with the service, not because they belong to it. To
split one out:

```bash
cp -r examples/nextjs-smtp /tmp/nextjs-smtp-example
cd /tmp/nextjs-smtp-example
git init && git add -A && git commit -m "Send email from Next.js over SMTP"
gh repo create nextjs-smtp-example --public --source=. --push
```

## The settings they all use

```
SMTP_HOST=smtp.email4vibecoder.com
SMTP_PORT=587
SMTP_USER=<from the dashboard>
SMTP_PASS=<from the dashboard>
MAIL_FROM="Your App <hello@yourdomain.com>"
```

`MAIL_FROM` must be on a domain verified in your account — that is what allows the message
to be DKIM-signed. A free account sends 500 emails a month and needs no card.
