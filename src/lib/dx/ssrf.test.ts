import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * SSRF validation — pure unit tests (Phase 7, section 18).
 *
 * This file is a PURE UNIT TEST — no DB, no network. All DNS resolution is
 * mocked via vi.mock("dns/promises", ...). It runs in the generic CI job.
 *
 * Coverage (per task spec):
 * - reject localhost, 127.0.0.1, 0.0.0.0
 * - reject private IPv4: 10.0.0.1, 172.16.0.1, 192.168.1.1, 100.64.0.1 (CGNAT)
 * - reject 169.254.169.254 (cloud metadata)
 * - reject IPv6 ::1 (loopback), fe80::1 (link-local), fc00::1 (ULA), ff00::1 (multicast)
 * - reject URL with credentials (user:pass@host)
 * - reject HTTP in production (NODE_ENV=production)
 * - allow HTTP in development (NODE_ENV=development for local testing)
 * - allow public HTTPS URL (e.g. https://hook.example.com)
 * - allow public IP (e.g. https://1.1.1.1)
 * - hostname resolving to private IP → rejected (mock dns.lookup)
 * - hostname resolving to public IP → allowed (mock dns.lookup)
 * - invalid URL format → rejected
 *
 * The mock dns.lookup returns controllable A/AAAA records per-test. This
 * ensures the test never makes a real DNS query (which would be flaky and
 * could leak internal-network info to an external resolver).
 */

// ---- Mocks (must come BEFORE the import) ---------------------------------

// Mock dns/promises so hostname-resolving tests are deterministic. The mock
// defaults to "no addresses" — each test can override via
// `mockDns.setAddresses([...])` to simulate the resolution it wants.
const dnsState = {
  addresses: [] as { address: string; family: number }[],
  throws: null as Error | null,
};

vi.mock("dns/promises", () => ({
  lookup: vi.fn(async (_hostname: string, _opts: unknown) => {
    if (dnsState.throws) throw dnsState.throws;
    // dns.lookup with {all: true} returns the array; without it returns the
    // first address. The SSRF helper uses {all: true}, so we return the array.
    return dnsState.addresses;
  }),
}));

import { validateWebhookDestination } from "@/lib/dx/ssrf";

/** Helper: program the mock dns.lookup to return these addresses. */
function setAddresses(addrs: string[]): void {
  dnsState.addresses = addrs.map((address) => ({
    address,
    family: address.includes(":") ? 6 : 4,
  }));
  dnsState.throws = null;
}

/** Helper: program the mock dns.lookup to throw. */
function setDnsThrow(err: Error): void {
  dnsState.throws = err;
  dnsState.addresses = [];
}

/** Helper: reset the mock to the default empty state. */
function resetDns(): void {
  dnsState.addresses = [];
  dnsState.throws = null;
}

// ---- Test suite ------------------------------------------------------------

describe("SSRF validation (Phase 7, section 18)", () => {
  beforeEach(() => {
    resetDns();
    // Default to development so HTTP-allowed tests don't need to set NODE_ENV.
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // ---- Loopback / localhost ----------------------------------------------

  it("rejects 'localhost' hostname", async () => {
    const r = await validateWebhookDestination("https://localhost/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects subdomain of localhost (e.g. api.localhost)", async () => {
    const r = await validateWebhookDestination("https://api.localhost/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects 127.0.0.1 (IPv4 loopback)", async () => {
    const r = await validateWebhookDestination("https://127.0.0.1/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects 0.0.0.0 (this network)", async () => {
    const r = await validateWebhookDestination("https://0.0.0.0/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects entire 127.0.0.0/8 (e.g. 127.99.99.99)", async () => {
    const r = await validateWebhookDestination("https://127.99.99.99/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  // ---- Private IPv4 ranges ----------------------------------------------

  it("rejects 10.0.0.1 (private 10/8)", async () => {
    const r = await validateWebhookDestination("https://10.0.0.1/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects 172.16.0.1 (private 172.16/12)", async () => {
    const r = await validateWebhookDestination("https://172.16.0.1/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects 172.31.255.255 (top of 172.16/12)", async () => {
    const r = await validateWebhookDestination("https://172.31.255.255/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("allows 172.32.0.1 (just outside 172.16/12 — NOT private)", async () => {
    const r = await validateWebhookDestination("https://172.32.0.1/hook");
    expect(r.ok).toBe(true);
  });

  it("rejects 192.168.1.1 (private 192.168/16)", async () => {
    const r = await validateWebhookDestination("https://192.168.1.1/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects 100.64.0.1 (CGNAT 100.64/10)", async () => {
    const r = await validateWebhookDestination("https://100.64.0.1/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects 100.127.255.255 (top of CGNAT 100.64/10)", async () => {
    const r = await validateWebhookDestination("https://100.127.255.255/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("allows 100.63.255.255 (just below CGNAT — NOT private)", async () => {
    const r = await validateWebhookDestination("https://100.63.255.255/hook");
    expect(r.ok).toBe(true);
  });

  // ---- Cloud metadata / link-local --------------------------------------

  it("rejects 169.254.169.254 (AWS/GCP/Azure cloud metadata)", async () => {
    const r = await validateWebhookDestination("https://169.254.169.254/latest/meta-data/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects 169.254.0.1 (link-local)", async () => {
    const r = await validateWebhookDestination("https://169.254.0.1/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  // ---- Multicast / reserved ---------------------------------------------

  it("rejects 224.0.0.1 (multicast 224/4)", async () => {
    const r = await validateWebhookDestination("https://224.0.0.1/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects 240.0.0.1 (reserved 240/4)", async () => {
    const r = await validateWebhookDestination("https://240.0.0.1/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  // ---- IPv6 special addresses -------------------------------------------

  it("rejects ::1 (IPv6 loopback)", async () => {
    const r = await validateWebhookDestination("https://[::1]/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects fe80::1 (IPv6 link-local)", async () => {
    const r = await validateWebhookDestination("https://[fe80::1]/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects fc00::1 (IPv6 unique-local address)", async () => {
    const r = await validateWebhookDestination("https://[fc00::1]/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects fd00::1 (IPv6 unique-local address)", async () => {
    const r = await validateWebhookDestination("https://[fd00::1]/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects ff00::1 (IPv6 multicast)", async () => {
    const r = await validateWebhookDestination("https://[ff00::1]/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("rejects :: (IPv6 unspecified)", async () => {
    const r = await validateWebhookDestination("https://[::]/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  // ---- Credentials in URL -----------------------------------------------

  it("rejects URL with credentials (user:pass@host)", async () => {
    const r = await validateWebhookDestination("https://user:pass@hook.example.com/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("credentials_in_url");
  });

  it("rejects URL with only username (user@host)", async () => {
    const r = await validateWebhookDestination("https://user@hook.example.com/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("credentials_in_url");
  });

  // ---- HTTP / HTTPS protocol gating -------------------------------------

  it("rejects HTTP in production (NODE_ENV=production)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setAddresses(["1.2.3.4"]); // public IP, so SSRF would otherwise pass
    const r = await validateWebhookDestination("http://hook.example.com/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("http_not_allowed");
  });

  it("allows HTTP in development (NODE_ENV=development)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setAddresses(["1.2.3.4"]); // public IP
    const r = await validateWebhookDestination("http://hook.example.com/hook");
    expect(r.ok).toBe(true);
  });

  it("rejects non-HTTP protocols (e.g. file://) in dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const r = await validateWebhookDestination("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_protocol");
  });

  // ---- Public HTTPS URLs / public IPs -----------------------------------

  it("allows public HTTPS URL (https://hook.example.com)", async () => {
    setAddresses(["1.2.3.4"]); // public IP
    const r = await validateWebhookDestination("https://hook.example.com/hook");
    expect(r.ok).toBe(true);
  });

  it("allows public IPv4 literal (https://1.1.1.1)", async () => {
    const r = await validateWebhookDestination("https://1.1.1.1/hook");
    expect(r.ok).toBe(true);
  });

  it("allows public IPv6 literal (https://[2606:4700:4700::1111])", async () => {
    const r = await validateWebhookDestination("https://[2606:4700:4700::1111]/hook");
    expect(r.ok).toBe(true);
  });

  // ---- DNS resolution outcomes ------------------------------------------

  it("hostname resolving to a private IP → rejected", async () => {
    // hook.example.com resolves to 10.0.0.5 — internal. Must reject.
    setAddresses(["10.0.0.5"]);
    const r = await validateWebhookDestination("https://hook.example.com/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("hostname resolving to a public IP → allowed", async () => {
    setAddresses(["1.2.3.4"]);
    const r = await validateWebhookDestination("https://hook.example.com/hook");
    expect(r.ok).toBe(true);
  });

  it("hostname resolving to MIXED public+private → rejected (private taints)", async () => {
    // A hostname that resolves to BOTH a public and a private IP must be
    // rejected — DNS rebinding defense. Any private address in the set fails.
    setAddresses(["1.2.3.4", "169.254.169.254"]);
    const r = await validateWebhookDestination("https://hook.example.com/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ssrf_blocked");
  });

  it("hostname resolving to no addresses → dns_unresolved", async () => {
    setAddresses([]);
    const r = await validateWebhookDestination("https://hook.example.com/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("dns_unresolved");
  });

  it("DNS lookup throws → dns_error", async () => {
    setDnsThrow(new Error("ENOTFOUND"));
    const r = await validateWebhookDestination("https://hook.example.com/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("dns_error");
  });

  // ---- Invalid URL format -----------------------------------------------

  it("rejects an empty string", async () => {
    const r = await validateWebhookDestination("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_url");
  });

  it("rejects a bare string (no protocol)", async () => {
    const r = await validateWebhookDestination("not a url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_url");
  });

  it("rejects malformed URL with spaces", async () => {
    const r = await validateWebhookDestination("https://hook example.com/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_url");
  });
});
