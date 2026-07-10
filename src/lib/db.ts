import { PrismaClient } from '@prisma/client'

// NOTE: This sandbox's parent process exports a stale
// `DATABASE_URL=file:/home/z/my-project/db/custom.db` that overrides anything
// in `.env` (process env wins over .env in Next.js / Prisma). We therefore
// align everything — .env, this fallback, and the migrated data file — to
// `db/custom.db` so the connection works no matter how the server is launched.
const DB_URL =
  process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: DB_URL,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db