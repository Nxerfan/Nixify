#!/usr/bin/env node
/**
 * @mailguard/cli — Official MailGuard CLI tool.
 *
 * No external dependencies. Uses only Node built-ins (fs, path, os, readline,
 * fetch). Designed for Node 18+ and Bun.
 *
 * Commands:
 *   mailguard version                                  Print the version.
 *   mailguard login <api-key>                          Save the API key locally.
 *   mailguard logout                                   Delete the local config.
 *   mailguard config                                   Print current config (redacted).
 *   mailguard config set baseUrl <url>                 Set the base URL.
 *   mailguard send-otp <email> [--purpose signup|...]  Send an OTP.
 *   mailguard verify-otp <email> <code>                Verify an OTP.
 *   mailguard init                                     Interactive setup.
 *   mailguard help                                     Show usage.
 *
 * Output format:
 *   - API responses → pretty-printed JSON to stdout.
 *   - Status messages → plain text to stdout.
 *   - Errors → plain text to stderr, exit code 1.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const { randomUUID } = require("crypto");

const VERSION = "mailguard-cli v1.0.0";
const DEFAULT_BASE_URL = "http://localhost:3000";

// NOTE: config paths are computed lazily via `getConfigDir()` / `getConfigFile()`
// so tests can point HOME at a temp dir between tests. They honor
// `process.env.HOME` at call-time, not at module-load time.
function getConfigDir() {
  return path.join(os.homedir(), ".mailguard");
}
function getConfigFile() {
  return path.join(getConfigDir(), "config.json");
}

// ---- Config helpers ---------------------------------------------------------

function loadConfig() {
  try {
    const raw = fs.readFileSync(getConfigFile(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveConfig(cfg) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(getConfigFile(), JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

function deleteConfig() {
  try {
    fs.unlinkSync(getConfigFile());
    return true;
  } catch {
    return false;
  }
}

/** Redact the API key, showing only the prefix (mg_live_XXXX…). */
function redactKey(key) {
  if (!key || typeof key !== "string") return "(none)";
  if (key.length <= 12) return key[0] + "…";
  return `${key.slice(0, 12)}… (${key.length - 12} chars hidden)`;
}

// ---- API helpers ------------------------------------------------------------

/**
 * Make a v1 API request. Throws an Error with a useful message on any failure.
 * Returns the parsed JSON body on success.
 */
async function apiRequest(cfg, method, urlPath, body) {
  if (!cfg || !cfg.apiKey) {
    throw new Error("Not logged in. Run `mailguard login <api-key>` or `mailguard init` first.");
  }
  const baseUrl = (cfg.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = baseUrl + urlPath;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const headers = {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "@mailguard/cli/1.0.0",
    };
    if (method === "POST" && (urlPath === "/api/v1/otp/send" || urlPath === "/api/v1/otp/resend")) {
      headers["Idempotency-Key"] = randomUUID();
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const contentType = res.headers.get("content-type") || "";
    let json = null;
    if (contentType.includes("application/json")) {
      try { json = await res.json(); } catch { json = null; }
    }
    if (!res.ok) {
      const errShape = (json && json.error) || {};
      const requestId = res.headers.get("X-Request-Id") || (json && json.request_id) || null;
      const msg = errShape.message || `HTTP ${res.status}`;
      const code = errShape.code ? ` [${errShape.code}]` : "";
      const reqPart = requestId ? ` (request_id: ${requestId})` : "";
      throw new Error(`${msg}${code}${reqPart}`);
    }
    return json ?? {};
  } finally {
    clearTimeout(timer);
  }
}

// ---- Command handlers -------------------------------------------------------

function cmdVersion() {
  process.stdout.write(VERSION + "\n");
  return 0;
}

function cmdLogin(args) {
  const apiKey = args[0];
  if (!apiKey) {
    process.stderr.write("Usage: mailguard login <api-key>\n");
    return 1;
  }
  const existing = loadConfig() || {};
  saveConfig({ apiKey, baseUrl: existing.baseUrl || DEFAULT_BASE_URL });
  process.stdout.write(`Logged in. API key saved to ${getConfigFile()}\n`);
  process.stdout.write(`Try: mailguard send-otp user@example.com\n`);
  return 0;
}

function cmdLogout() {
  const removed = deleteConfig();
  if (removed) {
    process.stdout.write("Logged out. Config file removed.\n");
  } else {
    process.stdout.write("Not logged in (no config file to remove).\n");
  }
  return 0;
}

function cmdConfig(args) {
  // mailguard config set baseUrl <url>
  if (args[0] === "set" && args[1] === "baseUrl") {
    const url = args[2];
    if (!url) {
      process.stderr.write("Usage: mailguard config set baseUrl <url>\n");
      return 1;
    }
    const cfg = loadConfig() || { apiKey: null };
    cfg.baseUrl = url;
    saveConfig(cfg);
    process.stdout.write(`Base URL set to: ${url}\n`);
    return 0;
  }
  if (args[0] === "set") {
    process.stderr.write(`Unknown config key: ${args[1] || "(none)"}\n`);
    process.stderr.write(`Only "baseUrl" is supported.\n`);
    return 1;
  }

  // mailguard config — print the current config.
  const cfg = loadConfig();
  if (!cfg || !cfg.apiKey) {
    process.stdout.write("Not logged in\n");
    return 0;
  }
  process.stdout.write(JSON.stringify({
    apiKey: redactKey(cfg.apiKey),
    baseUrl: cfg.baseUrl || DEFAULT_BASE_URL,
    configPath: getConfigFile(),
  }, null, 2) + "\n");
  return 0;
}

async function cmdSendOtp(args) {
  const email = args[0];
  if (!email) {
    process.stderr.write("Usage: mailguard send-otp <email> [--purpose signup|login|reset]\n");
    return 1;
  }
  // Parse --purpose
  let purpose = "signup";
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--purpose" && args[i + 1]) {
      purpose = args[i + 1];
      i++;
    } else if (args[i].startsWith("--purpose=")) {
      purpose = args[i].slice("--purpose=".length);
    }
  }
  if (!["signup", "login", "reset"].includes(purpose)) {
    process.stderr.write(`Invalid purpose: ${purpose}. Must be one of: signup, login, reset.\n`);
    return 1;
  }

  const cfg = loadConfig();
  try {
    const result = await apiRequest(cfg, "POST", "/api/v1/otp/send", { email, purpose });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return 0;
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    return 1;
  }
}

