import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const PRISMA_SCHEMA_STAMP = "admin-role-invite-v1";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
  prismaSchemaStamp?: string;
};

function withoutSslMode(url: string) {
  return url
    .replace(/[?&]sslmode=[^&]*/gi, "")
    .replace(/[?&]uselibpqcompat=[^&]*/gi, "")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
}

function createPrismaClient() {
  const rawUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/postgres";
  const isSupabase = /supabase\.(co|com)|pooler\.supabase/i.test(rawUrl);
  const isLocalPrismaDev = /localhost|127\.0\.0\.1/.test(rawUrl);
  const connectionString = isSupabase ? withoutSslMode(rawUrl) : rawUrl;

  // Reuse one Pool. Prisma Dev / some proxies mishandle concurrent prepared
  // statements on the same connection (Postgres 08P01 bind mismatches).
  // pg treats sslmode=require as verify-full; Supabase's chain then fails.
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      // Session pooler allows ~15 clients. Local `next dev` + VPS must share that.
      max: isLocalPrismaDev ? 1 : isSupabase ? (process.env.NODE_ENV === "production" ? 6 : 3) : 8,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prismaSchemaStamp !== PRISMA_SCHEMA_STAMP
) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.pgPool = undefined;
  globalForPrisma.prismaSchemaStamp = PRISMA_SCHEMA_STAMP;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
