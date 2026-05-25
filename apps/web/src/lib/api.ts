import { useAuth } from './auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  token?: string | null;
  body?: any;
  autoRefresh?: boolean;
}

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const { refreshToken, setTokens, clear } = useAuth.getState();
    if (!refreshToken) { clear(); return null; }
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { clear(); return null; }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data.accessToken;
    } catch { clear(); return null; }
    finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

export async function apiFetch<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, headers, body, autoRefresh = true, ...rest } = opts;
  const effectiveToken = token === undefined ? useAuth.getState().accessToken : token;

  const doRequest = async (t: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

  let res = await doRequest(effectiveToken);

  if (res.status === 401 && autoRefresh && effectiveToken) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doRequest(newToken);
  }

  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch {/* */}
    throw new ApiError(payload?.error ?? `HTTP_${res.status}`, res.status, payload?.details);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
