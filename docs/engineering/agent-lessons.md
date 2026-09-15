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

**Permanent rule:** Idempotency requires concurrency serialization BEFORE the protected state transition, not just a pre-check plus unique insert. Use `pg_advisory_xact_lock` inside the transaction, then re-check for the idempotency record INSIDE the transaction after acquiring the lock. The first caller proceeds; the second caller sees the first caller's committed record and replays.

**Applies to:** All phases with concurrent idempotent mutations.

## Lesson: Regression tests must execute the claimed production path

**Mistake (Phase 10 audit):** The transactional-Send regression test caught a `template_not_found` error and called that proof of successful sending. The dispatch-race test manually recreated the CAS instead of exercising the real `processRecipient()` path.

**Root cause:** Tests were written to be easy to pass, not to prove the claimed behavior. A caught failure is not proof of success.

**Permanent rule:** If the claim is "production path performs X", the regression must call that production path and observe X directly. Do not substitute a mock/simplified path for the real one. Do not catch expected failures and call that proof. The test must exercise the actual function/route that production uses.

**Applies to:** All phases with regression tests.
