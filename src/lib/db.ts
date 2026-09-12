import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Log level: full query logging in dev/test (helpful for debugging), but in
// production only `error` + `warn` (query logs are noisy and leak SQL into the
// Vercel function logs). This keeps prod logs clean while preserving the
// dev-time visibility the team relies on.
const logLevel = process.env.NODE_ENV === 'production'
  ? ['error', 'warn']
  : ['query']

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevel as ('error' | 'warn' | 'query')[],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db