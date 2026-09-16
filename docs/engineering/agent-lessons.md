# Engineering Lessons — Nixify Agent Development

This file contains reusable engineering lessons learned during phase development.
Read this at the beginning of every phase. Update before finalizing every PR.

## Lesson: Verify implementation on remote HEAD before reporting

**Mistake:** Reported features as implemented when they only existed in local uncommitted files that were lost due to background process branch switching.

**Root cause:** Background processes in the sandbox environment can switch git branches between operations, causing uncommitted changes to be lost or applied to the wrong branch.

**Permanent rule:** Never report a feature as implemented until it is verified on the pushed remote HEAD via `git show origin/<branch>:<file>`.

**Applies to:** All phases.

## Lesson: Verify branch + HEAD before every git operation

**Mistake:** Multiple commits were accidentally placed on the wrong branch (main instead of feat-branch) because a background process switched HEAD between checkout and commit.

**Root cause:** The sandbox environment has background processes that periodically switch the checked-out branch, typically to `main`.

**Permanent rule:** Before committing, verify `git branch --show-current` matches the expected branch. After committing, verify `git log --oneline -1` shows the commit on the correct branch. Use `git checkout <branch> -- .` to restore working tree files atomically.

**Applies to:** All phases.

## Lesson: Green CI with wrong tests is not success

**Mistake:** CI was green because tests encoded the old broken behavior (e.g., expecting only valid rows to be staged when the spec required ALL rows to be persisted for preview).

**Root cause:** Tests were written to match existing behavior rather than the specification, then "relaxed" to accept timing-dependent results instead of making them deterministic.

**Permanent rule:** Tests must encode the specification, not the implementation. Never weaken concurrency assertions merely to make CI green — make tests deterministic using database state and atomic claims instead of sleeps.

**Applies to:** All phases with DB integration tests.

## Lesson: Route-level integration must be verified, not just existence

**Mistake:** Security helpers (preflightZip, SSRF validation) existed in library code but were never called from the actual request path.

**Root cause:** The library was written correctly, but the route handler was not updated to call it.

**Permanent rule:** If a security helper is claimed as integrated, verify the real request path actually calls it by reading the committed route file.

**Applies to:** All phases with security-critical helpers.

## Lesson: Transactional claims must be verified in actual code

**Mistake:** Processing was described as "transactional" but the actual implementation performed independent DB calls without `db.$transaction()`.

**Root cause:** The service was described as transactional in comments and PR descriptions, but the code never wrapped the operations in a transaction.

**Permanent rule:** If code is described as transactional, verify the real implementation actually uses `db.$transaction()` around the required side effects.

**Applies to:** All phases with multi-step DB operations.

## Lesson: Parent locking does not replace row-level locking

**Mistake:** The import processor claimed the parent ContactImport lock but selected rows using `WHERE status = 'staged'` without atomically claiming each row.

**Root cause:** The parent lock was mistakenly treated as sufficient for row-level concurrency safety.

**Permanent rule:** Parent-job locking does not replace row-level locking/claiming. Each row must be atomically claimed via compare-and-swap.

**Applies to:** All phases with queue/processor patterns.

## Lesson: Stale workers must not overwrite newer state

**Mistake:** A stale worker could resume after recovery and overwrite the state produced by a newer worker that reclaimed the row.

**Root cause:** Row processing did not verify ownership (lockedBy) at the start of processing or at terminal transition.

**Permanent rule:** A stale worker must never be able to overwrite state produced by a newer worker. Pass workerId into processing and verify ownership with CAS at the start of the row transaction.

**Applies to:** All phases with concurrent workers.

## Lesson: Never silently swallow correctness-critical failures

**Mistake:** `.catch(() => {})` was used on counter updates, lock releases, and finalization operations.

**Root cause:** Convenience pattern from non-critical telemetry code was applied to correctness-critical paths.

**Permanent rule:** Never silently swallow correctness-critical database failures. Failures may be classified safely, but must not be ignored.

**Applies to:** All phases with DB operations.

## Lesson: Finalization must check ALL non-terminal states

**Mistake:** Finalization checked only `no staged rows` but not `no processing rows`, allowing completion while a row was still being processed.

**Root cause:** The processing state was added after finalization logic was written.

**Permanent rule:** Finalization must check that NO staged AND NO processing rows remain. An import may complete only when all processable rows are terminal.

**Applies to:** All phases with import/queue finalization.

## Lesson: Fetch/reset to remote HEAD before final audit

**Mistake:** Final reports were based on local state that differed from the actual remote HEAD.

**Root cause:** Local working tree contained uncommitted changes or was on the wrong branch.

**Permanent rule:** Before final reporting, fetch/reset to the remote branch HEAD and re-audit critical requirements from that exact commit using `git show`.

**Applies to:** All phases.

## Lesson: Idempotency keys belong outside the transaction's success path

**Mistake:** First-cut Phase 9 code called `tx.event.create({ data: { idempotencyKeyHash } })` inside `db.$transaction()` and treated the resulting P2002 as a recoverable error *inside* the same transaction.

**Root cause:** Per reliability protocol §4.4, PostgreSQL marks a transaction as failed after ANY constraint violation. Catching P2002 and continuing leaves the tx in an invalid state; subsequent writes silently no-op or also throw, producing inconsistent state.

**Permanent rule:** When implementing idempotent mutations with a per-tenant unique key:
1. Inside the transaction, FIRST check for an existing event with `findUnique({ where: { userId_idempotencyKeyHash } })`. Return idempotent_replay if found.
2. Then perform the mutation + insert. If a concurrent insert races us, P2002 throws OUT of `db.$transaction()`.
3. Catch P2002 OUTSIDE the transaction (in a `try/catch` around the `db.$transaction(...)` call). Fetch the existing event and return idempotent_replay.
4. Never `.catch(() => {})` the insert inside the tx — the tx is already dead.

**Applies to:** All phases with idempotent multi-step mutations (consent transitions, suppression lifecycle, future broadcast sending).

## Lesson: Lifting a suppression is not the same as subscribing

**Mistake:** Initial Phase 9 design considered "lift suppression" as a single operation that also subscribes the contact. This conflates two distinct actions.

**Root cause:** A user clicking "unsubscribe" in an email and an admin clicking "resubscribe" in the dashboard are different consent events. An unsubscribe is a withdrawal of consent. A resubscribe is a fresh grant of consent. Treating them as the same operation collapses two distinct audit entries into one and loses the explicit consent trail required by GDPR/CAN-SPAM.

**Permanent rule:** Suppression lifting and subscribe are separate operations:
- `unsuppressEmail({ alsoSubscribe: false })` — only lifts the suppression. Does NOT change marketingStatus.
- `subscribeContact(...)` — explicit consent action. Also lifts any active suppression as a side effect (because the user is explicitly opting back in).
- A "resubscribe" UI flow should call `subscribeContact`, not `unsuppressEmail`.

The invariant: `marketingStatus === "subscribed"` requires an explicit subscribe action, regardless of suppression state.

**Applies to:** Consent/suppression phases (9, future 11).

## Lesson: Public endpoints must never leak existence

**Mistake:** A public unsubscribe endpoint that returns 404 for "contact not found" but 200 for "valid token, contact exists" allows an attacker to enumerate which emails belong to a tenant by issuing tokens (or brute-forcing token signatures).

**Root cause:** Distinct status codes / response bodies reveal whether a contact exists, even when the operation itself is unauthorized.

**Permanent rule:** Public token-based endpoints (unsubscribe, password reset, magic link) must return the SAME generic message and SAME status code for ALL failure modes:
- Token signature invalid → same generic message + same status code
- Token expired → same generic message + same status code
- Token valid but contact deleted → same generic message + same status code
- Token valid but tenant mismatch → same generic message + same status code
- Token valid and contact exists → success response

The attacker cannot distinguish "token invalid" from "contact doesn't exist". This is true even though it makes user support harder — the support path is email-based, not URL-based.

**Applies to:** All public-facing token endpoints.

## Lesson: Signed is not opaque

**Mistake (Phase 9 audit):** The original unsubscribe token was a signed JWS/JWT containing plaintext claims (uid, sub, email). A signed JWT is tamper-resistant but NOT confidential — anyone possessing the link can base64-decode the payload and read internal IDs and email.

**Root cause:** JWS protects integrity, not confidentiality. The two are different properties. For link tokens that embed internal IDs or PII, integrity alone is insufficient.

**Permanent rule:** When a token contains internal IDs or PII and is delivered through an untrusted channel (email link, magic link), it MUST be ENCRYPTED, not just signed. Use `jose`'s `EncryptJWT` with `alg=dir, enc=A256GCM` (compact JWE). The encryption key must be derived from the root secret via HKDF-SHA-256 with explicit context/domain separation (e.g. `nixify:unsubscribe:v1`), NEVER the raw session signing key.

**Applies to:** All link-token endpoints (unsubscribe, password reset, magic link, email verification).

## Lesson: Prisma read is not a row lock

**Mistake (Phase 9 audit):** Tests and comments claimed "PostgreSQL row-level locking on Contact serializes concurrent subscribe/unsubscribe", but the production implementation began with ordinary `findFirst()` calls — NOT `SELECT ... FOR UPDATE`. The lock did not exist.

**Root cause:** `findFirst/findUnique` are plain SELECTs. PostgreSQL's default isolation level (READ COMMITTED) does not lock rows on read. Two concurrent transactions can both read the same Contact row, both see `marketingStatus=unknown`, and both write `marketingStatus=subscribed` — the last commit wins, but the history chain is incoherent (two events with `previousStatus=unknown` when only the first one's previousStatus was actually unknown).

**Permanent rule:** Concurrency claims must correspond to actual DB locking behavior. For mutation serialization, use either:
1. `SELECT ... FOR UPDATE` on the target row, OR
2. `pg_advisory_xact_lock(tenant_key, target_key)` inside the transaction — locks are released on commit/rollback, and they serialize without depending on row existence (critical for suppressions where the entry may not exist yet).

The advisory-lock approach is preferred when the lock target may not exist as a row (e.g. suppression-by-email before the entry is upserted).

