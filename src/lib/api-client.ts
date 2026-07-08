/**
 * Simple fetch wrapper for the auth API. All auth endpoints live under
 * /api/auth/. This keeps the base URL in one place so it's easy to swap.
 */

const BASE_URL = "/api/auth";

export interface ApiError {
  error: string;
  errorCode?: string;
}

export async function postJson<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: ApiError }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, status: res.status, error: { error: data.error ?? "Request failed", errorCode: data.errorCode } };
    }

    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: { error: "Network error. Check your connection." } };
  }
}
