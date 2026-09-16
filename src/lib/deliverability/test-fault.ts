/**
 * TEST-ONLY fault injection for the Phase 11 deliverability / messaging /
 * broadcast production paths.
 *
 * WHY THIS EXISTS
 * ---------------
 * The audit requires real rollback tests that exercise the PRODUCTION
 * `ingestProviderEvent()` / `sendTransactionalEmail()` / `processRecipient()`
 * functions and force a deterministic failure at a precise point inside the
 * transaction, then prove every earlier mutation rolled back atomically.
 *
 * There is no way to cause such a failure from HTTP input or production
 * config without deliberately corrupting production schema (which is
 * forbidden). This module provides a safe, test-only fault-injection hook.
 *
 * SAFETY INVARIANTS (per audit requirements)
 * -----------------------------------------
 * 1. IMPOSSIBLE TO ACTIVATE FROM HTTP INPUT — the fault name is a
 *    module-level variable, NOT a request field. No route handler reads it.
 *    No environment variable controls it. It can only be set by importing
 *    `__setDeliverabilityTestFault` directly in a test file.
 *
 * 2. IMPOSSIBLE TO ACTIVATE FROM PRODUCTION ENV/CONFIG — the setter throws
 *    unless `process.env.NODE_ENV === "test"`. The getter also returns null
 *    when `NODE_ENV !== "test"`. Both guards must pass for a fault to fire.
 *    Vitest sets `NODE_ENV=test` by default; production runs do not.
 *
 * 3. NOT EXPORTED AS PRODUCT BEHAVIOR — the public surface is prefixed with
 *    `__` (double underscore) to signal test-only. The fault names are opaque
 *    strings; no production caller references them.
 *
 * 4. DETERMINISTIC — setting a fault name causes exactly one failure point
 *    at a known location. The fault stays active until the test clears it.
 *
 * USAGE (test files only)
 * -----------------------
 *   import { __setDeliverabilityTestFault, __clearDeliverabilityTestFault }
 *     from "@/lib/deliverability/test-fault";
 *
 *   __setDeliverabilityTestFault("post-suppression-throw");
 *   try { await ingestProviderEvent({...}); } catch { /* expected *\/ }
 *   __clearDeliverabilityTestFault();
 *
 * FAULT NAMES
 * -----------
 *   "in-suppression-throw"          — inside ingestProviderEvent, after the
 *     event is inserted + state is updated + lookupDeliveryEmail returns a
 *     real email, but BEFORE suppressEmailInTx runs. Proves event + state
 *     roll back when the suppression step fails.
 *
 *   "post-suppression-throw"         — inside ingestProviderEvent, AFTER
 *     suppressEmailInTx returns successfully, but BEFORE the transaction
 *     commits. Proves event + state + suppression ALL roll back atomically
 *     even though each individually "succeeded".
 *
 *   "post-provider-emailmessage-persist-fail" — inside sendTransactionalEmail,
 *     AFTER provider.send() accepted + EmailDelivery recorded acceptance,
 *     but BEFORE the EmailMessage→sent update. Proves idempotent replay does
 *     NOT re-call the provider.
 *
 *   "post-provider-recipient-cas-fail" — inside processRecipient (broadcast),
 *     AFTER provider.send() accepted + EmailDelivery recorded acceptance,
 *     but BEFORE the BroadcastRecipient dispatching→sent terminal CAS. Proves
 *     recovery never re-dispatches the recipient.
 */

let activeFault: string | null = null;

/**
 * Test-only setter. Throws if called outside NODE_ENV=test.
 * Tests MUST clear the fault after use via __clearDeliverabilityTestFault().
 */
export function __setDeliverabilityTestFault(name: string | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "__setDeliverabilityTestFault is test-only and cannot be used outside NODE_ENV=test.",
    );
  }
  activeFault = name;
}

/**
 * Test-only clearer. Throws if called outside NODE_ENV=test.
 */
export function __clearDeliverabilityTestFault(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "__clearDeliverabilityTestFault is test-only and cannot be used outside NODE_ENV=test.",
    );
  }
  activeFault = null;
}

/**
 * Service-facing getter. Returns the active fault name, or null.
 *
 * In production (NODE_ENV !== "test") this ALWAYS returns null — the setter
 * cannot have been called. This is the secondary guard that makes the faults
 * structurally unreachable in production even if the module is imported.
 */
export function __getDeliverabilityTestFault(): string | null {
  if (process.env.NODE_ENV !== "test") {
    return null;
  }
  return activeFault;
}