**Applies to:** All phases with concurrent mutation operations.

## Lesson: Never catch constraint errors inside PostgreSQL transaction and continue

**Mistake (Phase 9 audit):** `subscribeContact()` and `unsubscribeContact()` had patterns equivalent to:
```ts
try {
  await tx.suppressionEvent.create(...)
} catch {
  // assume P2002 and continue
}
```

**Root cause:** Per reliability protocol §4.4, PostgreSQL marks a transaction as ABORTED after ANY constraint violation. Catching the JavaScript exception does NOT make the PostgreSQL transaction healthy again — subsequent writes silently no-op or also throw, producing inconsistent state. Worse, the broad `catch` catches ALL errors, not only P2002.

**Permanent rule:** Never `try/catch` constraint errors inside `db.$transaction()` and continue. Either:
1. Use `createMany({ ..., skipDuplicates: true })` for conflict-safe inserts, OR
2. Let the constraint error propagate out of the transaction and handle it OUTSIDE via a `try/catch` around the `db.$transaction(...)` call.

**Applies to:** All phases with interactive transactions.

## Lesson: Idempotency identity must bind operation and target

**Mistake (Phase 9 audit):** Idempotency hashing was effectively `tenant + raw key`, and the unique constraint was `(userId, idempotencyKeyHash)`. This means the same caller key reused for a DIFFERENT operation or contact could incorrectly replay an unrelated prior consent event. E.g. `subscribe Contact A with key K` followed by `unsubscribe Contact B with key K` could return Contact A's subscribe result as a replay.

**Root cause:** The idempotency namespace was too broad — it didn't bind to the operation or the target resource.

**Permanent rule:** Idempotency identity MUST bind to:
```
tenant + operation + target + caller key
```
The unique constraint should be `(userId, operation, idempotencyKeyHash)` AND the target (contactId/email) must be verified to match the existing record before replay. If a caller reuses a key for a different target, throw `IdempotencyConflictError` (409), not a wrong replay.

For mutable request payloads, add a `requestFingerprint` (SHA-256 of canonicalized body) and detect same-key-different-body conflicts → 409 `idempotency_conflict`.

**Applies to:** All idempotent mutation endpoints.

## Lesson: Structural tenant isolation requires ownership FK, not merely a userId column

**Mistake (Phase 9 audit):** The schema claimed "cross-tenant writes are structurally impossible because unique constraints include userId". That's not sufficient. `ContactConsentEvent` stored `userId` + `contactId` but its FK was only `contactId → Contact.id`. The database itself permits a mismatched `(userId=tenantB, contactId=tenantAContact)` row if application code ever misbehaves.

**Root cause:** Application-level filters and independent unique indexes do not enforce parent/child tenant agreement. The DB itself must enforce the relationship.

**Permanent rule:** For tenant-owned child tables, use COMPOSITE FOREIGN KEYS that include `userId`:
```
ContactConsentEvent(userId, contactId) → Contact(userId, id)
SuppressionEvent(userId, suppressionId) → SuppressionEntry(userId, id)
```
This requires the parent to have `@@unique([userId, id])`. The DB then rejects any row whose `userId` disagrees with its parent's `userId` — no application bug can create a cross-tenant reference. Phase 8 already established this pattern with `ContactGroupMembership`; Phase 9 must follow it.

**Applies to:** All phases with tenant-owned child tables (consent events, suppression events, future broadcast analytics).

## Lesson: Idempotency must preserve no-op outcomes

**Mistake (Phase 9 audit v3):** Transition-event tables were used as the only idempotency store. A fresh idempotency key on an already-satisfied state (e.g. subscribing an already-subscribed contact) created a fake `subscribed → subscribed` transition event and reported `status = applied`. Additionally, a no-op request without a persisted idempotency outcome could be re-evaluated on retry against changed state, potentially applying a transition the original request did not apply.

**Root cause:** Request idempotency and domain transition history were conflated. The transition-event table records ACTUAL state transitions; idempotency records describe REQUEST OUTCOMES (which may be no-ops). A no-op is a valid request outcome that must be durably replayable.

**Permanent rule:** Idempotency records describe request outcomes; transition audit rows describe actual state transitions. These are separate concerns:
- A no-op request (target state already satisfied) MUST NOT create a fake transition event.
- A no-op request with an idempotency key MUST persist the no-op outcome to a DEDICATED idempotency table (not the transition-event table).
- A retry with the same key MUST replay the original outcome — even if the state has since changed. The original no-op must NOT suddenly become an applied transition.
- The idempotency outcome record and the state mutation/no-op decision MUST belong to the same transaction.

Schema: a dedicated `ConsentMutationIdempotency` (or equivalent) table with `(userId, operation, idempotencyKeyHash)` unique constraint, storing `resultStatus` ("applied" | "no_op" | "not_suppressed"), `resultEventId` (null for no-ops), `requestFingerprint` (for conflict detection), and `targetType`/`targetKey` (for target verification).

**Applies to:** Consent, suppression, Broadcast, billing, queue mutations — any idempotent endpoint where the target state may already satisfy the request.

## Lesson: Composite SET NULL must respect tenant NOT NULL columns

**Mistake (Phase 9 audit v3):** The `SuppressionEvent → SuppressionEntry` composite foreign key used `ON DELETE SET NULL`:
```sql
FOREIGN KEY ("userId", "suppressionId")
REFERENCES "SuppressionEntry"("userId", "id")
ON DELETE SET NULL
```
But `SuppressionEvent.userId` is `NOT NULL`. For a multi-column foreign key, plain `ON DELETE SET NULL` attempts to null ALL referencing FK columns unless a column subset is explicitly specified. This conflicts with the non-null tenant key and does not match the comment claiming suppression history safely survives parent deletion.

**Root cause:** PostgreSQL's `ON DELETE SET NULL` on a composite FK nulls all FK columns by default. When one of those columns is `NOT NULL` (the tenant key), the delete either fails at runtime or the schema is rejected. Column-specific `ON DELETE SET NULL (column)` is PostgreSQL-specific syntax that Prisma's schema DSL doesn't expose cleanly.

**Permanent rule:** On composite tenant foreign keys, never use plain `ON DELETE SET NULL` when the tenant column is non-nullable. Either:
1. Specify the nullable subset intentionally via raw SQL `ON DELETE SET NULL (suppressionId)` — but understand Prisma schema/migration drift, OR
2. Use `ON DELETE RESTRICT` / `NO ACTION` — the parent row cannot be deleted while children exist. This is preferred when the parent is a durable current-state record that should be lifted/deactivated, not physically deleted.

Phase 9 chose `RESTRICT`: SuppressionEntry rows are durable, lifted (active=false), never physically deleted. Audit history always remains attached.

**Applies to:** All composite tenant-safe foreign keys where the tenant column is NOT NULL.

## Lesson: Agent worklogs do not belong in product PRs

**Mistake (Phase 9):** `worklog.md` was committed to the repository as part of the Phase 9 PR diff, containing extensive agent/session history (Phase 5 UI work, sandbox health retries, etc.) unrelated to Phase 9 product behavior. This polluted the PR with hundreds of lines of non-product content.

**Root cause:** The worklog was a scratchpad used during development sessions. It was not permanent engineering documentation.

**Permanent rule:** Do not commit scratchpads, worklogs, transient debugging history, or agent session diaries to the repository. The only permanent process documents are:
- `docs/engineering/reliability-protocol.md` — mandatory operational rules
- `docs/engineering/agent-lessons.md` — reusable engineering lessons

`agent-lessons.md` is the permanent reusable-learning channel. If a worklog is needed during development, keep it in `.gitignore` or outside the repo. A PR diff should contain only product code, tests, schema, migration, and permanent engineering docs.

**Applies to:** All phases.

## Lesson: Terminal CAS does not prevent duplicate external side effects

**Mistake (Phase 10 audit):** The original broadcast processor established only `processing → sent|skipped|failed` via CAS. A worker that claimed a recipient into `processing` and then called `provider.send()` could be paused (serverless function freeze, crash, network partition). On recovery, another worker could re-claim the recipient and call `provider.send()` again — duplicate SMTP delivery.

**Root cause:** The terminal CAS (`processing → sent`) prevents the database from recording two `sent` rows, but it does NOT prevent two provider calls. The provider call is the external non-idempotent side effect. CAS on DB state alone cannot gate an external system that the DB does not observe.

**Permanent rule:** Before invoking an external non-idempotent side effect (provider.send, payment capture, webhook delivery, file write), establish a DURABLE EXCLUSIVE DISPATCH state that the CAS uniquely assigns to exactly one worker. The state must be:
1. Distinct from "claimed" (which only means "intends to process") — it must mean "permitted to dispatch and ONLY this worker".
2. Never auto-recovered to a re-dispatchable state — stale dispatch rows become terminal `failed` with a safe error code (`provider_outcome_unknown`), never re-queued.
3. Verified by the terminal CAS (`dispatching → sent WHERE lockedBy = workerId`) so a stale worker cannot overwrite the winner's terminal state.

For Phase 10 Broadcast, this is the `dispatching` recipient status between `processing` and terminal. The state machine becomes:
```
pending → processing → dispatching → sent | skipped | failed
```
`recoverStaleRecipients()` recovers ONLY `processing` rows (no external I/O yet). A SEPARATE function `recoverAbandonedDispatches()` transitions stale `dispatching` rows to terminal `failed` with `errorCode = provider_outcome_unknown` — never to `pending`.

**Applies to:** All phases with external side effects (provider dispatch, payment capture, webhook delivery, third-party API mutations).

## Lesson: Tests must not rewrite the specification

**Mistake (Phase 10 audit):** The "transactional Send is NOT affected by broadcast marketing eligibility" test contained `expect(true).toBe(true)` — a no-op assertion that always passes regardless of production behavior. The test was a placeholder masquerading as a regression assertion. The deleted-contact test expected the recipient row to be CASCADE-deleted (matching the broken `ON DELETE CASCADE` FK) rather than surviving (the actual spec).

**Root cause:** When production behavior diverges from the spec, the temptation is to relax the test to match production. This converts a bug into a "passing" test that hides the bug forever.

