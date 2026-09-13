import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'smtp_saas_at';

let accessToken: string | null = localStorage.getItem(TOKEN_KEY);
let onAuthLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const getAccessToken = (): string | null => accessToken;
export const setAuthLostHandler = (fn: () => void): void => {
  onAuthLost = fn;
};

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refresh(): Promise<string | null> {
  refreshing ??= axios
    .post<{ accessToken: string }>('/api/auth/refresh', {}, { withCredentials: true })
    .then((r) => {
      setAccessToken(r.data.accessToken);
      return r.data.accessToken;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const token = await refresh();
      if (token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      onAuthLost?.();
    }
    return Promise.reject(error);
  },
);

/** The API's machine-readable error code, e.g. "email_not_verified". */
export function apiErrorCode(err: unknown): string | undefined {
  return (err as AxiosError<{ error?: string }>).response?.data?.error;
}

export function apiErrorMessage(err: unknown): string {
  const e = err as AxiosError<{ message?: string }>;
  return e.response?.data?.message ?? e.message ?? 'Request failed';
}
