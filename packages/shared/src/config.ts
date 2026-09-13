import { z } from 'zod';

/**
 * Environment configuration. Each service validates the subset it needs by calling
 * the matching loader. Loaders are memoised so repeated calls are cheap.
 */

const sharedSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  // base64-encoded 32-byte key
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY must decode to 32 bytes'),
});

const apiSchema = sharedSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.string().url(),
  DASHBOARD_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  // Razorpay. Optional so the API still boots without them; billing endpoints then
  // answer 503 and plan prices are simply not synced.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Optional SPF include token the operator publishes for their sending IPs,
  // e.g. "_spf.mail.example.com". Shown to customers and checked during verification.
  MAIL_SPF_INCLUDE: z.string().optional(),
  // Hostname customers point their SMTP client at. Defaults to the API host.
  SMTP_PUBLIC_HOST: z.string().optional(),
  // Transactional mail (verification, password reset) is sent through an SMTP server —
  // normally this service's own relay with a dedicated credential. Unset host: emails
  // are logged instead of sent (fine in development, an error in production).
  MAIL_FROM: z.string().default('SMTP SaaS <no-reply@localhost>'),
  SYSTEM_SMTP_HOST: z.string().optional(),
  SYSTEM_SMTP_PORT: z.coerce.number().int().positive().default(465),
  SYSTEM_SMTP_USER: z.string().optional(),
  SYSTEM_SMTP_PASS: z.string().optional(),
});

const smtpSchema = sharedSchema.extend({
  SMTP_SUBMISSION_PORT: z.coerce.number().int().positive().default(587),
  SMTP_TLS_PORT: z.coerce.number().int().positive().default(465),
  SMTP_HOSTNAME: z.string().min(1),
  SMTP_TLS_CERT_PATH: z.string().optional(),
  SMTP_TLS_KEY_PATH: z.string().optional(),
  SMTP_MAX_MESSAGE_BYTES: z.coerce.number().int().positive().default(26_214_400),
});

const workerSchema = sharedSchema.extend({
  SMTP_HOSTNAME: z.string().min(1),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  WORKER_RATE_LIMIT_PER_SEC: z.coerce.number().int().positive().default(10),
  BOUNCE_DOMAIN: z.string().min(1),
  DELIVERY_MX_OVERRIDE: z.string().optional(),
  DELIVERY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
});

function build<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

let sharedCache: z.infer<typeof sharedSchema> | undefined;
let apiCache: z.infer<typeof apiSchema> | undefined;
let smtpCache: z.infer<typeof smtpSchema> | undefined;
let workerCache: z.infer<typeof workerSchema> | undefined;

export const loadSharedEnv = () => (sharedCache ??= build(sharedSchema));
export const loadApiEnv = () => (apiCache ??= build(apiSchema));
export const loadSmtpEnv = () => (smtpCache ??= build(smtpSchema));
export const loadWorkerEnv = () => (workerCache ??= build(workerSchema));

export type SharedEnv = z.infer<typeof sharedSchema>;
export type ApiEnv = z.infer<typeof apiSchema>;
export type SmtpEnv = z.infer<typeof smtpSchema>;
export type WorkerEnv = z.infer<typeof workerSchema>;
