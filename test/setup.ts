// Baseline env for unit tests. Integration tests override MONGO_URI / REDIS_URL.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'fatal';
process.env.MONGO_URI ??= 'mongodb://localhost:27017/smtp_saas_test';
process.env.REDIS_URL ??= 'redis://localhost:6379/1';
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
// The API's own env, needed by any test that reaches code importing apps/api/src/env.ts
// (fulfilling a payment now awards referral commission, which reads the program's config).
process.env.API_PUBLIC_URL ??= 'http://localhost:4000';
process.env.DASHBOARD_URL ??= 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-not-a-real-key';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-not-a-real-key';