**Permanent rule:** Tests must encode the specification, NOT the implementation. If production contradicts the contract, fix production — don't redefine the test. Specifically:
- A test named "X does Y" MUST actually assert Y, not a vacuous truth.
- A test that documents broken behavior (e.g. "recipient is CASCADE-deleted") is itself broken — fix the implementation, then assert the correct behavior (e.g. "recipient survives with contactId=null").
- Never replace `expect(result).toBe(EXACT_VALUE)` with `expect(true).toBe(true)` or `expect(result).toBeGreaterThanOrEqual(0)` to make CI green.

**Applies to:** All phases with integration tests.

## Lesson: Commercial plan mappings are phase-owned product decisions

**Mistake (Phase 10 audit):** The original Phase 10 PR mapped `PRO: { access: true, quota: 10_000 }` for BROADCAST_EMAILS — a commercial decision invented outside the billing phase. The audit found this leaked into production config and tests were written against this mapping, making it harder to revert without breaking tests.

**Root cause:** A feature implementation phase (Phase 10 — Broadcasts) made a commercial pricing decision (which plan tier gets which quota) that belongs to the billing phase. This couples the broadcast implementation to a pricing model that may change.

**Permanent rule:** Feature implementation phases MUST NOT invent commercial plan mappings. The default for any new feature key is:
```ts
FREE: { access: false, quota: 0, ratePerMin: 0 },
PRO:  { access: false, quota: 0, ratePerMin: 0 },  // gated off until billing phase
MAX:  { access: true, quota: <placeholder>, ratePerMin: <placeholder> },
```
Tests that need the feature MUST use `plan: "MAX"` (the only plan with access). When the billing phase decides commercial mapping, it updates the config in a single PR. This decouples implementation from pricing.

**Applies to:** All feature phases that introduce new entitlement keys (broadcasts, future marketing features).

## Lesson: Untrusted HTML cannot self-certify compliance

**Mistake (Phase 10 audit):** The original `ensureUnsubscribeFooter()` checked for the presence of a `data-unsubscribe` marker and skipped appending the system footer if found. This trusted the campaign author to include a real unsubscribe link merely because they included the marker. An author could include `<div data-unsubscribe></div>` (a fake marker with no actual link) to bypass the compliance requirement.

**Root cause:** A marker is an untrusted author-controlled attribute. Its presence does not prove the author included a real unsubscribe link. Self-certification of compliance by the party that wants to bypass compliance is not a valid compliance strategy.

**Permanent rule:** Compliance with legal/security requirements (CAN-SPAM unsubscribe footer, RFC 8058 List-Unsubscribe header, DKIM signing) MUST be enforced by the system, not self-certified by the content author. Specifically:
1. Strip any author-provided compliance markers from the content.
2. Append the system-controlled compliance element unconditionally.
3. The author cannot remove compliance by deleting a variable, omitting a marker, or including a fake marker.

For Phase 10: `ensureUnsubscribeFooter()` strips `data-unsubscribe` markers from author HTML, then ALWAYS appends the canonical system footer containing the `{{unsubscribe_url}}` variable (substituted per-recipient at render time).

**Applies to:** All phases with user-authored content that must meet compliance requirements (unsubscribe footers, DMARC/DKIM headers, GDPR consent banners, accessibility statements).

## Lesson: Terminal CAS does not prevent duplicate external side effects

**Mistake (Phase 10):** A stale worker could lose DB ownership (terminal CAS prevented DB overwrite) but still call the external email provider — resulting in duplicate marketing emails sent to the same recipient.

**Root cause:** The terminal CAS (processing → sent WHERE lockedBy=workerId) only protects the DATABASE row. It does NOT undo an email already sent externally. If Worker A claims a recipient, gets paused, and Worker B reclaims it, Worker A might still be in the middle of `provider.send()` when Worker B also sends.

**Permanent rule:** Before an external non-idempotent side effect (email send, payment, webhook), establish a DURABLE exclusive dispatch state via CAS:
```
UPDATE ... SET status='dispatching' WHERE id=X AND status='processing' AND lockedBy=workerA
```
Only the worker that wins this CAS may call the provider. Stale `dispatching` rows are NEVER auto-requeued to `pending` — they become terminal `failed` with `errorCode=provider_outcome_unknown`. This prevents duplicate external side effects at the cost of occasional manual review.

**Applies to:** All phases with external side effects (email, payments, webhooks, SMS).

## Lesson: Tests must not rewrite the specification

**Mistake (Phase 10):** The deleted-Contact test was changed from `expect(skipped).toBe(1)` to `expect(processed).toBe(0)` because the implementation used `ON DELETE CASCADE` which deleted the recipient row. The test was rewritten to match the bug rather than the specification.

**Root cause:** When production contradicts the contract, it's easier to change the test than fix the code. But this hides the bug and ships non-compliant behavior.

**Permanent rule:** If production contradicts the specification, FIX PRODUCTION. Do NOT redefine the test expectation to match the bug. The test encodes the spec, not the implementation. A passing test with the wrong expectation is worse than a failing test with the right expectation.

**Applies to:** All phases.

## Lesson: Commercial plan mappings are phase-owned product decisions

**Mistake (Phase 10):** The PRO tier for `BROADCAST_EMAILS` was changed from `{ access: false, quota: 0 }` to `{ access: true, quota: 10_000 }` merely to make integration tests convenient — without a product decision about pricing.

**Root cause:** Test convenience drove a commercial product decision that belongs to a future billing/pricing phase.

**Permanent rule:** Do NOT invent pricing/plan mappings outside the dedicated plans/billing phase. Tests should use a plan that already has the entitlement (e.g. `plan: "MAX"`). If no existing plan has access, the feature is not ready for testing — add it to MAX (the highest tier) as a placeholder, never to PRO/FREE.

**Applies to:** All phases with plan-gated features.

## Lesson: Untrusted HTML cannot self-certify compliance

**Mistake (Phase 10):** The unsubscribe footer enforcement trusted a `data-unsubscribe` HTML marker. Campaign authors control the HTML, so they could include a fake marker (`<div data-unsubscribe></div>`) with no actual unsubscribe link, bypassing the compliance footer.

**Root cause:** An author-controlled attribute was treated as proof that a mandatory compliance element exists. But the author has no incentive to include a working unsubscribe link — they want to maximize opens.

**Permanent rule:** An author-controlled marker/attribute is NOT proof that a mandatory compliance element exists. System-controlled unsubscribe content must be enforced independently:
1. Strip any author-provided compliance markers from the content.
2. Append exactly one system-controlled footer after sanitization.
3. The footer contains the per-recipient `{{unsubscribe_url}}` variable.
4. The author cannot remove the footer, cannot substitute an arbitrary URL, and cannot create an empty marker to suppress it.

**Applies to:** All phases with user-authored HTML email content (broadcasts, future templates).

## Lesson: Structural tenant safety cannot be traded away for delete semantics

**Mistake (Phase 10 audit):** Composite Contact ownership on BroadcastRecipient was replaced with a single-column FK to make `ON DELETE SET NULL` easy. This lost the DB-enforced tenant agreement — a cross-tenant Contact reference was only caught at the application layer.

**Root cause:** The Phase 9 lesson (composite SET NULL on NOT NULL userId fails) was applied too broadly. The correct fix is to make BOTH FK columns nullable (contactOwnerUserId + contactId), not to drop the composite FK entirely.

**Permanent rule:** When retention-on-delete conflicts with tenant-safe composite ownership, redesign the nullable reference structure so BOTH invariants remain DB-enforced. Never fall back to application-only tenant agreement. Use a separate nullable `contactOwnerUserId` column so the composite FK `(contactOwnerUserId, contactId) → Contact(userId, id)` can null safely without touching the NOT NULL `userId`.

**Applies to:** All phases with tenant-owned child tables where the parent may be deleted.

## Lesson: Eligibility categories must be mutually exclusive

**Mistake (Phase 10 audit):** Preview counted a subscribed+suppressed Contact in BOTH `eligible` and `suppressed`. The categories were not mutually exclusive, breaking the invariant `total = eligible + suppressed + unsubscribed + unknown`.

**Root cause:** The preview counted `subscribed` contacts as `eligible` first, then separately counted suppressions. A suppressed subscribed contact appeared in both buckets.

**Permanent rule:** Any audience eligibility breakdown must derive from the actual send predicate and use mutually exclusive categories whose sum equals total. The canonical classification is:
```
CASE
  WHEN active suppression exists THEN 'suppressed'
  WHEN marketingStatus = 'subscribed' THEN 'eligible'
  WHEN marketingStatus = 'unsubscribed' THEN 'unsubscribed'
  ELSE 'unknown'
END
```
A subscribed + suppressed contact is `suppressed`, NOT `eligible`.

**Applies to:** All phases with eligibility/preview functionality.

## Lesson: Idempotency must serialize concurrent first execution

**Mistake (Phase 10 audit):** Sequential replay worked, but two simultaneous first requests with the same new key could both pass the pre-check (no existing record) and race before the idempotency row was inserted. The loser received a "no longer in draft status" error instead of replaying the original outcome.

**Root cause:** The idempotency check was a pre-check + unique insert, but the pre-check was outside the transaction. Two concurrent calls could both see no existing record.

**Permanent rule:** Idempotency requires concurrency serialization BEFORE the protected state transition, not just a pre-check plus unique insert. Use `pg_advisory_xact_lock` inside the transaction, then re-check for the idempotency record INSIDE the transaction after acquiring the lock. The first caller proceeds; the second caller sees the first caller's committed record and replays. The durable idempotency outcome MUST be committed while the canonical serialization lock is still held and in the SAME transaction as the protected mutation — no correctness-critical idempotency persistence may occur after the transaction commits.

**Applies to:** All phases with concurrent idempotent mutations.

## Lesson: Result counters must be evidence-based

**Mistake (Phase 10 audit):** Terminal result counters (`result.sent++`, `result.failed++`, `result.skipped++`) were incremented after calling `updateMany` without checking whether the CAS actually succeeded (`count === 1`). A stale worker that lost the terminal CAS still incremented the counter.