async function cmdVerifyOtp(args) {
  const email = args[0];
  const code = args[1];
  if (!email || !code) {
    process.stderr.write("Usage: mailguard verify-otp <email> <code>\n");
    return 1;
  }
  const cfg = loadConfig();
  try {
    const result = await apiRequest(cfg, "POST", "/api/v1/otp/verify", { email, code });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return 0;
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    return 1;
  }
}

async function cmdInit() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Enter your MailGuard API key (mg_live_* or mg_test_*): ", (apiKey) => {
      const key = (apiKey || "").trim();
      if (!key) {
        rl.close();
        process.stderr.write("No API key provided. Aborting.\n");
        resolve(1);
        return;
      }
      rl.question(`Base URL (default: ${DEFAULT_BASE_URL}): `, (baseUrlInput) => {
        const baseUrl = (baseUrlInput || "").trim() || DEFAULT_BASE_URL;
        rl.close();
        saveConfig({ apiKey: key, baseUrl });
        process.stdout.write("\nConfigured!\n");
        process.stdout.write(`Try: mailguard send-otp user@example.com\n`);
        resolve(0);
      });
    });
  });
}

function cmdHelp() {
  const usage = `Usage: mailguard <command> [args]

Commands:
  version                                  Print the CLI version.
  login <api-key>                          Save your API key locally.
  logout                                   Delete the local config.
  config                                   Print the current config (key redacted).
  config set baseUrl <url>                 Set the base URL.
  send-otp <email> [--purpose signup|...]  Send an OTP to <email>.
  verify-otp <email> <code>                Verify a 6-digit OTP code.
  init                                     Interactive setup (prompts for API key).
  help                                     Show this usage message.

Configuration is stored at: ${getConfigFile()}

Examples:
  mailguard init
  mailguard send-otp alice@example.com --purpose signup
  mailguard verify-otp alice@example.com 123456
`;
  process.stdout.write(usage);
  return 0;
}

// ---- Dispatch ---------------------------------------------------------------

async function main(argv) {
  const args = argv.slice(2); // strip node + script path
  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case undefined:
    case "":
    case "help":
    case "--help":
    case "-h":
      return cmdHelp();
    case "version":
    case "--version":
    case "-v":
      return cmdVersion();
    case "login":
      return cmdLogin(rest);
    case "logout":
      return cmdLogout();
    case "config":
      return cmdConfig(rest);
    case "send-otp":
      return await cmdSendOtp(rest);
    case "verify-otp":
      return await cmdVerifyOtp(rest);
    case "init":
      return await cmdInit();
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.stderr.write(`Run 'mailguard help' for usage.\n`);
      return 1;
  }
}

// Only run main when invoked directly (not when required from a test).
if (require.main === module) {
  main(process.argv).then((code) => process.exit(code));
}

// Export internals for tests.
module.exports = {
  main,
  cmdVersion,
  cmdLogin,
  cmdLogout,
  cmdConfig,
  cmdSendOtp,
  cmdVerifyOtp,
  cmdInit,
  cmdHelp,
  loadConfig,
  saveConfig,
  deleteConfig,
  redactKey,
  getConfigDir,
  getConfigFile,
  DEFAULT_BASE_URL,
  VERSION,
};
