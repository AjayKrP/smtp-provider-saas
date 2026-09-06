// Baseline env for unit tests. Integration tests override MONGO_URI / REDIS_URL.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'fatal';
process.env.MONGO_URI ??= 'mongodb://localhost:27017/smtp_saas_test';
process.env.REDIS_URL ??= 'redis://localhost:6379/1';
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
