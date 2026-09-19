/**
 * Simple fetch wrapper for the auth API. All auth endpoints live under
 * /api/auth/. This keeps the base URL in one place so it's easy to swap.
 *
 * Error envelope contract:
 *   { error: "machine_code", message: "human readable message" }
 *
 * The `error` field is the machine-readable error code (e.g. "rate_limited",
 * "mail_config_missing"). The `message` field is the human-readable message
 * that should be displayed to the user.
 *
 * This wrapper preserves BOTH: the machine code goes in `errorCode`, the
 * human-readable message goes in `error` (the field useAuth.ts reads as the
 * user-facing message).
 */

const BASE_URL = "/api/auth";

export interface ApiError {
  /** Human-readable message for the user. */
  error: string;
  /** Machine-readable error code (e.g. "rate_limited", "mail_config_missing"). */
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
      // The API error envelope is: { error: "machine_code", message: "human readable" }
      // Surface the human-readable `message` to the user, preserve the
      // machine `error` code separately as `errorCode`.
      // If JSON parsing failed (e.g. HTML 500), fall back to status text.
      const userMessage = data.message ?? data.error ?? (res.statusText ? `${res.statusText} (${res.status})` : `Request failed (${res.status})`);
      const machineCode = data.error !== userMessage ? data.error : undefined;
      return { ok: false, status: res.status, error: { error: userMessage, errorCode: machineCode } };
    }

    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: { error: "Network error. Check your connection." } };
  }
}
