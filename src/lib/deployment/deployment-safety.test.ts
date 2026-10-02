/**
 * Production deployment safety — regression tests.
 *
 * These tests inspect the REAL scripts, docs, workflows, and package.json in
 * the repository (via readFileSync) — NOT mock fixtures. They encode the
 * production-deployment contract from docs/engineering/reliability-protocol.md
 * §6 and DEPLOY.md:
 *
 *   - production schema evolution uses `prisma migrate deploy` ONLY;
 *   - `prisma db push` / `migrate reset` / `migrate dev` are forbidden as
 *     production commands (guarded + not in the CD/deploy path);
 *   - production deploy never auto-seeds;
 *   - the CD migration command is `prisma migrate deploy`;
 *   - DEPLOY.md does not instruct production `db push` or claim nonexistent
 *     cron jobs;
 *   - canonical production examples use `https://nixify.ir`.
 *
 * Pure tests (no DB, no network) — they read source files only.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

describe("production deployment safety", () => {
  // ─── db-safety-guard.sh ──────────────────────────────────────────────────

  describe("db-safety-guard.sh", () => {
    const guard = read("scripts/db-safety-guard.sh");

    it("exists and is the production safety guard", () => {
      expect(existsSync(resolve(ROOT, "scripts/db-safety-guard.sh"))).toBe(true);
      expect(guard).toContain("db-safety-guard");
    });

    it("refuses when NODE_ENV=production", () => {
      expect(guard).toMatch(/NODE_ENV.*production/);
    });

    it("refuses when VERCEL_ENV=production", () => {
      expect(guard).toMatch(/VERCEL_ENV.*production/);
    });

    it("does NOT infer production from the DATABASE_URL hostname (Neon dev caveat)", () => {
      // The guard must not treat a Neon hostname as proof of production.
      expect(guard).toMatch(/does NOT infer production from the DATABASE_URL hostname/i);
      expect(guard).toMatch(/Neon/i);
    });

    it("lists the forbidden commands explicitly", () => {
      expect(guard).toContain("prisma db push");
      expect(guard).toContain("prisma migrate reset");
      expect(guard).toContain("prisma migrate dev");
      expect(guard).toContain("prisma db seed");
    });

    it("fails closed (exit 1) when production is detected", () => {
      expect(guard).toMatch(/exit 1/);
    });
  });

  // ─── package.json db:* scripts are guarded ───────────────────────────────

  describe("package.json db scripts", () => {
    const pkg = JSON.parse(read("package.json")) as Record<string, unknown>;
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;

    const GUARDED = ["db:push", "db:reset", "db:migrate", "db:seed", "seed"];

    it.each(GUARDED)("%s sources the db-safety-guard", (name) => {
      expect(scripts[name], `script ${name} must exist`).toBeTruthy();
      expect(scripts[name]).toContain("db-safety-guard.sh");
    });

    it("db:deploy is plain `prisma migrate deploy` (the production path, unguarded)", () => {
      expect(scripts["db:deploy"]).toBe("prisma migrate deploy");
    });

    it("db:generate is plain `prisma generate` (safe, no DB contact)", () => {
      expect(scripts["db:generate"]).toBe("prisma generate");
    });
  });

  // ─── prepare-vercel.sh is non-destructive ────────────────────────────────

  describe("prepare-vercel.sh", () => {
    const script = read("scripts/prepare-vercel.sh");

    /** Only non-comment, executed command lines. */
    const execLines = script
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .filter((l) => l.trim().length > 0 && !l.trim().startsWith("echo"));

    it("does NOT run prisma db push", () => {
      const hits = execLines.filter((l) => /\b(bunx |bun run )?prisma db push\b/.test(l) || /\bbun run db:push\b/.test(l));
      expect(hits, `prepare-vercel.sh must not execute db push — found: ${JSON.stringify(hits)}`).toEqual([]);
    });

    it("does NOT run prisma migrate reset", () => {
      const hits = execLines.filter((l) => /\b(bunx |bun run )?prisma migrate reset\b/.test(l) || /\bbun run db:reset\b/.test(l));
      expect(hits, `prepare-vercel.sh must not execute migrate reset — found: ${JSON.stringify(hits)}`).toEqual([]);
    });

    it("does NOT automatically seed", () => {
      const hits = execLines.filter((l) => /\bbun run (db:)?seed\b/.test(l) || /\bbunx tsx prisma\/seed\b/.test(l) || /\bprisma db seed\b/.test(l));
      expect(hits, `prepare-vercel.sh must not auto-seed — found: ${JSON.stringify(hits)}`).toEqual([]);
    });

    it("does NOT modify production schema outside committed migrations", () => {
      const hits = execLines.filter((l) => /\b(bunx |bun run )?prisma db push\b/.test(l));
      expect(hits, `prepare-vercel.sh must not push schema — found: ${JSON.stringify(hits)}`).toEqual([]);
    });

    it("runs prisma generate (safe — no DB contact)", () => {
      expect(script).toMatch(/prisma generate/);
    });

    it("documents the migration-deploy procedure", () => {
      expect(script).toMatch(/prisma migrate deploy/);
    });
  });

  // ─── cd.yml — migration command + no auto-seed ──────────────────────────

  describe("cd.yml (CD workflow)", () => {
    const cd = read(".github/workflows/cd.yml");
    /** Non-comment `run:` step command lines (the first line of each run block). */
    const runSteps = cd
      .split(/^\s*run:\s*/m)
      .slice(1)
      .map((b) => b.split("\n")[0]);

    it("uses prisma migrate deploy (never db push) for production migrations", () => {
      expect(cd).toContain("prisma migrate deploy");
      // No run step may execute prisma db push.
      const hits = runSteps.filter((l) => /^\s*(bunx |bun run )?prisma db push\b/.test(l) || /^\s*bun run db:push\b/.test(l));
      expect(hits, `cd.yml must not run prisma db push — found: ${JSON.stringify(hits)}`).toEqual([]);
    });

    it("triggers only on push to main (not on PR/preview)", () => {
      expect(cd).toMatch(/on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]/);
      expect(cd).not.toMatch(/\bpull_request:/);
    });

    it("does NOT auto-seed production", () => {
      const hits = runSteps.filter((l) => /^\s*bun run (db:)?seed\b/.test(l) || /^\s*prisma db seed\b/.test(l) || /^\s*bunx tsx prisma\/seed\b/.test(l));
      expect(hits, `cd.yml must not auto-seed — found: ${JSON.stringify(hits)}`).toEqual([]);
    });

    it("does NOT run prisma migrate reset", () => {
      const hits = runSteps.filter((l) => /^\s*(bunx |bun run )?prisma migrate reset\b/.test(l) || /^\s*bun run db:reset\b/.test(l));
      expect(hits, `cd.yml must not run migrate reset — found: ${JSON.stringify(hits)}`).toEqual([]);
    });

    it("migrate job runs before deploy (needs: migrate)", () => {
      expect(cd).toMatch(/needs:\s*\[migrate\]/);
    });

    it("FAILS CLOSED when PRODUCTION_DATABASE_URL is absent (exit 1, not skip+continue)", () => {
      // The old behavior (skip + ::warning:: + migrate job succeeds + deploy
      // proceeds) was a production-safety blocker. The new behavior must FAIL
      // the migrate job so the deploy job cannot run.
      expect(cd, "must reference PRODUCTION_DATABASE_URL").toMatch(/PRODUCTION_DATABASE_URL/);
      // The fail-closed check must exit non-zero when the secret is absent.
      const checkBlock = cd.split("Fail closed if PRODUCTION_DATABASE_URL is absent")[1] ?? "";
      expect(checkBlock, "must inspect the env var, not the GitHub expression").toMatch(/\$\{PRODUCTION_DATABASE_URL:-\}/);
      expect(checkBlock, "must exit 1 on absent secret").toMatch(/exit 1/);
      expect(checkBlock, "must emit a ::error:: (not a ::warning::)").toMatch(/::error::/);
      // The old skip+warning behavior must NOT remain.
      expect(cd, "must NOT keep the old skip+warning fallback").not.toMatch(/::warning::PRODUCTION_DATABASE_URL secret is not set — skipping/);
      // The guarded `if: steps.has_db_secret.outputs.has_secret == 'true'`
      // conditionals that allowed fall-through must be gone.
      expect(cd, "must NOT gate migration steps on a has_secret output (that allowed fall-through)").not.toMatch(/if:\s*steps\.has_db_secret/);
    });

    it("deploy job cannot proceed after missing migration credentials (needs: migrate)", () => {
      // The deploy job depends on `migrate`. If the migrate job fails (e.g.
      // missing secret → exit 1), the deploy job is blocked.
      const deployBlock = cd.split("name: Deploy to Vercel")[1] ?? "";
      expect(deployBlock, "deploy job must need: [migrate]").toMatch(/needs:\s*\[migrate\]/);
    });

    it("migration failure blocks deploy (no `if: always()` on deploy, no `if: success()` fallback)", () => {
      // The deploy job must run only when migrate succeeded. GitHub Actions
      // default is `if: success()` (skips if a needed job failed), but we assert
      // the deploy job does NOT override that with `if: always()`.
      const deployBlock = cd.split("name: Deploy to Vercel")[1] ?? "";
      expect(deployBlock, "deploy must NOT use if: always()").not.toMatch(/if:\s*always\(\)/);
    });

    it("DB secret is passed through `env:`, NOT interpolated into shell source", () => {
      // The production DB secret must NEVER appear inside a `run:` block's shell
      // command text via ${{ secrets.PRODUCTION_DATABASE_URL }}. It must be
      // passed through the step `env:` map and inspected as an environment
      // variable.
      //
      // Walk the YAML line by line, tracking context:
      //   - inside an `env:` block (indented under `env:`) → ${{ secrets.* }} is ALLOWED
      //   - inside a `run:` block scalar (shell command) → ${{ secrets.* }} is FORBIDDEN
      const lines = cd.split("\n");
      let inEnv = false;
      let inRun = false;
      let envIndent = -1;
      let runIndent = -1;
      const violations: string[] = [];
      for (const line of lines) {
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;
        // Exiting a block when indentation decreases below its start.
        if (inEnv && indent <= envIndent && trimmed.length > 0 && !trimmed.startsWith("#")) inEnv = false;
        if (inRun && indent < runIndent && trimmed.length > 0) inRun = false;
        if (/^env:\s*$/.test(trimmed)) {
          inEnv = true;
          envIndent = indent;
          continue;
        }
        if (/^run:\s*\|?\s*$/.test(trimmed)) {
          inRun = true;
          // The run block's command lines are indented one level beyond `run:`.
          runIndent = indent + 2;
          continue;
        }
        if (inRun && /\$\{\{\s*secrets\.PRODUCTION_DATABASE_URL\s*\}\}/.test(line)) {
          violations.push(line);
        }
      }
      expect(violations, `run shell commands must not interpolate the production DB secret expression (it must be passed via env:) — found: ${JSON.stringify(violations)}`).toEqual([]);
      // The secret MUST be passed via env:.
      expect(cd, "must pass PRODUCTION_DATABASE_URL via env:").toMatch(/env:\s*\n\s*PRODUCTION_DATABASE_URL:\s*\$\{\{\s*secrets\.PRODUCTION_DATABASE_URL\s*\}\}/);
      // And inspected as an environment variable, not a GitHub expression.
      expect(cd, "must inspect ${PRODUCTION_DATABASE_URL:-} in shell").toMatch(/\$\{PRODUCTION_DATABASE_URL:-\}/);
    });

    it("no run step prints the DB secret value", () => {
      // No run step may echo the DATABASE_URL/PRODUCTION_DATABASE_URL
      // variable's expansion (which would print the secret value).
      for (const step of runSteps) {
        expect(step, `run step must not echo \$DATABASE_URL: ${step}`).not.toMatch(/echo.*\$DATABASE_URL/);
        expect(step, `run step must not echo \$PRODUCTION_DATABASE_URL: ${step}`).not.toMatch(/echo.*\$PRODUCTION_DATABASE_URL/);
        expect(step, `run step must not echo \${{ ... DATABASE_URL }}: ${step}`).not.toMatch(/echo.*\$\{\{.*DATABASE_URL.*\}\}/);
      }
    });
  });

  // ─── DEPLOY.md truth ─────────────────────────────────────────────────────

  describe("DEPLOY.md", () => {
    const deploy = read("DEPLOY.md");

    /**
     * Prose lines only — strips fenced code blocks. An "instruction" is prose
     * telling the operator to run a command, NOT a line inside a ```text or
     * ```bash block that documents forbidden commands.
     */
    const proseLines = (() => {
      const lines = deploy.split("\n");
      const out: string[] = [];
      let inFence = false;
      for (const l of lines) {
        if (/^\s*```/.test(l)) {
          inFence = !inFence;
          continue;
        }
        if (!inFence) out.push(l);
      }
      return out;
    })();

    it("does NOT instruct switching SQLite to PostgreSQL (no SQLite path exists)", () => {
      expect(deploy).not.toMatch(/switch.*sqlite.*to.*postgresql/i);
      expect(deploy).not.toMatch(/flip.*sqlite.*postgresql/i);
      expect(deploy).not.toMatch(/from `sqlite` to `postgresql`/i);
    });

    it("does NOT instruct production `prisma db push`", () => {
      // db push may appear in fenced "forbidden" code blocks or in prose that
      // describes the guard (descriptive). A forbidden INSTRUCTION is a prose
      // line telling the operator to RUN db push against production — i.e. it
      // mentions db push AND a run/push imperative AND production, WITHOUT a
      // negation (never/must not/do not).
      const instrLines = proseLines
        .filter((l) => /db push|db:push/.test(l))
        .filter((l) => /run|push|execute/i.test(l))
        .filter((l) => /production|prod/i.test(l))
        .filter((l) => !/forbidden|never|must not|do not|not.*run|not.*push|refuse|guard|protected|sourced by|are guarded/i.test(l));
      expect(instrLines, `DEPLOY.md prose must not instruct 'db push' against production — found: ${JSON.stringify(instrLines)}`).toEqual([]);
    });

    it("does NOT claim Vercel Cron jobs exist (vercel.json is empty)", () => {
      expect(deploy).toMatch(/Vercel Cron is not used/i);
      // The doc may mention vercel.json + the fact that cron is NOT in it, but
      // must not claim vercel.json configures cron jobs.
      const cronClaimLines = deploy
        .split("\n")
        .filter((l) => /vercel\.json/i.test(l))
        .filter((l) => /cron/i.test(l))
        .filter((l) => !/not used|empty|not.*cron|no.*cron|intentionally empty|is \{\}/i.test(l));
      expect(cronClaimLines, `DEPLOY.md must not claim vercel.json has cron — found: ${JSON.stringify(cronClaimLines)}`).toEqual([]);
    });

    it("uses the canonical production origin https://nixify.ir in examples", () => {
      expect(deploy).toContain("https://nixify.ir");
    });

    it("does NOT use stale your-app.vercel.app examples", () => {
      expect(deploy).not.toMatch(/your-app\.vercel\.app/);
    });

    it("documents prisma migrate deploy as the production migration path", () => {
      expect(deploy).toContain("prisma migrate deploy");
    });

    it("documents that production deploy does NOT auto-seed", () => {
      expect(deploy).toMatch(/never.*seed|does not.*seed|no automatic production seeding/i);
    });

    it("documents the health endpoint semantics distinctly", () => {
      expect(deploy).toMatch(/healthz/);
      expect(deploy).toMatch(/readyz/);
      expect(deploy).toMatch(/\/api\/health/);
    });

    it("documents forward-fix rollback (no migrate reset as prose instruction)", () => {
      expect(deploy).toMatch(/forward-fix|forward-fixed/i);
      expect(deploy).toContain("prisma migrate reset");
      // migrate reset must appear only in fenced "forbidden" blocks / warnings,
      // never as a prose instruction telling the operator to run it.
      const instrResetLines = proseLines
        .filter((l) => /migrate reset/.test(l))
        .filter((l) => !/forbidden|never|do not|not.*normal|not.*as|not.*use|without|must not/i.test(l))
        .filter((l) => /run|execute|\$|bunx |prisma |bun run/i.test(l));
      expect(instrResetLines, `DEPLOY.md prose must not instruct migrate reset — found: ${JSON.stringify(instrResetLines)}`).toEqual([]);
    });
  });

  // ─── vercel.json is empty (no Vercel Cron) ───────────────────────────────

  describe("vercel.json", () => {
    it("is empty (no cron configuration — external cron is used instead)", () => {
      const vj = JSON.parse(read("vercel.json"));
      expect(vj).toEqual({});
    });
  });

  // ─── prisma schema is PostgreSQL ─────────────────────────────────────────

  describe("prisma/schema.prisma", () => {
    it("uses the PostgreSQL provider (no SQLite path)", () => {
      const schema = read("prisma/schema.prisma");
      expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
      expect(schema).not.toMatch(/provider\s*=\s*"sqlite"/);
    });
  });

  // ─── committed migrations exist ─────────────────────────────────────────

  describe("prisma/migrations", () => {
    it("has committed migrations (production schema evolution is migration-based)", () => {
      const migrationsDir = resolve(ROOT, "prisma/migrations");
      expect(existsSync(migrationsDir)).toBe(true);
      const lock = read("prisma/migrations/migration_lock.toml");
      expect(lock).toMatch(/postgresql/);
    });
  });

  // ─── forbidden production-pattern static audit ───────────────────────────
  // `prisma db push` / `prisma migrate reset` may exist ONLY in clearly
  // local/dev tooling with explicit production guards — never as production
  // instructions or production workflow commands.

  describe("forbidden production patterns (static audit)", () => {
    it("cd.yml contains no `prisma db push` or `prisma migrate reset` command", () => {
      const cd = read(".github/workflows/cd.yml");
      // These may appear in comments ("never use ...") but never as a `run:` command.
      const runBlocks = cd.split(/^\s*run:\s*/m).slice(1);
      for (const block of runBlocks) {
        const firstLine = block.split("\n")[0];
        expect(firstLine, `cd.yml run step must not be db push/reset: ${firstLine}`).not.toMatch(/^\s*(bunx )?prisma (db push|migrate reset|migrate dev)\b/);
        expect(firstLine, `cd.yml run step must not be bun run db:push/db:reset: ${firstLine}`).not.toMatch(/^\s*bun run (db:push|db:reset|db:seed|seed)\b/);
      }
    });

    it("prepare-vercel.sh contains no `prisma db push` or `prisma migrate reset` execution", () => {
      const script = read("scripts/prepare-vercel.sh");
      // Forbidden commands may appear in the "NEVER do" comment, but never as
      // an executed line (no leading bun/prisma invocation).
      const execLines = script
        .split("\n")
        .filter((l) => !l.trim().startsWith("#"))
        .filter((l) => /^\s*(bunx |bun run )?prisma (db push|migrate reset|migrate dev)\b/.test(l) || /^\s*bun run (db:push|db:reset|db:seed|seed)\b/.test(l));
      expect(execLines, `prepare-vercel.sh must not execute forbidden commands — found: ${JSON.stringify(execLines)}`).toEqual([]);
    });
  });
});
