/**
 * Display name helper — the canonical way to format a user's name.
 *
 * Handles the additive firstName/lastName migration:
 * - If firstName or lastName exists, use them (firstName + " " + lastName, trimmed)
 * - Otherwise fall back to fullName (legacy compatibility)
 * - If none exist, return null (caller decides fallback, e.g. email)
 *
 * This is the ONLY place in the app that constructs display names from
 * User fields. All components should import and use this helper.
 */

export function getDisplayName(user: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string | null {
  // Prefer firstName/lastName if either is set
  if (user.firstName || user.lastName) {
    const parts = [user.firstName, user.lastName].filter(Boolean).map(s => s!.trim());
    const joined = parts.join(" ").trim();
    if (joined) return joined;
  }

  // Fall back to legacy fullName
  if (user.fullName?.trim()) return user.fullName.trim();

  return null;
}

/**
 * Get initials for avatar display.
 * Uses the display name, falling back to email.
 */
export function getInitials(name: string | null, email: string): string {
  const displayName = name || email;
  return displayName[0]?.toUpperCase() || "?";
}
