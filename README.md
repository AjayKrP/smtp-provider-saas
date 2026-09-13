# SMTP Provider SaaS

A subscription-based SMTP relay service. Customers are issued SMTP credentials, point
their applications at the submission server, and the platform delivers their mail
directly to recipient mail servers (direct MX delivery) with per-plan quotas, prepaid
monthly through Razorpay.

> **Deliverability note.** Direct MX delivery from self-managed IPs needs operational
> work this codebase cannot do for you: static IPv4 with matching PTR/rDNS, SPF for the
> bounce domain, DMARC, IP warm-up and blocklist monitoring. See
> [`DEPLOYMENT.md`](./DEPLOYMENT.md). Gmail/Yahoo/Microsoft reject unauthenticated mail.

## Architecture

| Package | Role |
| --- | --- |
| `packages/shared` | Config (zod), Mongoose models, crypto (DKIM key encryption), quota logic, shared types |
| `apps/api` | REST API for the dashboard: auth, Razorpay billing + webhooks, domains/DKIM, credentials, message logs, usage |
| `apps/smtp-ingress` | `smtp-server` on 587 (STARTTLS) + 465 (TLS): authenticates customers, validates, stores raw MIME in GridFS, enqueues |
| `apps/worker` | BullMQ consumer: DKIM-signs, resolves MX, delivers on port 25, retries with backoff, bounces, suppression, usage + events |
| `apps/dashboard` | React + Vite SPA |

Data flow: **customer SMTP client → `smtp-ingress` → MongoDB (`Message` + GridFS) + Redis
queue → `worker` → recipient MX**. The dashboard talks only to `apps/api`.

Stack: Node 22, TypeScript, Express 5, MongoDB (Mongoose), Redis (BullMQ), Razorpay,
`smtp-server`, `nodemailer`, `mailauth` (DKIM). npm workspaces monorepo.

## Local development

Prerequisites: Node ≥ 22, Docker.

```bash
cp .env.example .env          # then edit — see below
npm install
npm run infra:up              # mongo (single-node replica set), redis, maildev
npm run seed                  # upsert plan catalog (+ prices from Razorpay Items if keys are set)
npm run dev                   # shared (watch) + api + smtp-ingress + worker + dashboard
```

- Dashboard: <http://localhost:5173>
- API: <http://localhost:4000>
- MailDev (delivered mail in dev): <http://localhost:1080>

For local delivery, set `DELIVERY_MX_OVERRIDE=127.0.0.1:1025` in `.env` so the worker
sends every message to MailDev instead of doing real MX lookups.

### Minimum `.env` to boot

`MONGO_URI`, `REDIS_URL`, `ENCRYPTION_KEY` (`openssl rand -base64 32`),
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `API_PUBLIC_URL`, `DASHBOARD_URL`,
`SMTP_HOSTNAME`, `BOUNCE_DOMAIN`. Razorpay keys can stay unset until you test billing
(paid plans then show as unavailable).

> `POST /auth/register` uses a MongoDB transaction, so Mongo must run as a replica set.
> `npm run infra:up` handles that; a plain `mongod` will not work.

## Testing

```bash
npm test          # vitest: unit tests + an end-to-end delivery pipeline test
npm run typecheck # all packages + test files + dashboard
npm run lint
```

The pipeline test (`apps/worker/src/pipeline.test.ts`) spins up an in-memory MongoDB and
a local capture SMTP server, then runs a message through DKIM signing and delivery,
asserting the `Message` status, `MessageEvent`s, usage counters and the DKIM-Signature
header on the received mail.

## Razorpay billing

Plans are **prepaid one month at a time** with Razorpay Orders — nothing auto-renews.
Paying for the running plan extends it by a month; buying another plan starts a new
month now. When the period ends the organization falls back to the Free plan's limits.

1. Set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (test keys in dev).
2. Prices live in Razorpay **Items** (amount + currency, e.g. INR). Create one Item per
   paid plan and put its `item_…` id in `razorpayItemId` in `packages/shared/src/plans.ts`:
   ```bash
   curl -u "$RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET" https://api.razorpay.com/v1/items \
     -H 'Content-Type: application/json' \
     -d '{"name":"Starter plan (1 month)","amount":59900,"currency":"INR"}'
   ```
   The API mirrors each Item's price into `plans` on startup and every 15 minutes, and
   re-reads it at checkout, so a price change on the Item needs no deploy.
3. Webhook: `POST {API}/webhooks/razorpay`, event `order.paid`, secret in
   `RAZORPAY_WEBHOOK_SECRET`. The checkout callback already credits the payment; the
   webhook is the backstop if the customer closes the tab. Orders from other sites on
   the same Razorpay account are ignored.

## API surface (dashboard-facing)

```
POST   /auth/register | /auth/login | /auth/refresh | /auth/logout
GET    /auth/me
GET    /plans
POST   /billing/checkout | /billing/verify
GET    /billing/subscription | /billing/payments
POST   /webhooks/razorpay                    (raw body, Razorpay-signed)
GET    /domains         POST /domains
GET    /domains/:id     POST /domains/:id/verify     DELETE /domains/:id
GET    /smtp-credentials   POST /smtp-credentials   DELETE /smtp-credentials/:id
GET    /messages   GET /messages/:id
GET    /usage/current
```

## Run the whole stack with Docker Compose

`docker-compose.yml` runs on an **external Docker network `mynet`** and reuses a Redis
container already running there (reachable as host `redis`). **MongoDB is not run by
Compose** — set `MONGO_URI` in `.env` to your MongoDB Atlas connection string (Atlas is
already a replica set, so signup transactions work; don't add `directConnection`).
Allow the Docker host's egress IP in Atlas → Network Access. Compose publishes only 4000
(api), 587/465 (smtp-ingress), 5173 (dashboard) and 1080 (MailDev UI).

```bash
# one-time: the shared network + Redis (skip if they already exist)
docker network create mynet
docker run -d --name redis --network mynet redis:7

# set MONGO_URI (Atlas) and secrets in .env first
docker compose --profile apps up -d --build
docker compose run --rm --no-deps api node dist/scripts/seed.js   # seed plans
```

- Dashboard: <http://localhost:5173>  ·  API: <http://localhost:4000>  ·  MailDev: <http://localhost:1080>
- The `worker` service sets `DELIVERY_MX_OVERRIDE=maildev:1025`, so every message is
  delivered (DKIM-signed) into MailDev instead of the real internet.
- `.env` on the host supplies secrets; Compose overrides `MONGO_URI` / `REDIS_URL` /
  ports per service.

Stop with `docker compose --profile apps down` (add `-v` to drop the Mongo volume).

## Production

See [`DEPLOYMENT.md`](./DEPLOYMENT.md). Build images individually:

```bash
docker build -t smtp-saas-api          --build-arg APP=api .
docker build -t smtp-saas-smtp-ingress --build-arg APP=smtp-ingress .
docker build -t smtp-saas-worker       --build-arg APP=worker .
docker build -t smtp-saas-dashboard    -f apps/dashboard/Dockerfile .
```
