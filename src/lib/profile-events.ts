/**
 * Profile events — a lightweight pub/sub for profile data refresh.
 *
 * When the Settings page saves a profile update, it dispatches a
 * `nixify:profile-updated` event. Components that display the user's
 * name (Sidebar, StatusBar, etc.) listen for this event and refetch
 * /api/profile/me to update their display without a full page reload.
 *
 * This avoids:
 *   - Duplicating refetch logic in every component
 *   - A heavy global state store for a simple display-name refresh
 *   - Forcing the user to reload the page after changing their name
 */

export const PROFILE_UPDATED_EVENT = "nixify:profile-updated";

/** Dispatch the profile-updated event after a successful save. */
export function dispatchProfileUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
}

/**
 * Subscribe to profile-updated events. Returns an unsubscribe function.
 * The callback is called whenever a profile save succeeds.
 */
export function onProfileUpdated(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PROFILE_UPDATED_EVENT, callback);
  return () => window.removeEventListener(PROFILE_UPDATED_EVENT, callback);
}
