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