**Root cause:** The counter increment was based on the INTENT to mutate, not the EVIDENCE of a successful mutation. A successful external operation (e.g. `provider.send()`) or attempted DB update does not prove a terminal DB transition succeeded.

**Permanent rule:** Every terminal helper must return `boolean` (whether `updateMany.count === 1`). Counters (`sent`, `skipped`, `failed`, `quotaPaused`) must only increment when the CAS actually succeeds. Evidence must come from the mutation count, not from the intention to mutate. For `quotaPaused`, only set it when the Broadcast actually wins the `sending → paused_quota` CAS or a re-read confirms the canonical state is already paused.

**Applies to:** All phases with terminal state transitions and result accounting.

## Lesson: Regression tests must execute the claimed production path

**Mistake (Phase 10 audit):** The transactional-Send regression test caught a `template_not_found` error and called that proof of successful sending. The dispatch-race test manually recreated the CAS instead of exercising the real `processRecipient()` path.

**Root cause:** Tests were written to be easy to pass, not to prove the claimed behavior. A caught failure is not proof of success.

**Permanent rule:** If the claim is "production path performs X", the regression must call that production path and observe X directly. Do not substitute a mock/simplified path for the real one. Do not catch expected failures and call that proof. The test must exercise the actual function/route that production uses.

**Applies to:** All phases with regression tests.

## Lesson: Provider capability declarations belong on the interface, not in caller branching

**Mistake (Phase 11 design review):** Initially planned to inspect provider class names (`instanceof SmtpEmailProvider`) to decide whether to wire webhook ingestion / suppression automation. This would have coupled the deliverability service to the concrete provider class, defeating the purpose of the v2 interface abstraction.

**Root cause:** It's tempting to use type inspection because it feels simpler than declaring capabilities. But every new provider (Resend, SES, SendGrid) would then require a code change in every caller that branches on provider behavior.

**Permanent rule:** Provider capability declarations (`deliveryWebhooks`, `bounceEvents`, `complaintEvents`, etc.) live on the `EmailProvider` interface as a static `capabilities` field. Callers branch on `provider.capabilities.deliveryWebhooks`, NEVER on `provider instanceof X`. Adding a new provider = adding one file + one entry in the factory + one entry in the webhook-capable set. No caller changes.

**Applies to:** All phases with provider/adapter abstractions.

## Lesson: SMTP acceptance ≠ inbox delivery — persist the distinction

**Mistake (Phase 11 design):** Almost collapsed `provider_accepted` and `delivered` into a single "sent" status, reusing the Phase 4 messaging `sent` semantics. This would have lost the distinction between "the upstream MTA accepted the envelope" and "the recipient's inbox received the message" — which is the entire point of Phase 11 deliverability tracking.

**Root cause:** Without a real webhook-capable provider configured, the SMTP path always ends at `provider_accepted` and the distinction looks academic. But the state machine MUST be designed for the future webhook-capable case from day one — retrofitting a `delivered` state later would require a data migration and break dashboards that already shipped counting `provider_accepted` as "delivered".

**Permanent rule:** Email delivery state machines distinguish `queued` (pre-dispatch) → `provider_accepted` (envelope accepted by upstream MTA) → `delivered` (webhook confirmed inbox delivery). These are THREE different states, not two. The current provider may not exercise all three (SMTP stops at `provider_accepted`), but the schema and state machine must support all of them. `provider_accepted` MUST NOT be reported to users as "delivered" — that's a deliverability lie.

**Applies to:** All phases with provider deliverability tracking.

## Lesson: Suppression reason determines liftable-by-resubscribe policy

**Mistake (Phase 9 → Phase 11 evolution):** Phase 9's `subscribeContact()` lifted ANY active suppression on resubscribe, with a code comment explicitly saying "Phase 11 hard_bounce/complaint will need separate logic." If a future provider emitted a hard bounce and then the user clicked "resubscribe" via the dashboard, the suppression would have been silently lifted — re-enabling sending to an address the upstream MTA had explicitly rejected.

**Root cause:** Phase 9 only wrote `unsubscribe` and `manual` suppressions, both of which are user/dashboard choices that the same actor can reverse. The original "lift any active suppression" logic was correct for THAT universe of reasons. Phase 11 introduces provider-driven reasons (`hard_bounce`, `complaint`) which represent external signals — the recipient's mailbox provider told us to stop. Routine resubscribe MUST NOT lift those.

**Permanent rule:** Maintain a `NON_LIFTABLE_BY_RESUBSCRIBE` set of suppression reasons (initially `{hard_bounce, complaint}`). `subscribeContact()` MUST throw `ResubscribeBlockedError` when an active suppression with one of these reasons exists. Only an explicit admin action (`unsuppressEmail({alsoSubscribe: false})` followed by a separate subscribe call, or a future admin-only "force lift" endpoint) can lift these. The check must happen INSIDE the canonical lock tx — never as a pre-check before acquiring the lock (a concurrent suppression could be inserted between check and lock).

**Applies to:** All phases that extend the suppression reason set.

## Lesson: A nested `db.$transaction()` can commit while the outer transaction rolls back

**Mistake (Phase 11 audit):** `ingestProviderEvent()` ran inside a `db.$transaction()` and called `suppressEmail()`, which opened its OWN `db.$transaction()`. If the outer delivery-event transaction rolled back (e.g. on a late P2002 from `(provider, providerEventId)` dedup), the suppression could still commit independently — leaving a durable SuppressionEntry whose triggering event was never persisted. A subsequent replay would see no event row but an active suppression, breaking the audit chain.

**Root cause:** Prisma's `db.$transaction(async (tx) => { ... })` does NOT detect that an inner `db.$transaction()` is nested — it opens a fresh connection. The inner tx's commit is independent of the outer tx's outcome. The canonical advisory lock is re-entrant (transaction-scoped) but the writes are not atomic across the two transactions.

**Permanent rule:** Any mutation primitive that may be called from inside an existing transaction MUST accept a `tx` parameter (e.g. `suppressEmailInTx(tx, opts)`). The public wrapper (`suppressEmail(opts)`) opens its own transaction and delegates to the in-tx primitive. Callers that already hold a `db.$transaction` MUST call the in-tx primitive directly, NEVER the wrapper. The rule applies to every side-effecting service function: suppression, consent state transitions, idempotency outcome persistence, audit event appends. If you cannot refactor the callee to accept a `tx`, you cannot call it from inside a transaction.

**Applies to:** All phases with service functions that wrap side effects in `db.$transaction()`.

## Lesson: A post-provider persistence failure must NOT be treated as a provider error

**Mistake (Phase 11 audit):** When `provider.send()` returned successfully but the subsequent `updateDeliveryAfterProviderSend()` threw (DB error), the broadcast/messaging catch block fell through to `markDeliveryFailed()` — recording the delivery as `failed` even though the upstream MTA HAD accepted the envelope. A subsequent idempotent replay saw a `failed` EmailDelivery next to a `sent` EmailMessage — an inconsistent state. Worse, future "retry failed deliveries" tooling would re-send the same message, double-delivering to the recipient.

**Root cause:** The `.catch(() => {})` swallowing pattern conflated "provider error" (provider threw) with "persistence error" (DB write failed after provider accepted). Both went down the `failed` path. The state machine had no way to express "we don't know the durable outcome".

**Permanent rule:** Email delivery state machines MUST have an explicit `unknown` state distinct from `failed`. The `unknown` state means "provider.send() succeeded but we could not durably record the outcome." Transitions:
- `queued → unknown` when persistence fails after provider acceptance (CAS-based, never regresses other states).
- `unknown → delivered | bounced | complained | rejected` allowed ONLY via a newer webhook event (the deterministic-ordering rule applies).
- `unknown → failed` and `unknown → deferred` are BLOCKED (we already believe the email was sent — failing or deferring it would lie).

The `unknown` state MUST NOT be auto-retried. Broadcast stale recovery (`recoverAbandonedDispatches`) MUST skip recipients whose EmailDelivery is `unknown` — auto-failing them would corrupt the broadcast's terminal counters. Idempotent Send replay MUST check if a delivery already exists (via the EmailMessage idempotency key) BEFORE calling `provider.send()` again, so a persistence failure does not trigger a duplicate external send.

Callers MUST NOT use `.catch(() => {})` on delivery state mutations. Errors must propagate or be explicitly logged. The acceptable pattern is `try { updateDeliveryAfterProviderSend(...) } catch { markDeliveryUnknown(...) }` — never `try { ... } catch { markDeliveryFailed(...) }`.

**Applies to:** All phases with provider-acceptance-then-persistence flows.

## Lesson: Composite foreign keys for source correlation require nullable owner columns

**Mistake (Phase 11 initial migration):** `EmailDelivery` had `emailMessageId` and `broadcastRecipientId` as plain nullable columns with no FK. The application enforced tenant agreement (the referenced parent row must belong to the same `userId`) at read time via composite `findFirst` queries. A bug in the read path could let a cross-tenant EmailDelivery row reference another tenant's EmailMessage, with no DB-level rejection.

**Root cause:** Adding a composite FK `(userId, emailMessageId) → EmailMessage(userId, messageId)` with `ON DELETE SET NULL` fails when `userId` is NOT NULL on the child table — Postgres cannot set a NOT NULL column to NULL on parent delete, so the delete fails. The Phase 10 lesson (separate nullable `contactOwnerUserId` column on `BroadcastRecipient`) was not applied to the new Phase 11 schema.

**Permanent rule:** Composite FKs with `ON DELETE SET NULL` on a child table whose `userId` is NOT NULL MUST use a separate nullable owner column (e.g. `emailMessageOwnerUserId Int?`). The composite FK becomes `(emailMessageOwnerUserId, emailMessageId) → EmailMessage(userId, messageId)` — both columns are nullable, so `SET NULL` works without touching the immutable tenant owner. The application populates the owner column with `opts.userId` when the correlation column is set, and `null` when it is not. The partial unique index `(userId, emailMessageId) WHERE emailMessageId IS NOT NULL` enforces one-delivery-per-source deduplication while allowing multiple NULL rows.

