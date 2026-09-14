import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  createTemplate,
  listTemplates,
  getTemplate,
  getVersion,
  listVersions,
  updateTemplate,
  deleteTemplate,
  TemplateValidationError,
  TemplateNotFoundError,
} from "@/lib/transactional-templates";

/**
 * Transactional Templates — DB integration tests (Phase 3, sections 7, 19,
 * 22-24).
 *
 * This file is GATED — only runs when RUN_TEMPLATE_INTEGRATION=1 AND a
 * TEST_DATABASE_URL is supplied. The `bun run test:templates` script sets
 * both. Generic `bun run test` skips this file silently (no DB available).
 *
 * Pattern mirrors src/lib/contacts/contacts.test.ts exactly.
 *
 * Coverage:
 * - createTemplate — version 1, parent.currentVersion=1, variables stored.
 * - Tenant isolation — A's templates invisible to B.
 * - Slug uniqueness — same slug allowed for DIFFERENT users, denied for same.
 * - listTemplates — caller-scoped, search + pagination.
 * - Content edit creates version 2; version 1 row UNCHANGED (immutable).
 * - Metadata-only edit does NOT create a new version.
 * - Identical content (after trim) does NOT create a new version.
 * - Concurrency-safe version allocation: 5 concurrent content edits →
 *   currentVersion=6, 5 new distinct version rows (2..6), no gaps/dups.
 * - listVersions returns newest first; getVersion fetches historical version.
 * - deleteTemplate cascades — versions are gone.
 * - Cross-tenant getVersion returns null (no existence leakage).
 */

// Gate: skip silently when RUN_TEMPLATE_INTEGRATION is not set (generic runs).
const RUN = process.env.RUN_TEMPLATE_INTEGRATION === "1";

