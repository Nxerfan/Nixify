import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { config } from "dotenv";

// Load .env with override=true so our .env takes precedence over Bun's cached env
const result = config({ override: true });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    env: {
      // Force DATABASE_URL from .env (Bun may cache a stale value)
      DATABASE_URL: result.parsed?.DATABASE_URL ?? process.env.DATABASE_URL ?? "",
      OTP_PEPPER: result.parsed?.OTP_PEPPER ?? process.env.OTP_PEPPER ?? "test-pepper-32-bytes-hex-placeholder!!",
      JWT_SECRET: result.parsed?.JWT_SECRET ?? process.env.JWT_SECRET ?? "test-jwt-secret-32-bytes-hex-placeholder!!",
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