This pattern is mandatory for EVERY tenant-owned child table that references another tenant-owned parent via a composite FK. Single-column FKs to a globally-unique column (e.g. `messageId @unique`) do NOT enforce tenant agreement — only the composite FK does.

**Applies to:** All phases with cross-table source correlations.

## Lesson: Generated agent artifacts must be gitignored, never committed

**Mistake (Phase 11 audit):** The `tool-results/` directory (created by the agent's `Read` tool when file output exceeded inline limits) was sitting in the working tree untracked. Without a `.gitignore` entry, a careless `git add .` would commit large auto-generated text files to the repository — polluting history and wasting review time.

**Root cause:** The agent runtime creates scratch directories for large tool outputs, but the project's `.gitignore` did not enumerate them. A subsequent `git add -A` would silently stage them.

**Permanent rule:** Every scratch / generated / tool-output directory MUST be listed in `.gitignore` from day one. The reliability protocol MUST be amended to verify `.gitignore` covers:
- `tool-results/` (agent Read tool overflow)
- `*.tsbuildinfo` (TypeScript incremental build cache)
- `db/custom.db*` (local SQLite)
- Any directory created by the agent runtime that is not part of the application source.

Before every commit, `git status` MUST be reviewed for untracked files that do not belong in the repository. If a file is auto-generated by a tool, it MUST NOT be committed — the `.gitignore` entry is the durable fix, not a one-off `git rm`.

**Applies to:** All phases — agent-generated artifacts must never reach the remote.

## Lesson: Composite nullable FK requires three invariants

A tenant-safe nullable composite reference needs all three:
1. Composite FK (proves parent exists)
2. both-null/both-present CHECK (prevents MATCH SIMPLE bypass)
3. nullable owner == canonical row tenant CHECK (prevents cross-tenant owner mismatch)

Without all three, PostgreSQL MATCH SIMPLE or a mismatched owner column can bypass intended tenant isolation.

**Applies to:** All phases with nullable composite FKs.

## Lesson: External side-effect boundaries require separate catch scopes

Never wrap provider I/O and post-provider DB persistence in the same generic catch. Once the external provider may have accepted the message, later DB errors are persistence ambiguity, not provider failure. The `unknown` state models this ambiguity — it is never auto-retried.

**Applies to:** All phases with external I/O + DB persistence.

## Lesson: Event occurrence time must not be overwritten by local processing time

Fields representing provider `occurredAt` (e.g. `lastProviderEventAt`) can only be advanced by actual provider events. A local persistence timestamp must not overwrite it — otherwise legitimate provider events with `occurredAt` between the real event time and the local write time can incorrectly look stale.

**Applies to:** All phases with provider event correlation.

## Lesson: A rollback test must cause a rollback

A test that simply skips a side effect (e.g. "contact deleted → no email → no suppression") is NOT evidence of transaction rollback. A real rollback test must cause a mutation to execute and then force the transaction to fail, proving all mutations rolled back atomically.

The safe way to force a deterministic failure inside a production transaction path is a test-only fault-injection hook at the service boundary. The hook MUST satisfy four invariants:
1. **Impossible to activate from HTTP input** — the fault name is a module-level variable, not a request field. No route handler reads it.
2. **Impossible to activate from production env/config** — the setter throws unless `NODE_ENV === "test"`. The getter also returns null when `NODE_ENV !== "test"`.
3. **Not exported as product behavior** — the public surface is prefixed with `__` (double underscore) to signal test-only.
4. **Deterministic** — setting a fault name causes exactly one failure point at a known location.

Prefer a dependency/test hook at the service boundary over deliberately corrupting production schema (which is forbidden by the reliability protocol).

**Applies to:** All phases with transactional side-effect tests.

## Lesson: CAS APIs must return transition evidence

**Mistake (Phase 11 audit v3):** Delivery transition helpers (`markDeliveryFailed`, `markDeliveryUnknown`, `updateDeliveryAfterProviderSend`) used `updateMany()` with a `WHERE currentStatus = QUEUED` CAS predicate but discarded the `count` return value. They returned `Promise<void>`. Callers could only know what they *attempted*, not what *actually happened*. A stale caller that lost the CAS could not distinguish "I won queued → failed" from "another worker/webhook already advanced the state."

**Root cause:** Intent was treated as evidence. The `updateMany` call does return a `count`, but the helper threw it away, forcing callers to infer the transition from the absence of a throw — which is NOT the same as a successful CAS.

**Permanent rule:** Any correctness-critical CAS helper MUST return explicit transition evidence and, when useful, the canonical resulting state. The return type:

```ts
type DeliveryTransitionResult = {
  changed: boolean;                    // true iff updateMany.count === 1
  currentStatus: DeliveryStatus | null; // new state if changed; re-read canonical state if not
};
```

When `changed === false` (count === 0), the helper MUST re-read the canonical `currentStatus` so callers can inspect the actual state and act accordingly — they MUST NOT infer the transition they attempted. Callers MUST consume `changed` and base decisions on the evidence, never on intent. This applies to every CAS helper: queued → provider_accepted, queued → rejected, queued → failed, queued → unknown.

**Applies to:** All phases with correctness-critical compare-and-swap state transitions.

## Lesson: Promise resolution is not provider acceptance

**Mistake (Phase 11 audit v3):** A provider adapter's `send()` method can resolve successfully with `accepted: false` (a normalized rejection — the provider declined the message for policy/recipient reasons but did not throw). The business send paths (transactional Send + Broadcast) treated a resolved promise as acceptance and unconditionally marked the source record (`EmailMessage` / `BroadcastRecipient`) as `sent`. This persisted a `sent` status for a message the provider explicitly rejected.

**Root cause:** Provider transport success (the promise resolved) and provider acceptance (the provider agreed to deliver the message) were conflated into a single code path. The v2 provider interface explicitly distinguishes `accepted: boolean` in `ProviderSendResult`, but the callers ignored it after the CAS update.

**Permanent rule:** Provider transport success and provider acceptance are separate states. Business send status MUST consume the normalized `accepted` result:

- `accepted === true` → source record becomes `sent` (provider accepted the envelope).
- `accepted === false` → source record becomes `rejected` / `failed` (provider returned a normalized rejection). This is NOT the exception path — do not throw it into the network/provider-error catch. Do not consume a second quota unit. Do not retry blindly. No automatic duplicate provider call.

The EmailDelivery state machine already distinguishes `provider_accepted` from `rejected` via `updateDeliveryAfterProviderSend`. The source record (EmailMessage / BroadcastRecipient) MUST reflect the same distinction consistently. A resolved provider promise is never sufficient evidence to mark a source record `sent`.

**Applies to:** All phases with provider send flows where the provider can normalize a rejection without throwing.

## Lesson: Transaction atomicity requires production-path rollback tests

**Mistake (Phase 11 audit v3):** The "transaction rollback" test for `ingestProviderEvent` did not actually cause a rollback. Its own implementation deleted the contact so `lookupDeliveryEmail` returned null, suppression was skipped (degraded gracefully), and the event WAS recorded. That proved graceful degradation, NOT atomicity. A test named "rollback" that does not cause a rollback is worse than no test — it creates false confidence.

**Root cause:** Testing an internal transaction primitive separately (e.g. `suppressEmailInTx` rolls back when the outer tx rolls back) is NOT sufficient when the claim concerns a larger production workflow (`ingestProviderEvent` is atomic). The primitive test proves the primitive; the production-path test proves the composition.

**Permanent rule:** When the claim is "production function X is atomic," the regression test MUST call the REAL production function X and force a deterministic failure at a precise point inside its transaction, then assert every earlier mutation rolled back. Inject the failure through the real production path using a safe test-only fault hook (see the "rollback test must cause a rollback" lesson). Do not substitute a mock/simplified path. Do not catch expected failures and call that proof. Assert:
- event count delta = 0 (the event insertion rolled back)
- currentStatus unchanged (the state update rolled back)
- suppression current state unchanged (the suppression rolled back)
- suppression history count delta = 0 (the suppression event rolled back)

Two distinct tests are required: one that fails AFTER all steps succeed (proves the whole tx rolls back), and one that fails DURING a downstream step (proves earlier steps roll back when a later step fails).

**Applies to:** All phases with production workflows claimed to be transactional.


## Lesson: Client synchronization must not undo local state

**Mistake (Phase 12 audit):** The `LocaleProvider` used a sync effect with deps `[initialLocale, locale]`. When the user selected a new locale (setting local state), the effect fired (because `locale` changed), saw that `initialLocale !== locale`, and reverted local state back to `initialLocale` — undoing the user's choice. The UI appeared to "not switch" or "flash back" to the original locale.

**Root cause:** The effect that syncs authoritative props to local state depended on the local state it was mutating. This created a feedback loop: every local state change re-triggered the sync, which reverted the change.

**Permanent rule:** Effects that sync authoritative props to local state must depend on the PROP only, not on the local state they mutate. The deps array should be `[authoritativeProp]`, not `[authoritativeProp, localState]`. The effect reacts to genuine prop changes (e.g. server sends a new locale after navigation), not to every local update. Local state is the source of truth between prop updates — do not clobber it.

**Applies to:** All phases with client-side state synchronized from server props.

## Lesson: Out-of-band locale resolution requires request context

**Mistake (Phase 12 audit):** The Phase 13 locale helper `resolveUserLocale(userId)` only read `User.preferredLocale` and fell back to `en`. This is insufficient for signup flows where a `User` row may not exist yet. A signup OTP sent to an Iran-Geo visitor with no User row would always render in English, even though the product requirement is Persian for first-visit Iran traffic.

**Root cause:** The helper conflated "stored preference" with "complete locale resolution." Stored preference is only ONE signal in the canonical precedence. Signup/first-contact flows need the full resolution chain (cookie → Geo → Accept-Language → default) because no stored preference exists.

**Permanent rule:** Locale helpers consumed by out-of-band rendering (emails, webhooks, background jobs) must accept the request context (or its signals) when the User row may not exist. A `resolveRequestUserLocale({ request, userId? })` shape handles both authenticated (userId present) and signup (userId null) cases. The helper delegates to the canonical `resolveLocale()` with the appropriate signals — it does NOT reimplement Geo or Accept-Language detection. The stored-preference-only helper (`resolveUserLocale(userId)`) may exist for contexts where request signals are genuinely unavailable (e.g. a cron job with no HTTP request), but must NOT be documented as the complete resolver.

**Applies to:** All phases with out-of-band locale-sensitive rendering (OTP emails, notification emails, webhook-triggered flows).

## Lesson: Framework-internal headers are not product contracts

**Mistake (Phase 12 audit):** The root layout reconstructed the request URL from undocumented Next.js internal headers (`x-url`, `x-invoke-path`, `x-invoke-query`) to read the `?locale=` query param. These headers are framework implementation details — they can change between Next.js versions without notice, breaking the locale resolution silently.

**Root cause:** Next.js App Router does not expose a clean server-side API for reading the current URL query in a server component layout. The temptation was to use whatever headers the framework happened to set internally. But undocumented internals are not a stability contract — they are implementation details that can change in any release.

**Permanent rule:** Do not depend on undocumented framework headers for product correctness. If the framework does not expose a supported API for what you need, create your own controlled contract: have the middleware (which DOES have a supported `request.nextUrl` API) read the query param, validate it, and write a PRIVATE, namespaced header (e.g. `x-nixify-url-locale`) that the layout reads. The middleware always overwrites or deletes this header — never trust an incoming client-supplied copy. This is a controlled internal contract between your own code, not a dependency on framework internals.

**Applies to:** All phases with Next.js App Router server components that need request-level data not exposed by `headers()` / `cookies()`.

## Lesson: Localization coverage is route-level

**Mistake (Phase 12 audit):** The Phase 12 report claimed the dashboard was localized because translation dictionaries existed and the sidebar was wired. But the actual production screens (contacts, groups, imports, suppressions, templates, events, webhooks, broadcasts, analytics) still contained hardcoded English strings. Translation dictionaries do not prove production screens are localized — a screen is localized only when its production component actually consumes `useTranslations()`.

**Root cause:** "Localization coverage" was measured at the infrastructure level (dictionaries exist, provider exists, hooks exist) rather than at the route/component level (each screen actually renders translated text). The former is necessary but not sufficient; the latter is the user-visible outcome.

**Permanent rule:** Localization coverage must be audited at the route/component level, not the infrastructure level. A screen is localized only when its production component consumes `useTranslations()` for all product-owned UI strings. Translation dictionaries are the vocabulary; wired components are the sentences. Claim "contacts screen is localized" only when `src/app/dashboard/contacts/page.tsx` actually calls `t("contacts.title")` and renders the Persian value for `fa` locale. Do not claim coverage from the existence of the i18n module alone.

**Applies to:** All phases with UI localization.

## Lesson: Fallback tests must actually remove the primary value

**Mistake (Phase 12 audit):** The Persian→English fallback test looked up a key that existed in BOTH the Persian and English production dictionaries. The test proved "fa returns Persian value" — but that is NOT the fallback behavior. The fallback is "fa missing a key → English value." The test was a tautology: the production Persian dictionary is complete, so the fallback path was never exercised.

**Root cause:** The test couldn't create a "missing Persian key" condition without either (a) deliberately shipping a missing production Persian string (bad — ships broken UX) or (b) monkey-patching the module (fragile). So it tested the non-fallback path and called it "fallback."

**Permanent rule:** A fallback test must create the missing-primary condition. Extract the lookup logic into a pure helper that accepts explicit dictionaries as a parameter (`translateFromDictionaries(locale, key, dictionaries)`). The test passes a custom dictionary where the primary locale is missing the key and asserts the fallback locale's value is returned. This tests the actual fallback branch deterministically, without modifying production data. The production `translate()` delegates to this pure helper for the core lookup — no duplicated logic.

**Applies to:** All phases with fallback behavior (translations, feature flags, default configs).


## Lesson: Matcher expansion can silently widen authentication scope

**Mistake (Phase 12 audit):** The middleware matcher was expanded from `/profile/:path*`, `/dashboard/:path*`, `/admin/:path*` to a catch-all (`/((?!api|_next|...).*)`) so the `x-nixify-url-locale` header could be injected on every user-facing page. However, the authorization logic at the bottom of the middleware was unconditional — after the admin branch, every remaining request hit the `if (!session) { redirect("/auth") }` block regardless of pathname. This meant anonymous visitors to public pages (`/`, `/auth`, `/login`, `/signup`) were redirected to `/auth`. Since `/auth` itself matched the catch-all, it created a self-redirect lockout of all public pages.

**Root cause:** The matcher and the auth guard were not co-designed. The matcher determines WHICH requests enter the middleware; the auth guard determines WHICH of those require a session. Expanding the matcher without re-scoping the auth guard caused the guard to apply to routes it was never intended to protect. The comment said "user pages (/profile/*, /dashboard/*)" but the code did not check the pathname before requiring a session.

**Permanent rule:** Whenever middleware matcher scope expands, re-audit EVERY side effect and authorization branch against the new route population. Locale/observability concerns may be global (inject a header on every page); authentication must remain explicitly path-scoped. Extract a helper like `isProtectedUserPath(pathname)` and guard ONLY those paths — pass through everything else with the global side effect (locale header) but WITHOUT a login requirement. Admin isolation must be separately scoped (`/admin/*`) and must NOT use the normal user-session logic. Public pages must remain public.

**Applies to:** Middleware, proxies, auth guards, request rewriting, localization, rate limiting — any middleware that combines global concerns with path-scoped authorization.


## Lesson: Accidental dependency drift must become either reverted or explicitly accepted

**Mistake (Phase 12 audit):** A lockfile regeneration (needed to add test dev dependencies) silently upgraded unrelated framework and toolchain packages: Next.js 16.1.3 → 16.3.5, eslint-config-next 16.1.3 → 16.3.5, ESLint 9.39.2 → 9.39.5, eslint-plugin-react-hooks 7.0.1 → 7.1.1, next-auth 4.24.13 → 4.24.15, next-intl 4.7.0 → 4.14.5. The new react-hooks plugin version enabled two new lint rules (`set-state-in-effect`, `preserve-manual-memoization`) that flagged pre-existing code. The initial response was to globally disable both rules to make CI green — hiding the drift behind a lint suppression.

**Root cause:** `bun install` without `--frozen-lockfile` resolves to the latest compatible versions within semver ranges. When new dependencies are added, the lockfile is regenerated, and ALL transitive dependencies may shift. This is not a bug in bun — it is how package resolution works. The mistake was treating the resulting upgrades as "lockfile noise" rather than auditing them.

**Permanent rule:** When a lockfile operation changes unrelated dependencies:
1. **Detect the drift** — compare the old and new lockfiles for version changes beyond the intended additions.
2. **Either restore the previous dependency graph** (by pinning versions or reverting the lockfile and re-adding only the intended deps), **OR explicitly promote the changes to an intentional upgrade.**
3. **Review compatibility/security impact** — read the changelogs of upgraded packages, especially framework and lint packages.
4. **Rerun affected integration boundaries** — lint rules, type checking, production build, and any framework-behavior-dependent tests.
5. **Document the final versions** in the PR description under a "Dependency / security refresh" section.

Never silently accept dependency drift. Never disable lint/security/correctness checks merely to make an accidental upgrade pass. If a new lint rule flags pre-existing code, audit every diagnostic: fix the code if it's a real bug, or use the narrowest possible per-file/per-line suppression with justification. Global rule suppression without an explicit audit is a blocker.

**Applies to:** All phases that modify `package.json` or regenerate lockfiles.

## Lesson: Framework runtime tests must use framework runtime objects

**Mistake (Phase 12 audit):** The middleware tests built a hand-made request object with a fake `nextUrl`, fake `clone()`, fake `cookies`, and cast it with `as any`. This did not prove that the middleware works with the real Next.js `NextRequest` class — it only proved the middleware works with the test's own stub. When Next.js upgraded from 16.1.3 to 16.3.5, the stub did not reflect real framework behavior changes (e.g. `nextUrl.clone()` semantics, cookie access, redirect URL construction).

**Root cause:** The middleware accesses `req.nextUrl.pathname`, `req.nextUrl.searchParams`, `req.nextUrl.clone()`, `req.cookies.get()`, and `req.headers`. Building a stub that implements all of these correctly is fragile — any framework behavior change in how `NextRequest` works would not be caught by the test.

**Permanent rule:** If the contract depends on `NextRequest`, URL cloning, cookies, headers, or middleware behavior, tests MUST use the real framework object (`new NextRequest(url, { headers })`). A hand-built object cast with `as any` does not prove framework integration behavior. Authentication and external-service dependencies MAY remain mocked (they are not framework behavior), but the request/response objects must be real. This ensures that framework upgrades are caught by the test suite rather than silently passing against a stale stub.

**Applies to:** All phases with middleware, request handlers, or framework-object-dependent contracts.

## Lesson: RTL success does not prove localization success

**Mistake:** Locale resolution and RTL direction worked, while production components continued rendering hard-coded English strings. Switching to Persian changed `lang` and `dir` but left the visible page in English.

**Root cause:** Localization was validated at infrastructure/dictionary level (dictionaries exist, provider exists, hooks exist) instead of at the rendered route/component level (each screen actually renders translated text). RTL is a layout property; it is not proof that product copy was translated.

**Permanent rule:** For every localized user-facing route, tests must assert that changing locale changes visible production copy. `lang`, `dir`, dictionary keys, and locale state alone are insufficient evidence. A dictionary containing Persian strings does NOT prove the page consumes them. Render the production component under both locales and assert the Persian text appears and the English text disappears.

**Applies to:** All phases with UI localization.


## Lesson: Presentation locale is not OTP identity

**Mistake (Phase 13 design review):** There was a temptation to bind the OTP code, HMAC, or TTL to the resolved locale — e.g. "Persian OTPs use Persian digits" or "the locale is part of the HMAC input." This would have made changing language invalidate a valid OTP, breaking the security contract.

**Root cause:** Locale is a PRESENTATION concern (how the email is rendered). OTP identity is a SECURITY concern (what code was generated, how it's hashed, when it expires). Conflating them couples rendering to cryptographic identity.

**Permanent rule:** Locale is presentation context only. The OTP code, HMAC, TTL, attempt limit, and single-use semantics are NOT affected by locale. Changing language must not invalidate a valid OTP. The OTP code is always ASCII digits (`0-9`) — never Persian numerals — so it can be typed on any keyboard. The locale is passed to the RENDERER, not to the GENERATOR or VERIFIER. The renderer wraps the code in `<span dir="ltr">` so it displays correctly inside RTL Persian text, but the code itself is unchanged.

**Applies to:** All phases with locale-sensitive rendering of security-critical content (OTP, magic links, recovery codes).

## Lesson: Business purpose must be explicit

**Mistake (Phase 13 design):** The existing OTP system used a DB-level `OtpPurpose = "signup" | "login" | "reset"` that was also used as the email rendering key. This conflated the DB enum (which controls lockout/rate-limit scoping) with the email copy semantics (which controls the message wording). Sign-up and sign-in emails must have DIFFERENT copy even though both are "authentication" — the user needs to distinguish them by reading the email.

**Root cause:** There was no explicit mapping between the DB purpose and the email purpose. A single enum was used for both concerns.

**Permanent rule:** Business flow owns purpose. The caller explicitly passes the semantic purpose (e.g. `"sign_up"`, `"sign_in"`, `"password_reset"`). Never infer purpose from URL pathname, email text, whether a User exists, referrer, or button label. The DB-level purpose (`"signup" | "login" | "reset"`) is mapped to the email-level purpose (`"sign_up" | "sign_in" | "password_reset"`) at a SINGLE point (`purposeToEmailPurpose()`). This mapping is the only place the two enums are coupled. Resends preserve purpose — a signup resend is still `"sign_up"`, not generic copy.

**Applies to:** All phases with purpose-sensitive email/notification rendering.

## Lesson: Out-of-band messages reuse canonical locale resolution

**Mistake (Phase 13 design review):** There was a temptation to implement OTP-specific locale detection — reading the Geo header or Accept-Language directly in the OTP send path — because the existing `resolveUserLocale(userId)` only read the stored preference and couldn't handle signup (no User row yet).

**Root cause:** The stored-preference-only helper was insufficient for signup flows. But reimplementing Geo/Accept-Language/cookie detection in the OTP path would have duplicated the canonical resolution logic and diverged from the web-UI locale behavior.

**Permanent rule:** Out-of-band messages (OTP emails, notification emails, webhook-triggered flows) reuse the canonical locale resolver. Phase 12 established `resolveRequestUserLocale({ request, userId? })` as the canonical request-aware helper — it handles both authenticated (loads `preferredLocale`) and signup/no-User-row (cookie/Geo/Accept-Language) cases. Phase 13 OTP sends call this helper; they do NOT reimplement Geo parsing, Accept-Language parsing, or cookie parsing. The only OTP-specific concern is the email rendering — the locale resolution is shared infrastructure.

**Applies to:** All phases with out-of-band locale-sensitive rendering.


## Lesson: Empty test bodies are not coverage

**Mistake (Phase 13 audit):** The OTP localization test suite had 8 DB-gated tests whose bodies contained only comments like `// This test is implemented in the DB-gated section below.` These tests passed because they did nothing — `it("...", async () => {})` is a no-op that vitest reports as passing. The report claimed "8 DB-gated production-path tests" as coverage, but they were placeholders.

**Root cause:** The test file was structured with `describe.skipIf(!RUN)` blocks containing `it()` calls with empty bodies, intended as a scaffold to be filled in later. The scaffolding was committed without implementation, and the test count included them.

**Permanent rule:** A named test with no assertions or production execution is not evidence. Integration tests must execute the claimed production path and fail when the behavior breaks. Use `expect.hasAssertions()` at the top of each test so an accidentally empty test cannot pass silently. Never count placeholder/no-op tests as coverage — every test counted must contain real assertions that would fail if the production behavior changed.

**Applies to:** All phases with integration test suites.

## Lesson: Localization must not bypass customization pipelines

**Mistake (Phase 13 audit):** The initial Phase 13 implementation added locale support by branching: `if (opts.locale) { renderOtpEmail(...) } else { renderEmailForPurpose(...) }`. This meant that when locale was provided (which Phase 13 required), the entire existing BrandKit + EmailTheme pipeline was bypassed. Localized OTP emails silently lost branding and theme functionality — a Persian OTP for a PRO user with a BrandKit appName would revert to "Nixify" instead of the branded name.

**Root cause:** The localized renderer was implemented as a SEPARATE path rather than as an INPUT to the existing pipeline. The existing `renderEmailForPurpose()` resolved BrandKit appName, looked up active EmailThemes, and rendered using the theme or fell back to the default. The Phase 13 code bypassed all of that.

**Permanent rule:** Adding locale-sensitive rendering must preserve branding, theme, ownership, and provider behavior already enforced by the canonical rendering pipeline. The locale is an INPUT to the pipeline, not a branch that skips it. The pipeline ordering: resolve locale → resolve effective appName (BrandKit) → resolve active EmailTheme → if custom theme exists, render using that theme (user content is NOT auto-translated) → if no custom theme, render localized system fallback copy using the locale + purpose + effectiveAppName. Do NOT maintain two mutually exclusive renderer paths.

**Applies to:** All phases with locale-sensitive rendering of content that already has a customization/theming pipeline.

## Lesson: Owner locale is not recipient locale

**Mistake (Phase 13 audit):** The v1 `/api/v1/otp/send` route resolved locale using `resolveRequestUserLocale({ request: req, userId: ctx.apiKey.userId })`. But `ctx.apiKey.userId` is the Nixify tenant/API-key OWNER — not the OTP recipient (who is identified by the `email` field). Using the tenant owner's UI `preferredLocale` as the recipient OTP locale would cause ALL of a customer's OTP recipients to receive mail in the account owner's UI language.

**Root cause:** The v1 API is a server-to-server API where the API key authenticates the tenant owner, and the `email` field is the recipient. There is no HTTP request from the recipient — the recipient is not visiting a page. The locale resolution helper was designed for first-party web auth where the request IS the user's own authentication flow. Applying it to the v1 API conflated the tenant owner with the recipient.

**Permanent rule:** In tenant messaging APIs, the tenant/API-key owner's UI preference must NOT silently become the recipient's message language. For v1 server-to-server OTP APIs, use English (`"en"`) unless/until an explicit recipient-locale API contract exists. First-party web auth flows (where the HTTP request IS the user's own authentication) continue using `resolveRequestUserLocale()`. Document this contract explicitly — v1 send and v1 resend must be symmetric.

**Applies to:** All phases with tenant-to-recipient messaging where the tenant owner and the message recipient are different entities.


## Lesson: Fallback must not hide a selected-renderer failure

**Mistake (Phase 13 audit):** The OTP email rendering pipeline wrapped both theme LOOKUP and theme RENDERING in the same broad `try { ... } catch { }` block. When a theme was successfully selected but its rendering failed (bad JSON config, renderer throw), the catch silently fell through to the localized system fallback — sending a completely different email than the one the user configured. This contradicted the claimed contract "rendering failure → zero provider calls" and created a dangerous correctness problem: a broken custom theme would silently send a system email instead of failing.

**Root cause:** The broad catch treated "no customization available" (lookup failure — a legitimate fallback condition) and "selected customization failed to render" (a correctness failure) as the same condition. These are fundamentally different: the former is an expected absence; the latter is a broken configuration that should surface as an error, not silently substitute different content.

**Permanent rule:** Fallback is allowed when an optional resource is ABSENT or UNAVAILABLE according to contract (e.g. DB query fails, no theme found). Once a specific renderer/theme/config has been SELECTED, rendering failure is a correctness failure and must NOT silently substitute different user-visible content unless that fallback is explicitly part of the product contract. The error must propagate — the caller (issueOtp) must reject, and the transport must NEVER be called. Separate the lookup (best-effort, may fall through) from the rendering (no silent catch, failure propagates). Do not wrap both in the same catch block.

**Applies to:** Email themes, templates, localization, branding, rendering pipelines — any system with an optional custom renderer that has a system fallback.


## Lesson: Pricing is not an independent source of truth (Phase 14)

**Mistake (Phase 14 audit):** The pricing UI (`src/lib/pricingData.ts`) had drifted from the entitlement config (`src/lib/entitlements/config.ts`). The pricing card said "1 email template" for Free; the entitlement config said `FREE EMAIL_TEMPLATES = 2`. The pricing card said "1,000,000 OTP emails" for the top tier; the entitlement config said `MAX OTP_EMAILS = Infinity`. The pricing card used a tier name ("Enterprise") that did not match any `Plan` enum value (`FREE | PRO | MAX`). The pricing card advertised "Dedicated IP", "Custom DKIM/SPF/DMARC", "SLA 99.99% uptime", "Dedicated support engineer" — none of which were implemented. Each was a marketing claim that the code could not back up.

**Root cause:** The pricing UI was treated as an independent source of truth. It hard-coded plan names, prices, and quota numbers instead of deriving them from the canonical entitlement config. There was no single catalog — the pricing page, the entitlement engine, and the marketing copy each maintained their own list. When the entitlement config changed, the pricing page did not. When the pricing page was written, it invented values that the entitlement config never authorized.

**Permanent rule:** There is ONE source of truth for plan limits: `src/lib/entitlements/config.ts` (`FEATURE_LIMITS`). There is ONE source of truth for commercial metadata (price, display name, CTA): `src/lib/billing/plan-catalog.ts` (`PLAN_CATALOG`). The pricing UI DERIVES from both — it never hard-codes a quota number, a price, or a plan name. The catalog calls `getFeatureQuota()` to read limits from the config, so changing a limit in the config automatically updates the pricing card. A drift-guard test (`src/lib/billing/billing.test.ts`) asserts that the catalog prices, entitlement values, and pricing card strings all match the spec — if any of them drifts, the test fails. Marketing claims (Dedicated IP, SLA, Custom DKIM) that the code cannot back up must be removed, not left as aspirational copy.

**Applies to:** All phases that render plan/feature/pricing information to users.


## Lesson: A plan name is not a billing identity (Phase 14)

**Mistake (Phase 14 design):** The pricing UI used the display name "Enterprise" for the top tier, while the backend `Plan` enum was `FREE | PRO | MAX`. There was no "ENTERPRISE" value in the enum — the UI had invented a name that did not correspond to any database column value, any entitlement config key, or any API contract. A user reading "Enterprise" on the pricing page and then seeing "MAX" in their dashboard settings would not know they were the same plan.

**Root cause:** The display name was chosen by the marketing/pricing layer without consulting the backend enum. The `Plan` type in `src/lib/entitlements/config.ts` is the canonical identifier — `getUserPlan()` returns one of `"FREE" | "PRO" | "MAX"`, the `User.plan` column accepts only those three values, and the entitlement engine keys its config by those three values. "Enterprise" existed nowhere except the pricing card.

**Permanent rule:** The canonical plan identifier is the `Plan` enum (`"FREE" | "PRO" | "MAX"`) in `src/lib/entitlements/config.ts`, aliased as `PlanKey` in `src/lib/billing/plan-catalog.ts`. The catalog maps each `PlanKey` to a `displayName` ("Free", "Pro", "Max"). The display name is presentation metadata — it does not define a new plan. If a different display name is desired (e.g. "Enterprise" instead of "Max"), the change must start in the catalog, and the catalog's `PlanKey` must still be one of the three enum values. Never invent a display name that has no backing `PlanKey`.

**Applies to:** All phases with plan-gated features, pricing UI, or plan display.


## Lesson: Marketing claims must not outrun implementation (Phase 14)

**Mistake (Phase 14 audit):** The pricing page advertised features that did not exist in the codebase: "Dedicated IP + SMTP relay" (no dedicated-IP infrastructure), "Custom DKIM/SPF/DMARC" (no per-customer DNS management), "SLA 99.99% uptime" (no SLA contract or uptime monitoring), "Dedicated support engineer" (no such staffing). The FAQ mentioned "Stripe" (no Stripe integration), "proration" (no billing system), "NET-30 invoices" (no invoicing), "30-day money-back guarantee" (no refund policy), "one-click cancellation" (no cancellation flow). Each of these was a claim the product could not honor.

**Root cause:** The pricing page was written as marketing copy first, with implementation as a future concern. When the implementation did not catch up, the claims remained on the page — presenting fictional capabilities as real product features. A user who signed up for "Enterprise" expecting a Dedicated IP would have no recourse; a user who read "money-back guarantee" and requested a refund would hit a wall.

**Permanent rule:** Every feature/benefit claim on a pricing page must correspond to implemented code that a user can verify. "Sandbox mode" is acceptable because `src/lib/dx/sandbox.ts` exists. "Full branding + Brand Kit" is acceptable because the BrandKit model and route exist. "Dedicated IP" is not acceptable unless a dedicated-IP allocation system exists. When in doubt, omit the claim — do not leave aspirational copy on a production pricing page. The FAQ must not mention payment providers, proration, invoicing, refunds, or cancellation flows unless those systems are integrated. A simple "Contact support to change your plan" is honest; "Cancel with one click" when no cancellation flow exists is not.

**Applies to:** All phases with user-facing marketing, pricing, or feature-claim copy.


## Lesson: Client input never grants entitlement (Phase 14)

**Mistake (Phase 14 audit):** The plan-mutation-security audit found that while all `db.user.update` routes used Zod schemas that implicitly strip unknown keys (so a `plan` field in the request body would not reach the update), there was no test proving this. A future developer could have changed a schema to `z.object({ locale, plan: z.string().optional() })` or used `z.object({ ... }).passthrough()` and silently allowed clients to upgrade their own plan. The security boundary existed by convention, not by enforced contract.

**Root cause:** The route handlers used Zod's default behavior (strip unknown keys) without an explicit test that proved a malicious `plan` field in the body could not modify the `User.plan` column. The schema was the only thing preventing privilege escalation, and the schema was not covered by a regression test.

**Permanent rule:** Any route that mutates a `User` row MUST be covered by a test that sends a malicious `plan` field in the body and asserts the `User.plan` column is unchanged after the request. The test must use a real DB row (not a mock) because the security guarantee is "the column did not change" — that requires a DB read before and after. The test must be DB-gated (skipped without `TEST_DATABASE_URL`) and run in CI via the dedicated `test:billing` script. Schemas that implicitly strip unknown keys are safe today, but the test makes the contract visible and prevents a future schema change from silently opening a privilege-escalation hole. The Zod schema is the first line of defense; the `db.user.update` `data` object (which only sets whitelisted fields) is the second; the test is the third.


## Lesson: Configured entitlement is not enforced entitlement

**Mistake (Phase 14 audit):** The entitlement config contained features marked as "CONFIGURED-ONLY" (limits defined but no route checks them), while the Phase 14 report claimed they were production-enforced. Configuration values in a feature-limit map do not prove runtime enforcement. A commercial limit is "enforced" only when the real production mutation/send boundary applies it AND a regression test proves that behavior.

**Root cause:** The STATUS comments in the config were not kept in sync with actual production code. Features were implemented (routes added, checks added) but the config comment still said "CONFIGURED-ONLY". The report then trusted the stale comment.

**Permanent rule:** Every feature must be accurately classified as one of: ACTIVE_ENFORCED (has a real production enforcement point + deterministic regression test), CONFIGURED_ONLY (exists in the catalog but not enforced at runtime — must NOT be claimed as enforced), or FUTURE (not marketed as available). The classification must be verified by auditing the actual production code, not by trusting config comments. When a feature's enforcement status changes, update the config comment immediately.

**Applies to:** All phases with entitlement/plan-gated features.

## Lesson: Usage-bucket copy must match accounting identity

**Mistake (Phase 14 audit):** The pricing comparison tooltip for MESSAGING_EMAILS said "Transactional + broadcast email sends" — implying that broadcast emails consume the MESSAGING_EMAILS quota. But the product has independent accounting buckets: MESSAGING_EMAILS (transactional/lifecycle), BROADCAST_EMAILS (campaign), OTP_EMAILS (verification), API_MESSAGES (v1 API requests). Describing one quota as consuming another quota's operations is a commercial contract violation.

**Root cause:** The pricing copy was written by summarizing features loosely rather than mapping each comparison row to the exact entitlement feature key it represents. "Transactional + broadcast" was an informal grouping that didn't match the actual accounting boundaries.

**Permanent rule:** Independent accounting buckets must remain semantically independent in pricing, docs, dashboards, and tests. Never describe one quota as consuming another quota's operations. Each pricing comparison row must map to exactly one FEATURE_KEY, and the tooltip must describe that feature key's accounting identity — not an informal grouping. Add deterministic semantic regression tests that assert bucket descriptions don't cross-reference each other in misleading ways.

**Applies to:** All phases with multiple independent usage counters.


## Lesson: Resource cardinality and consumable usage are different entitlement dimensions

**Mistake (Phase 14 audit v3):** Tests claimed to prove "API key creation is quota-enforced" by calling `canAccess(userId, FEATURE_KEYS.API_KEYS)` and comparing `db.apiKey.count()` against the configured quota. These are synthetic checks — they prove the entitlement engine returns the right boolean and the DB count matches expectation, but they do NOT prove the production route handler rejects a 13th POST when 12 keys already exist. The contract is "the route returns 4xx and no new row is created", not "the engine agrees the quota is exceeded".

**Root cause:** "How many X can a user have at once" (resource cardinality — bounded by a count of existing rows) and "how many X has the user consumed this billing period" (consumable usage — bounded by an atomic counter that increments on each operation) are different dimensions. The Phase 14 entitlement config collapses them into a single `quota` field per feature key, but the *enforcement* shape differs:

- **Resource cardinality (API_KEYS, WEBHOOK_ENDPOINTS, EMAIL_TEMPLATES):** The boundary check is `COUNT(rows) < quota`. The production route calls `checkUsage()` which atomically increments a `UsageTracking` counter and rejects when `count >= quota`. Deleting a resource does NOT refund the counter — the cardinality boundary is enforced through the counter, not through `COUNT(rows)`. So the test must pre-populate BOTH a `UsageTracking` row at quota AND the actual resource rows (to mirror real state), then call the REAL route, then assert both the response status AND the actual row count is unchanged.
- **Consumable usage (API_MESSAGES, OTP_EMAILS, MESSAGING_EMAILS, BROADCAST_EMAILS):** The boundary check is `UsageTracking.count < quota` consumed via atomic increment. There is no resource row to count — the counter IS the source of truth. The test asserts the route returns 4xx and the counter did not increment past quota.

A test that only checks `canAccess()` or `count() < quota` does NOT prove the production mutation boundary blocks creation. It proves the engine agrees with itself.

**Permanent rule:** When the contract is "the production mutation route blocks/allows resource creation", the test MUST execute the real route handler with a real `Request`/`NextRequest` and assert BOTH the response status AND the DB row count delta. Mock only auth (so the route sees the test user); let everything else — Zod schema, entitlement engine, rate limiter, `UsageTracking` consume, the DB write — run through real production code. For "at limit" tests, pre-populate the `UsageTracking` counter to the quota value so `checkUsage()` returns `allowed=false` on the next call. The test is the regression guard that proves the route's gate is wired; a `canAccess()`-only test proves nothing about the route.

Resource cardinality and consumable usage also diverge in their refund semantics: deleting an API key does NOT give the user back a quota slot (the counter persists), while a `checkUsage()` call that fails DOES NOT consume a slot (the CAS precondition fails before increment). Tests that simulate "at limit" must mirror this: pre-populate `UsageTracking` to exactly `quota` — never `quota - 1` (the route would still allow one more creation before hitting the limit).

**Applies to:** All phases with plan-gated resource creation (API keys, webhook endpoints, email themes, brand kits, future resource types).