describe.skipIf(!RUN)("Transactional Templates Service", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;

  beforeAll(async () => {
    // Verify DB connectivity
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs. Order matters:
    // versions cascade-delete with the parent, but we delete them explicitly
    // first to be defensive against schema changes.
    await db.transactionalTemplateVersion.deleteMany({
      where: { template: { user: { email: { contains: "templates-test-" } } } },
    });
    await db.transactionalTemplate.deleteMany({
      where: { user: { email: { contains: "templates-test-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "templates-test-" } },
    });

    // Create two test users — plan PRO so canAccess(MESSAGING_EMAILS) passes
    // (the service layer doesn't check entitlements, but the routes do, and
    // we want this fixture to be reusable in route tests later if needed).
    const a = await db.user.create({
      data: {
        email: "templates-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "templates-test-b@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userB = b.id;
    setupComplete = true;
  });

  afterAll(async () => {
    // Only clean up if setup completed — avoids undefined IDs.
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    await db.transactionalTemplateVersion.deleteMany({
      where: { template: { userId: { in: [userA, userB] } } },
    });
    await db.transactionalTemplate.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ---- createTemplate ---------------------------------------------------

  it("createTemplate creates version 1, sets currentVersion=1, extracts+stores variables", async () => {
    const result = await createTemplate(userA, {
      name: "Welcome Email",
      slug: "welcome-v1",
      description: "Sent on signup",
      subject: "Welcome {{name}} — order #{{order_id}}",
      html: "<p>Hi {{name}}</p><p>Order: #{{order_id}}</p>",
      text: "Hi {{name}}, order #{{order_id}}",
    });

    // Parent row
    expect(result.template.id).toBeDefined();
    expect(result.template.userId).toBe(userA);
    expect(result.template.name).toBe("Welcome Email");
    expect(result.template.slug).toBe("welcome-v1");
    expect(result.template.description).toBe("Sent on signup");
    expect(result.template.currentVersion).toBe(1);
    expect(result.template.createdAt).toBeInstanceOf(Date);
    expect(result.template.updatedAt).toBeInstanceOf(Date);

    // Version 1 row
    expect(result.version.version).toBe(1);
    expect(result.version.templateId).toBe(result.template.id);
    expect(result.version.subject).toBe("Welcome {{name}} — order #{{order_id}}");
    expect(result.version.html).toContain("Hi {{name}}");
    expect(result.version.text).toBe("Hi {{name}}, order #{{order_id}}");

    // Variables: extracted + deduped + sorted.
    expect(result.version.variables).toEqual(["name", "order_id"]);
  });

  it("createTemplate stores null text when text is omitted", async () => {
    const result = await createTemplate(userA, {
      name: "No Text Template",
      slug: "no-text",
      subject: "Hi {{name}}",
      html: "<p>{{name}}</p>",
    });
    expect(result.version.text).toBeNull();
    expect(result.version.variables).toEqual(["name"]);
  });

  it("createTemplate sanitizes stored HTML (script stripped on write)", async () => {
    const result = await createTemplate(userA, {
      name: "Sanitized On Write",
      slug: "sanitized-on-write",
      subject: "Hi {{name}}",
      html: '<p>{{name}}</p><script>alert(1)</script>',
    });
    expect(result.version.html).not.toContain("<script");
    expect(result.version.html).toContain("<p>");
  });

  // ---- Tenant isolation -------------------------------------------------

  it("tenant isolation — getTemplate returns null for cross-tenant access", async () => {
    const created = await createTemplate(userA, {
      name: "Private to A",
      slug: "private-to-a",
      subject: "Subject",
      html: "<p>HTML</p>",
    });

    const fetched = await getTemplate(userB, created.template.id);
    expect(fetched).toBeNull();
  });

  it("tenant isolation — listTemplates excludes other users' templates", async () => {
    const created = await createTemplate(userA, {
      name: "A Only List",
      slug: "a-only-list",
      subject: "Subject",
      html: "<p>HTML</p>",
    });

    const list = await listTemplates(userB, { page: 1, pageSize: 100 });
    expect(list.templates.every((t) => t.userId === userB)).toBe(true);
    expect(list.templates.some((t) => t.id === created.template.id)).toBe(false);
  });

  it("tenant isolation — getVersion returns null for cross-tenant access", async () => {
    const created = await createTemplate(userA, {
      name: "Version Cross",
      slug: "version-cross",
      subject: "Subject",
      html: "<p>HTML</p>",
    });

    const v = await getVersion(userB, created.template.id, 1);
    expect(v).toBeNull();
  });

  it("tenant isolation — updateTemplate throws TemplateNotFoundError for cross-tenant", async () => {
    const created = await createTemplate(userA, {
      name: "Update Cross",
      slug: "update-cross",
      subject: "Subject",
      html: "<p>HTML</p>",
    });

    await expect(
      updateTemplate(userB, created.template.id, { name: "Hacked" }),
    ).rejects.toThrow(TemplateNotFoundError);
  });

  it("tenant isolation — deleteTemplate returns false for cross-tenant", async () => {
    const created = await createTemplate(userA, {
      name: "Delete Cross",
      slug: "delete-cross",
      subject: "Subject",
      html: "<p>HTML</p>",
    });

    const result = await deleteTemplate(userB, created.template.id);
    expect(result).toBe(false);

    // Verify the template still exists for A.
    const stillThere = await getTemplate(userA, created.template.id);
    expect(stillThere).not.toBeNull();
  });

  // ---- Slug uniqueness ---------------------------------------------------

  it("same slug allowed for DIFFERENT users", async () => {
    const r1 = await createTemplate(userA, {
      name: "Shared Slug A",
      slug: "shared-slug",
      subject: "A Subject",
      html: "<p>A</p>",
    });
    const r2 = await createTemplate(userB, {
      name: "Shared Slug B",
      slug: "shared-slug",
      subject: "B Subject",
      html: "<p>B</p>",
    });

    expect(r1.template.slug).toBe("shared-slug");
    expect(r2.template.slug).toBe("shared-slug");
    expect(r1.template.userId).toBe(userA);
    expect(r2.template.userId).toBe(userB);
    expect(r1.template.id).not.toBe(r2.template.id);
  });

  it("duplicate slug DENIED for the SAME user → TemplateValidationError", async () => {
    await createTemplate(userA, {
      name: "Dup Slug 1",
      slug: "dup-slug",
      subject: "Subject 1",
      html: "<p>1</p>",
    });

    await expect(
      createTemplate(userA, {
        name: "Dup Slug 2",
        slug: "dup-slug",
        subject: "Subject 2",
        html: "<p>2</p>",
        }),
    ).rejects.toThrow(TemplateValidationError);
  });

  // ---- listTemplates -----------------------------------------------------

  it("listTemplates returns only the caller's templates, respects search + pagination", async () => {
    // Create a distinct set per user so search/pagination behavior is unambiguous.
    await createTemplate(userA, {
      name: "Alpha One",
      slug: "list-alpha-one",
      subject: "Subject",
      html: "<p>HTML</p>",
    });
    await createTemplate(userA, {
      name: "Alpha Two",
      slug: "list-alpha-two",
      subject: "Subject",
      html: "<p>HTML</p>",
    });
    await createTemplate(userA, {
      name: "Beta One",
      slug: "list-beta-one",
      subject: "Subject",
      html: "<p>HTML</p>",
    });
    await createTemplate(userB, {
      name: "Beta Two",
      slug: "list-beta-two",
      subject: "Subject",
      html: "<p>HTML</p>",
    });

    // All userA templates — every row must belong to A.
    const r1 = await listTemplates(userA, { page: 1, pageSize: 100 });
    expect(r1.templates.every((t) => t.userId === userA)).toBe(true);
    expect(r1.templates.length).toBeGreaterThanOrEqual(3);

    // Search by name substring.
    const r2 = await listTemplates(userA, { search: "alpha" });
    expect(r2.templates.length).toBe(2);
    expect(r2.templates.every((t) => /alpha/i.test(t.name))).toBe(true);

    // Search must NOT leak userB's templates.
    const r3 = await listTemplates(userA, { search: "beta" });
    expect(r3.templates.length).toBe(1);
    expect(r3.templates[0].name).toBe("Beta One");

    // Search by slug substring.
    const r4 = await listTemplates(userA, { search: "list-alpha" });
    expect(r4.templates.length).toBe(2);

    // Pagination — pageSize=2 should yield 2 rows + total ≥ 3.
    const r5 = await listTemplates(userA, { page: 1, pageSize: 2 });
    expect(r5.templates.length).toBe(2);
    expect(r5.pageSize).toBe(2);
    expect(r5.total).toBeGreaterThanOrEqual(3);
    expect(r5.page).toBe(1);

    // Page 2 yields more rows.
    const r6 = await listTemplates(userA, { page: 2, pageSize: 2 });
    expect(r6.page).toBe(2);
    expect(r6.templates.length).toBeGreaterThanOrEqual(1);
  });

  it("listTemplates clamps pageSize to 100 and page to >=1", async () => {
    const r = await listTemplates(userA, { page: 0, pageSize: 9999 });
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(100);
  });

  // ---- Content edit creates version 2; v1 immutable ----------------------

  it("content edit creates version 2; version 1 row remains byte-identical (immutable)", async () => {
    const created = await createTemplate(userA, {
      name: "Versioned Template",
      slug: "versioned-content-edit",
      subject: "Original Subject",
      html: "<p>Original HTML</p>",
      text: "Original text",
    });

    // Snapshot the version 1 row BEFORE the update.
    const v1Before = await db.transactionalTemplateVersion.findUnique({
      where: { id: created.version.id },
    });
    expect(v1Before).not.toBeNull();

    // Perform a content edit (subject/html/text all change).
    const result = await updateTemplate(userA, created.template.id, {
      subject: "New Subject v2",
      html: "<p>New HTML</p>",
      text: "New text",
    });

    // New version created.
    expect(result.versionCreated).toBe(true);
    expect(result.newVersion).not.toBeNull();
    expect(result.newVersion!.version).toBe(2);
    expect(result.template.currentVersion).toBe(2);
    expect(result.current.version).toBe(2);
    expect(result.current.subject).toBe("New Subject v2");

    // Re-fetch version 1 — it must be byte-identical to the snapshot.
    const v1After = await db.transactionalTemplateVersion.findUnique({
      where: { id: created.version.id },
    });
    expect(v1After).not.toBeNull();
    expect(v1After!.version).toBe(1);
    expect(v1After!.subject).toBe(v1Before!.subject);
    expect(v1After!.html).toBe(v1Before!.html);
    expect(v1After!.text).toBe(v1Before!.text);
    expect(v1After!.variables).toEqual(v1Before!.variables);
    expect(v1After!.createdAt.getTime()).toBe(v1Before!.createdAt.getTime());
  });

  // ---- Metadata-only edit does NOT create a new version -----------------

  it("metadata-only edit (name only) does NOT create a new version", async () => {
    const created = await createTemplate(userA, {
      name: "Meta Only",
      slug: "meta-only-edit",
      subject: "Subject",
      html: "<p>HTML</p>",
      text: "Text",
    });

    const result = await updateTemplate(userA, created.template.id, {
      name: "Meta Only Renamed",
    });

    expect(result.versionCreated).toBe(false);
    expect(result.newVersion).toBeNull();
    expect(result.template.currentVersion).toBe(1);
    expect(result.current.version).toBe(1);
    expect(result.template.name).toBe("Meta Only Renamed");

    // Current version content is unchanged.
    expect(result.current.subject).toBe("Subject");
    expect(result.current.html).toBe("<p>HTML</p>");
    expect(result.current.text).toBe("Text");

    // Only 1 version row exists.
    const list = await listVersions(userA, created.template.id);
    expect(list).not.toBeNull();
    expect(list!.length).toBe(1);
  });

  it("metadata-only edit (description) does NOT create a new version", async () => {
    const created = await createTemplate(userA, {
      name: "Desc Edit",
      slug: "desc-edit",
      description: "Original desc",
      subject: "Subject",
      html: "<p>HTML</p>",
    });

    const result = await updateTemplate(userA, created.template.id, {
      description: "New desc",
    });

    expect(result.versionCreated).toBe(false);
    expect(result.template.description).toBe("New desc");
    expect(result.template.currentVersion).toBe(1);
  });

  // ---- Identical content does NOT create a new version -------------------

  it("identical content (after trim) does NOT create a new version", async () => {
    const created = await createTemplate(userA, {
      name: "Identical Content",
      slug: "identical-content",
      subject: "Subject",
      html: "<p>HTML</p>",
      text: "Text",
    });

    const result = await updateTemplate(userA, created.template.id, {
      subject: "Subject", // identical
      html: "<p>HTML</p>", // identical
      text: "Text", // identical
    });

    expect(result.versionCreated).toBe(false);
    expect(result.newVersion).toBeNull();
    expect(result.template.currentVersion).toBe(1);
    expect(result.current.version).toBe(1);

    const list = await listVersions(userA, created.template.id);
    expect(list!.length).toBe(1); // still only v1
  });

  it("whitespace-only content delta does NOT create a new version (trim normalization)", async () => {
    const created = await createTemplate(userA, {
      name: "Whitespace Trim",
      slug: "whitespace-trim",
      subject: "Subject",
      html: "<p>HTML</p>",
      text: "Text",
    });

    // Same content but with surrounding whitespace — trim normalization
    // should treat these as identical.
    const result = await updateTemplate(userA, created.template.id, {
      subject: "  Subject  ",
      html: "  <p>HTML</p>  ",
      text: "  Text  ",
    });

    expect(result.versionCreated).toBe(false);
    expect(result.template.currentVersion).toBe(1);
  });

  // ---- Concurrency-safe version allocation ------------------------------

  it("concurrent content edits allocate versions atomically — no gaps, no dups", async () => {
    const created = await createTemplate(userA, {
      name: "Concurrent Test",
      slug: "concurrent-test",
      subject: "Original v1",
      html: "<p>v1</p>",
      text: "v1",
    });

    const subjects = ["c2", "c3", "c4", "c5", "c6"];
    const N = subjects.length;

    // Fire N concurrent updateTemplate calls. Each provides distinct content
    // so contentChanged=true for every call. Each runs inside a transaction
    // with an atomic increment on parent.currentVersion.
    const results = await Promise.all(
      subjects.map((subj) =>
        updateTemplate(userA, created.template.id, {
          subject: `Concurrent ${subj}`,
          html: `<p>${subj}</p>`,
          text: subj,
        }),
      ),
    );

    // All N calls must succeed — no transaction should roll back.
    expect(results.length).toBe(N);
    expect(results.every((r) => r.versionCreated)).toBe(true);
    // Each call should have produced a distinct new version (2..6).
    const newVersionNumbers = results
      .map((r) => r.newVersion?.version)
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b);
    expect(newVersionNumbers).toEqual([2, 3, 4, 5, 6]);
    expect(new Set(newVersionNumbers).size).toBe(N); // no dups

    // Parent's currentVersion must be 1 (original) + N = 6.
    const final = await getTemplate(userA, created.template.id);
    expect(final).not.toBeNull();
    expect(final!.currentVersion).toBe(1 + N);

    // All version rows (1..6) must exist with no gaps and no duplicates.
    const versions = await listVersions(userA, created.template.id);
    expect(versions).not.toBeNull();
    expect(versions!.length).toBe(1 + N);
    const versionNumbers = versions!.map((v) => v.version).sort((a, b) => a - b);
    expect(versionNumbers).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(versionNumbers).size).toBe(1 + N); // no dups

    // listVersions returns newest first.
    expect(versions![0].version).toBe(1 + N);
    expect(versions![versions!.length - 1].version).toBe(1);
  });

  // ---- Variable extraction stored on version ----------------------------

  it("variable extraction stored on version — sorted, deduped", async () => {
    const result = await createTemplate(userA, {
      name: "Variable Storage",
      slug: "variable-storage",
      subject: "Welcome {{name}}",
      html: "<p>Email: {{email}}</p>",
      text: "{{name}} — {{email}}",
    });

    expect(result.version.variables).toEqual(["email", "name"]);
  });

  // ---- listVersions + getVersion ----------------------------------------

  it("listVersions returns newest first; getVersion fetches a historical version by number", async () => {
    const created = await createTemplate(userA, {
      name: "Versioned Lookup",
      slug: "versioned-lookup",
      subject: "v1 subject",
      html: "<p>v1</p>",
    });

    // Create version 2.
    await updateTemplate(userA, created.template.id, {
      subject: "v2 subject",
      html: "<p>v2</p>",
    });
    // Create version 3.
    await updateTemplate(userA, created.template.id, {
      subject: "v3 subject",
      html: "<p>v3</p>",
    });

    const list = await listVersions(userA, created.template.id);
    expect(list).not.toBeNull();
    expect(list!.length).toBe(3);
    expect(list![0].version).toBe(3);
    expect(list![1].version).toBe(2);
    expect(list![2].version).toBe(1);

    // Fetch historical versions by number — verify content matches.
    const v1 = await getVersion(userA, created.template.id, 1);
    expect(v1).not.toBeNull();
    expect(v1!.version).toBe(1);
    expect(v1!.subject).toBe("v1 subject");
    expect(v1!.html).toBe("<p>v1</p>");
    expect(v1!.text).toBeNull();

    const v2 = await getVersion(userA, created.template.id, 2);
    expect(v2).not.toBeNull();
    expect(v2!.version).toBe(2);
    expect(v2!.subject).toBe("v2 subject");

    const v3 = await getVersion(userA, created.template.id, 3);
    expect(v3).not.toBeNull();
    expect(v3!.version).toBe(3);
    expect(v3!.subject).toBe("v3 subject");

    // Non-existent version returns null (no throw — graceful null).
    const vMissing = await getVersion(userA, created.template.id, 999);
    expect(vMissing).toBeNull();
  });

  // ---- deleteTemplate cascades -----------------------------------------

  it("deleteTemplate cascades — versions are gone, getVersion/listVersions return null", async () => {
    const created = await createTemplate(userA, {
      name: "Cascade Delete",
      slug: "cascade-delete",
      subject: "v1",
      html: "<p>v1</p>",
    });

    // Create a version 2 so we have multiple rows to cascade.
    await updateTemplate(userA, created.template.id, {
      subject: "v2",
      html: "<p>v2</p>",
    });

    const deleted = await deleteTemplate(userA, created.template.id);
    expect(deleted).toBe(true);

    // Parent is gone.
    const gone = await getTemplate(userA, created.template.id);
    expect(gone).toBeNull();

    // getVersion returns null (template-owned check fails first).
    const v1 = await getVersion(userA, created.template.id, 1);
    expect(v1).toBeNull();

    // listVersions returns null (template-owned check fails first).
    const versions = await listVersions(userA, created.template.id);
    expect(versions).toBeNull();

    // Defense-in-depth: verify the underlying version ROWS are actually gone
    // (the schema's onDelete: Cascade should have cleaned them up).
    const leftover = await db.transactionalTemplateVersion.findMany({
      where: { templateId: created.template.id },
    });
    expect(leftover.length).toBe(0);

    // And the parent row is gone.
    const parentGone = await db.transactionalTemplate.findUnique({
      where: { id: created.template.id },
    });
    expect(parentGone).toBeNull();
  });

  // ---- Cross-tenant getVersion returns null ----------------------------

  it("cross-tenant getVersion returns null (no existence leakage)", async () => {
    const created = await createTemplate(userA, {
      name: "Owner A Only",
      slug: "cross-tenant-get-version",
      subject: "Subject",
      html: "<p>HTML</p>",
    });

    // User B asking for version 1 of user A's template → null, no error.
    const v = await getVersion(userB, created.template.id, 1);
    expect(v).toBeNull();

    // User B asking for a non-existent version on user A's template → also null.
    const vMissing = await getVersion(userB, created.template.id, 99);
    expect(vMissing).toBeNull();
  });

  // ---- Cross-tenant listVersions returns null --------------------------

  it("cross-tenant listVersions returns null (no existence leakage)", async () => {
    const created = await createTemplate(userA, {
      name: "List Versions Cross",
      slug: "list-versions-cross",
      subject: "Subject",
      html: "<p>HTML</p>",
    });

    const list = await listVersions(userB, created.template.id);
    expect(list).toBeNull();
  });
});
