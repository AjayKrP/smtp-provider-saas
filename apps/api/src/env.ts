import { loadApiEnv } from '@smtp-saas/shared';

export const env = loadApiEnv();
export const isProd = env.NODE_ENV === 'production';
