import bcrypt from "bcryptjs";

/**
 * Password hashing with bcryptjs (§13.6 — cost factor 12).
 * bcryptjs is a pure-JS implementation, so it runs in the Node.js runtime on
 * Vercel serverless functions without native compilation.
 */

const COST = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  // genSalt with the explicit cost factor.
  const salt = await bcrypt.genSalt(COST);
  return bcrypt.hash(plaintext, salt);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plaintext, hash);
}
