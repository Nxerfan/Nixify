/**
 * Validation helpers for the auth UI. Pure functions, no side effects.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

/** Score password strength 0–4 based on length + character variety. */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "", color: "#374151" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  // Cap at 4
  score = Math.min(score, 4);

  const map: Record<number, PasswordStrength> = {
    0: { score: 0, label: "Too short", color: "#ef4444" },
    1: { score: 1, label: "Weak", color: "#ef4444" },
    2: { score: 2, label: "Fair", color: "#f59e0b" },
    3: { score: 3, label: "Good", color: "#34d399" },
    4: { score: 4, label: "Strong", color: "#10b981" },
  };

  return map[score];
}

export function passwordsMatch(a: string, b: string): boolean {
  return a.length > 0 && a === b;
}
