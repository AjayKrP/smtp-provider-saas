# Deployment & deliverability runbook

The application handles per-message DKIM signing, customer domain verification, retries,
bounces and suppression. Everything below is infrastructure you must set up yourself for
direct-to-MX delivery to actually land in inboxes.

## 1. Sending infrastructure

- **Dedicated static IPv4** per sending node (IPv6 optional but then it needs full auth too).
- **PTR / reverse DNS**: the IP must resolve to `SMTP_HOSTNAME`, and `SMTP_HOSTNAME` must
  forward-resolve back to that IP. Most providers set PTR in their console.
- **Egress port 25** open outbound (many clouds block it by default — AWS/GCP/Azure
  require a request; OVH/Hetzner/Vultr usually allow it).
- Run `smtp-ingress` and `worker` on hosts with this clean IP. `api` and `dashboard`
  can live anywhere.

## 2. DNS for your own domains

For `SMTP_HOSTNAME` (e.g. `mail.example.com`):

| Record | Value |
| --- | --- |
| `A` | sending IP |
| PTR | `mail.example.com` |

For `BOUNCE_DOMAIN` (e.g. `bounces.example.com`) — the envelope-sender / Return-Path:

| Record | Value |
| --- | --- |
| `MX` | `mail.example.com` (so async bounces can be received later) |
| `TXT` (SPF) | `v=spf1 a:mail.example.com -all` |

Publish the SPF include you advertise to customers (`MAIL_SPF_INCLUDE`, e.g.
`_spf.mail.example.com`):

| Record | Value |
| --- | --- |
| `TXT` `_spf.mail.example.com` | `v=spf1 ip4:<sending IP> -all` |

## 3. Per-customer DNS (shown in the dashboard)

When a customer adds a domain, the API generates a 2048-bit DKIM keypair (private key
AES-256-GCM encrypted at rest) and shows the records to publish:

- **DKIM** `TXT` at `<selector>._domainkey.<domain>` — required; `POST /domains/:id/verify`
  checks it via public resolvers (1.1.1.1 / 8.8.8.8).
- **SPF** `TXT` including `MAIL_SPF_INCLUDE` — recommended.
- **DMARC** `TXT` at `_dmarc.<domain>` — start `p=none`, tighten later.

DKIM alignment (`d=` = the From domain) is what makes DMARC pass, so DKIM is the only
hard requirement for `status: verified`.

## 4. TLS

`smtp-ingress` needs a real certificate for `SMTP_HOSTNAME` (Let's Encrypt is fine):
set `SMTP_TLS_CERT_PATH` / `SMTP_TLS_KEY_PATH`. In `NODE_ENV=production` the service
refuses to start without them. Outbound delivery uses opportunistic STARTTLS and does
not verify remote MX certs (normal for MTAs).

## 5. IP warm-up & reputation

- Start with low volume (tens/day) and ramp over 2–4 weeks; keep engaged recipients first.
- Register with Google Postmaster Tools and Microsoft SNDS.
- Monitor blocklists (Spamhaus, Barracuda). The `Suppression` collection auto-blocks
  hard-bounced addresses; review it.
- Consider MTA-STS + TLS-RPT for your domains once stable.

## 6. Runtime configuration

Set the full `.env` (see `.env.example`). Critical in production:

| Var | Notes |
| --- | --- |
| `ENCRYPTION_KEY` | 32 bytes base64. Losing it makes every stored DKIM key unrecoverable — back it up / use a KMS. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | long random, distinct |
| `SMTP_HOSTNAME` | must match PTR |
| `BOUNCE_DOMAIN` | must have SPF + MX per §2 |
| `MAIL_FROM`, `SYSTEM_SMTP_HOST/PORT/USER/PASS` | **required** — accounts can't sign in until they click the emailed verification link, and password resets are emailed too. Use a dedicated SMTP credential on this relay; its organization needs the `MAIL_FROM` domain verified, and these emails count toward that organization's quota. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | live keys; without them paid plans cannot be bought |
| `RAZORPAY_WEBHOOK_SECRET` | from the `order.paid` webhook pointing at `/api/webhooks/razorpay` |
| `DELIVERY_MX_OVERRIDE` | **must be empty** in production |
| `WORKER_RATE_LIMIT_PER_SEC`, `WORKER_CONCURRENCY` | tune to your IP reputation |

## 7. Datastores

- **MongoDB** as a replica set (required for the registration transaction). Managed
  Atlas or a 3-node set. GridFS holds raw MIME; add a TTL/cron to prune
  `raw_messages.*` and `messageevents` after ~7–30 days.
- **Redis** persistent (AOF) for the BullMQ queue.

## 8. Scaling

- `smtp-ingress` and `worker` scale horizontally (stateless; queue + DB are shared).
- Run multiple `worker` replicas across several clean IPs; pin `SMTP_HOSTNAME` per replica.
- `api` scales behind a load balancer; it is stateless apart from Mongo/Redis.

## 9. Health & shutdown

- `GET /health` on the API.
- All three Node services handle `SIGTERM`/`SIGINT`: drain SMTP connections, close the
  BullMQ worker, disconnect Mongo. Give containers a ~15s stop grace period.

## Verification checklist (end to end)

1. Razorpay Items exist for each paid plan and their ids are in `plans.ts`; `/api/plans`
   shows their prices.
2. Register in the dashboard → Billing → buy a paid plan in Razorpay Checkout (test mode)
   → confirm the `Payment` row is `paid`, `Subscription.currentPeriodEnd` is a month out
   and `Organization.planKey` changed.
3. Add a domain you control, publish the DKIM (+ SPF) records, hit **Verify DNS**.
4. Create SMTP credentials.
5. Configure a mail client (e.g. Thunderbird) with the host/port/username/password,
   send to a personal Gmail address.
6. Check **Activity** → message `delivered`, events show the recipient MX + `250`.
7. Inspect the received mail's headers: `dkim=pass`, `spf=pass`, `dmarc=pass`.
8. Run the message through <https://www.mail-tester.com> and aim for 10/10.
