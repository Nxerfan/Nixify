# Nixify Permanent Reliability Protocol

This document is a permanent repository-level engineering protocol.
It MUST be read and obeyed before every phase, fix, or commit.
It supplements `docs/engineering/agent-lessons.md` with mandatory operational rules.

---

## 1. Branch Safety

### 1.1 Pre-commit verification

Before ANY `git commit`:

```bash
git branch --show-current
```

Must return the expected feature branch. If it returns `main` or any other branch:

- STOP.
- `git checkout <correct-branch>`
- Re-stage files.
- Re-verify before committing.

### 1.2 Post-commit verification

After EVERY `git commit`:

```bash
git log --oneline -1
git branch --show-current
```

Both must show the correct branch. If the commit landed on the wrong branch:

- Do NOT push.
- Cherry-pick or reset to move the commit to the correct branch.
- Reset the wrong branch back to its remote state.

### 1.3 Background process awareness

This sandbox has background processes that periodically switch the checked-out branch to `main`.
This is not a bug in the code — it is an environmental constraint.

Mitigations:
- Perform checkout → edit → add → commit in rapid succession.
- Use `git checkout <branch> -- <file>` to restore working tree files atomically.
- After `git checkout <branch>`, immediately run `git checkout <branch> -- .` to restore all files.
- Verify branch identity before AND after every git operation.

---

## 2. Remote Verification Before Reporting

### 2.1 Never report local-only state

Before any final report or claim that a feature is implemented:

```bash
git fetch origin
git show origin/<branch>:<file>
```

Every claimed fix MUST be verified on the remote HEAD, not on local uncommitted files.

### 2.2 Audit from remote

After pushing, fetch the remote and re-read critical files:

```bash
git fetch origin
git show origin/<branch>:<critical-file>
```

Verify the fix is actually present in the committed remote code.

---

## 3. Test Integrity

### 3.1 Tests must encode the specification

Tests must assert the required behavior from the phase specification, not the current implementation.
If the implementation is wrong, the test must fail.
If the test passes with the wrong implementation, the test is wrong.

### 3.2 No assertion weakening for CI green

Never change:
```ts
expect(result).toBe(EXACT_VALUE)
```
to:
```ts
expect(result).toBeGreaterThanOrEqual(0)
```

merely because CI timing causes failures.

Instead:
- Make the test deterministic by controlling DB state.
- Use explicit setup: create rows, set their status, then call the function.
- Assert exact expected values based on controlled state.
- Use `beforeEach` cleanup that is aggressive and complete.

### 3.3 DB test isolation

Each DB integration test file MUST use a unique email prefix for its test users:

```
contacts-test-    (Contacts)
templates-test-   (Templates)
messaging-test-   (Messaging)
automation-test-  (Automation)
events-test-      (Events)
wh-test-          (Webhooks)
gi-test-          (Groups & Import — groups)
imp-test-         (Groups & Import — imports)
```

This prevents cross-file P2002 conflicts when multiple test files run in the same CI job against the same PostgreSQL database.

### 3.4 Deterministic concurrency tests

For concurrency tests (atomic claim, stale lock recovery, dual-worker):
- Set up explicit DB state: create rows with known status + lockedAt values.
- Call the function under test.
- Assert exact DB state after.
- Never rely on `Promise.all` timing.
- Never use `sleep` for correctness.

---

## 4. Code Correctness Rules

### 4.1 No silent failure swallowing

Never use:
```ts
.catch(() => {})
```

on:
- row state transitions
- import state transitions
- counter updates
- finalization
- lock release/recovery
- Group membership correctness
- ContactEvent correctness

Acceptable only for truly non-critical telemetry/logging.

### 4.2 Transactional consistency

When a function claims to be "transactional", it MUST use:
```ts
await db.$transaction(async (tx) => { ... })
```

wrapping ALL related side effects:
- create/update Contact
- create membership
- create ContactEvent
- update row/import terminal state

### 4.3 Compare-and-swap for all state transitions

