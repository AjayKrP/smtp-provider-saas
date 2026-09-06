import { loadWorkerEnv } from '@smtp-saas/shared';

export const env = loadWorkerEnv();

/** Parsed DELIVERY_MX_OVERRIDE: list of {host,port} used instead of real MX lookups. */
export const mxOverride: { host: string; port: number }[] = (env.DELIVERY_MX_OVERRIDE ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    const [host, port] = entry.split(':');
    return { host: host!, port: port ? Number(port) : 25 };
  });
