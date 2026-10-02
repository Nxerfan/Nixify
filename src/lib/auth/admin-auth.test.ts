/**
 * Admin auth hardening — executable runtime tests.
 *
 * Tests the REAL admin-token cryptography (fail-closed secret, mandatory
 * tokenVersion, structural rejection) against the shared helper
 * (src/lib/auth/admin-token.ts) with mocked DB/cookies where needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

const ROOT = resolve(__dirname, "../../..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

// ---- Mocks -----------------------------------------------------------------

const mockCookieStore = {
  _cookie: undefined as string | undefined,
  get(name: string) {
    if (name === "mg_admin") {
      return this._cookie !== undefined ? { value: this._cookie } : undefined;
    }
    return undefined;
  },
  set(name: string, value: string, _opts: unknown) {
    if (name === "mg_admin") this._cookie = value;
  },
};
vi.mock("next/headers", () => ({
  cookies: async () => mockCookieStore,
}));

const mockAdminFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    adminUser: {
      findUnique: (...args: unknown[]) => mockAdminFindUnique(...args),
    },
  },
}));

import {
  getAdminSecret,
  signAdminToken,
  decodeAdminToken,
  type AdminIssuancePayload,
} from "@/lib/auth/admin-token";
import { SignJWT } from "jose";

const TEST_SECRET = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  mockCookieStore._cookie = undefined;
  mockAdminFindUnique.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function signAdmin(version: number): Promise<string> {
  const token = await signAdminToken({
    sub: "1",
    role: "admin",
    email: "admin@example.com",
    tokenVersion: version,
  } satisfies AdminIssuancePayload);
  if (!token) throw new Error("signAdminToken returned null");
  return token;
}

async function signMalformedAdmin(overrides: Record<string, unknown>): Promise<string> {
  const payload = { sub: "1", role: "admin", email: "admin@example.com", ...overrides };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub as string)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getAdminSecret()!);
}

// ---- Secret fail-closed ---------------------------------------------------

describe("admin secret fail-closed", () => {
  it("missing JWT_SECRET → getAdminSecret returns null", () => {
    delete process.env.JWT_SECRET;
    expect(getAdminSecret()).toBeNull();
  });

  it("missing JWT_SECRET → signAdminToken returns null", async () => {
    delete process.env.JWT_SECRET;
    const token = await signAdminToken({
      sub: "1", role: "admin", email: "a@b.com", tokenVersion: 0,
    } satisfies AdminIssuancePayload);
    expect(token).toBeNull();
  });

  it("missing JWT_SECRET → decodeAdminToken returns null", async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    const token = await signAdmin(0);
    delete process.env.JWT_SECRET;
    expect(await decodeAdminToken(token)).toBeNull();
  });

  it("old known fallback 'insecure-admin-secret' cannot authenticate", () => {
    process.env.JWT_SECRET = "insecure-admin-secret";
    expect(getAdminSecret()).toBeNull();
  });

  it("old known fallback 'insecure' cannot authenticate", () => {
    process.env.JWT_SECRET = "insecure";
    expect(getAdminSecret()).toBeNull();
  });

  it("placeholder 'replace-with-32-char-hex-string' cannot authenticate", () => {
    process.env.JWT_SECRET = "replace-with-32-char-hex-string";
    expect(getAdminSecret()).toBeNull();
  });

  it("empty string JWT_SECRET cannot authenticate", () => {
    process.env.JWT_SECRET = "";
    expect(getAdminSecret()).toBeNull();
  });
});

// ---- tokenVersion structural validation ------------------------------------

describe("admin tokenVersion structural validation", () => {
  it("new admin JWT contains tokenVersion", async () => {
    const payload = await decodeAdminToken(await signAdmin(3));
    expect(payload).not.toBeNull();
    expect(payload!.tokenVersion).toBe(3);
  });

  it("token without tokenVersion is rejected (no legacy compat for admin)", async () => {
    expect(await decodeAdminToken(await signMalformedAdmin({}))).toBeNull();
  });

  it("string tokenVersion is rejected", async () => {
    expect(await decodeAdminToken(await signMalformedAdmin({ tokenVersion: "3" }))).toBeNull();
  });

  it("negative tokenVersion is rejected", async () => {
    expect(await decodeAdminToken(await signMalformedAdmin({ tokenVersion: -1 }))).toBeNull();
  });

  it("fractional tokenVersion is rejected", async () => {
    expect(await decodeAdminToken(await signMalformedAdmin({ tokenVersion: 3.5 }))).toBeNull();
  });

  it("NaN tokenVersion is rejected", async () => {
    expect(await decodeAdminToken(await signMalformedAdmin({ tokenVersion: NaN }))).toBeNull();
  });

  it("token with role !== 'admin' is rejected", async () => {
    const token = await new SignJWT({ role: "user", sub: "1", tokenVersion: 0 })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(getAdminSecret()!);
    expect(await decodeAdminToken(token)).toBeNull();
  });

  it("token with empty sub is rejected", async () => {
    const token = await new SignJWT({ role: "admin", sub: "", email: "a@b.com", tokenVersion: 0 })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(getAdminSecret()!);
    expect(await decodeAdminToken(token)).toBeNull();
  });
});

// ---- Authoritative getAdmin (DB tokenVersion comparison) ------------------

describe("getAdmin — authoritative DB tokenVersion comparison", () => {
  function mockAdmin(overrides: Partial<{ id: number; tokenVersion: number }> = {}) {
    mockAdminFindUnique.mockResolvedValue({ id: 1, tokenVersion: 0, ...overrides });
  }

  it("matching JWT/DB version → authenticated", async () => {
    mockAdmin({ tokenVersion: 3 });
    mockCookieStore._cookie = await signAdmin(3);
    const { getAdmin } = await import("@/lib/auth/admin");
    const admin = await getAdmin();
    expect(admin).not.toBeNull();
    expect(admin?.tokenVersion).toBe(3);
  });

  it("mismatched version → rejected", async () => {
    mockAdmin({ tokenVersion: 3 });
    mockCookieStore._cookie = await signAdmin(2);
    const { getAdmin } = await import("@/lib/auth/admin");
    expect(await getAdmin()).toBeNull();
  });

  it("missing AdminUser (deleted) → rejected", async () => {
    mockAdminFindUnique.mockResolvedValue(null);
    mockCookieStore._cookie = await signAdmin(0);
    const { getAdmin } = await import("@/lib/auth/admin");
    expect(await getAdmin()).toBeNull();
  });

  it("valid matching JWT + DB version 0 → authenticated", async () => {
    mockAdmin({ tokenVersion: 0 });
    mockCookieStore._cookie = await signAdmin(0);
    const { getAdmin } = await import("@/lib/auth/admin");
    expect(await getAdmin()).not.toBeNull();
  });
});

// ---- Source inspection: admin login route --------------------------------

describe("admin login route — rate limit + generic error + safe logging", () => {
  it("admin login route has per-IP rate limit", () => {
    const src = read("src/app/api/admin/login/route.ts");
    expect(src).toMatch(/admin_login_ip:/);
    expect(src).toMatch(/rateLimit/);
  });

  it("admin login route has per-email rate limit", () => {
    const src = read("src/app/api/admin/login/route.ts");
    expect(src).toMatch(/admin_login_email:/);
  });

  it("rate limit runs BEFORE credential verification", () => {
    const src = read("src/app/api/admin/login/route.ts");
    const limitedCallIdx = src.indexOf("const limited = await checkAdminLoginRateLimit");
    const signInCallIdx = src.indexOf("const ok = await signInAdmin");
    expect(limitedCallIdx).toBeGreaterThan(-1);
    expect(signInCallIdx).toBeGreaterThan(-1);
    expect(limitedCallIdx).toBeLessThan(signInCallIdx);
  });

  it("throttled response includes Retry-After", () => {
    const src = read("src/app/api/admin/login/route.ts");
    expect(src).toMatch(/Retry-After/);
    expect(src).toMatch(/429/);
  });

  it("generic error for failed credentials (no admin existence leak)", () => {
    const src = read("src/app/api/admin/login/route.ts");
    expect(src).toMatch(/Invalid admin credentials/);
    expect(src).not.toMatch(/admin not found/i);
  });

  it("no raw err.message logging", () => {
    const src = read("src/app/api/admin/login/route.ts");
    expect(src).not.toMatch(/console\.error/);
    expect(src).toMatch(/logger\.error/);
    expect(src).toMatch(/safeErrorRep/);
  });
});

// ---- Source inspection: updateAdminPassword revocation -------------------

describe("updateAdminPassword — atomic revocation", () => {
  it("password update increments tokenVersion atomically", () => {
    const src = read("src/lib/auth/admin.ts");
    const updateIdx = src.indexOf("await db.adminUser.update({");
    expect(updateIdx).toBeGreaterThan(-1);
    const updateBlock = src.slice(updateIdx, updateIdx + 300);
    expect(updateBlock).toMatch(/passwordHash:\s*newHash/);
    expect(updateBlock).toMatch(/tokenVersion:\s*\{\s*increment:\s*1\s*\}/);
  });
});

// ---- Source inspection: admin login UI -----------------------------------

describe("admin login UI — no default credentials", () => {
  it("contains NO 'admin1234'", () => {
    expect(read("src/app/admin/login/page.tsx")).not.toContain("admin1234");
  });

  it("contains NO 'admin@nixify.local'", () => {
    expect(read("src/app/admin/login/page.tsx")).not.toContain("admin@nixify.local");
  });

  it("contains NO 'Default credentials' claim", () => {
    expect(read("src/app/admin/login/page.tsx")).not.toMatch(/Default credentials/i);
  });

  it("contains neutral security copy", () => {
    expect(read("src/app/admin/login/page.tsx")).toMatch(/Use your authorized administrator credentials/);
  });
});

// ---- Source inspection: seedAdmin safe logging ---------------------------

describe("seedAdmin — safe logging", () => {
  it("does NOT console.log the raw admin email", () => {
    const src = read("src/lib/auth/admin.ts");
    expect(src).not.toMatch(/console\.log.*email/);
    expect(src).not.toMatch(/Seeded admin user:/);
  });

  it("uses the canonical logger with bounded metadata", () => {
    const src = read("src/lib/auth/admin.ts");
    expect(src).toMatch(/logger\.info/);
    expect(src).toMatch(/admin_seeded/);
  });
});

// ---- Source inspection: admin API guard coverage ------------------------

describe("admin API guard coverage", () => {
  it("every privileged /api/admin/** route uses getAdmin (directly or via a shared helper)", () => {
    function findRoutes(dir: string): string[] {
      const results: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) results.push(...findRoutes(full));
        else if (entry === "route.ts") results.push(full);
      }
      return results;
    }

    const routes = findRoutes(join(process.cwd(), "src/app/api/admin"));
    expect(routes.length).toBeGreaterThan(0);

    const ADMIN_AUTH_PATTERNS = ["getAdmin", "resolveAnalyticsRequester", "resolveThemesViewer"];
    const PUBLIC_EXCEPTIONS = ["login", "logout"];
    const missing: string[] = [];

    for (const route of routes) {
      if (PUBLIC_EXCEPTIONS.some((exc) => route.includes(`/admin/${exc}/`))) continue;
      const src = readFileSync(route, "utf-8");
      if (!ADMIN_AUTH_PATTERNS.some((p) => src.includes(p))) missing.push(route);
    }
    expect(missing, `privileged admin routes missing auth: ${JSON.stringify(missing)}`).toEqual([]);
  });
});

// ---- Source inspection: middleware uses shared helper -------------------

describe("middleware uses the shared admin-token helper", () => {
  it("imports decodeAdminToken (no independent secret derivation)", () => {
    const src = read("src/middleware.ts");
    expect(src).toMatch(/decodeAdminToken/);
    expect(src).toMatch(/admin-token/);
    expect(src).not.toMatch(/process\.env\.JWT_SECRET \?\? "insecure"/);
    expect(src).not.toMatch(/insecure-admin-secret/);
  });

  it("does NOT import Prisma or @/lib/db", () => {
    const src = read("src/middleware.ts");
    // Strip comment lines before checking — comments may mention "Prisma" in prose.
    const codeOnly = src.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//")).join("\n");
    expect(codeOnly).not.toMatch(/from ["']@\/lib\/db["']/);
    expect(codeOnly).not.toMatch(/\bprisma\b/i);
  });
});

// ---- Source inspection: cookie contract ----------------------------------

describe("admin cookie contract", () => {
  it("admin cookie has httpOnly, sameSite=lax, path=/, bounded maxAge", () => {
    const src = read("src/lib/auth/admin.ts");
    expect(src).toMatch(/httpOnly:\s*true/);
    expect(src).toMatch(/sameSite:\s*"lax"/);
    expect(src).toMatch(/path:\s*"\/"/);
    expect(src).toMatch(/maxAge:\s*ADMIN_TTL/);
  });

  it("admin logout clears cookie with matching path/security (no tokenVersion bump)", () => {
    const src = read("src/lib/auth/admin.ts");
    // Extract only the signOutAdmin function body — stop at the JSDoc comment
    // for getAdmin (which mentions tokenVersion in prose).
    const fn = src.split("export async function signOutAdmin")[1]?.split("\n/**")[0] ?? "";
    expect(fn).toMatch(/\.\.\.ADMIN_COOKIE_OPTIONS/);
    expect(fn).toMatch(/maxAge:\s*0/);
    expect(fn).not.toMatch(/tokenVersion/);
    expect(fn).not.toMatch(/increment/);
  });
});

// ---- No schema migration needed ------------------------------------------

describe("no migration needed (AdminUser.tokenVersion already exists)", () => {
  it("AdminUser model already has tokenVersion Int @default(0)", () => {
    const schema = read("prisma/schema.prisma");
    const adminModel = schema.split("model AdminUser {")[1]?.split("}")[0] ?? "";
    expect(adminModel).toMatch(/tokenVersion\s+Int\s+@default\(0\)/);
  });
});