All mutable state transitions MUST use conditional updates:

```ts
db.updateMany({
  where: { id, status: CURRENT_STATUS, [optional: lockedBy: workerId ] },
  data: { status: NEW_STATUS, ... },
})
```

Check `count === 1` before proceeding. If `count === 0`, another worker won — do nothing.

Applies to:
- Row claiming: `staged → processing`
- Row terminal: `processing → imported | existing | failed`
- Import claiming: `queued → processing`
- Import finalization: `processing → completed`
- Stale recovery: `processing → queued` (with `lockedAt < cutoff`)
- Row stale recovery: `processing → staged` (with `lockedAt < cutoff`)

### 4.4 No P2002 catch inside interactive transactions

PostgreSQL marks a transaction as failed after a constraint violation.
Catching P2002 and continuing inside `db.$transaction()` leaves the transaction in an invalid state.

Use instead:
```ts
db.createMany({ data: [...], skipDuplicates: true })
```

Then fetch the canonical record.

### 4.5 Safe error persistence

Never persist raw exception messages, stack traces, credentials, connection strings, or user data.

Use bounded safe classifications:
```
database_error | provider_error | quota_exhausted | rate_limited |
configuration_error | validation_error | template_not_found |
automation_incompatible | unknown_processing_error |
network_error | timeout | http_4xx | http_5xx |
ssrf_blocked | endpoint_missing | max_attempts_exceeded |
contact_not_found | processing_error | parse_failed |
unsupported_format | file_too_large | invalid_json | invalid_xlsx |
xlsx_resource_limit | too_many_rows | too_many_columns |
missing_email_header | formula_cell | cell_too_long |
unsupported_attribute_type | dangerous_key
```

---

## 5. Security Integration

### 5.1 Security helpers must be called from the real request path

If a security helper (SSRF validation, ZIP preflight, sanitization, etc.)
is implemented, verify the actual route handler calls it by reading
the committed route file:

```bash
git show origin/<branch>:<route-file>
```

### 5.2 Defense-in-depth

Security validation must occur at:
1. Create/update time (reject dangerous input early)
2. Execution time (re-validate before network delivery)

Never assume that create-time validation is sufficient.

---

## 6. Migration Safety

### 6.1 Single migration per phase

Each phase has exactly ONE additive migration. If schema changes are needed
after initial migration creation, modify the existing unmerged migration.

### 6.2 Additive only

Allowed:
```sql
CREATE TABLE
CREATE INDEX
CREATE UNIQUE INDEX
ADD COLUMN
ADD FOREIGN KEY
```

Never:
```sql
DROP TABLE
DROP COLUMN
TRUNCATE
DELETE
ALTER TABLE ... TYPE (destructive)
prisma migrate reset
prisma db push (against production)
```

### 6.3 No production application

Never apply migrations to production before PR merge.
Migrations are tested only against isolated PostgreSQL in CI.

---

## 7. Reporting

### 7.1 Final report must be from remote HEAD

Before reporting completion:

```bash
git fetch origin
git rev-parse origin/<branch>
```

Re-audit critical requirements from that exact commit.

### 7.2 Honest reporting

If a feature is not fully working:
- State it explicitly.
- Do not claim green CI when a job failed.
- Do not claim a feature is "implemented" when only the library exists but the route doesn't call it.

---

## 8. Phase Protocol

### 8.1 Read before every phase

Before starting ANY new phase or fix:

```bash
cat docs/engineering/reliability-protocol.md
cat docs/engineering/agent-lessons.md
```

### 8.2 Update before finalizing

Before finalizing every PR, update `agent-lessons.md` with any new reusable
failure pattern discovered during the phase.

### 8.3 Phase gate

```
ONE PHASE = ONE BRANCH = ONE PULL REQUEST
```

- Do NOT create multiple branches for one phase.
- Do NOT create multiple PRs for one phase.
- Do NOT merge the PR.
- Do NOT start the next phase until the current PR is merged and explicitly approved.
