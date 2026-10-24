import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Soft delete: every table has `isDelete` (0 = active, 1 = deleted). Reads hide deleted rows
// unless the query sets `isDelete` itself (e.g. `where: { isDelete: 1 }` for a recycle view).
function hideDeleted<A extends { where?: unknown }>(args: A): A {
  const where = (args.where ?? {}) as Record<string, unknown>;
  if ("isDelete" in where) return args;
  return { ...args, where: { ...where, isDelete: 0 } };
}

// Prisma client singleton — reused across hot reloads in dev.
function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        findMany: ({ args, query }) => query(hideDeleted(args)),
        findFirst: ({ args, query }) => query(hideDeleted(args)),
        findFirstOrThrow: ({ args, query }) => query(hideDeleted(args)),
        findUnique: ({ args, query }) => query(hideDeleted(args)),
        findUniqueOrThrow: ({ args, query }) => query(hideDeleted(args)),
        count: ({ args, query }) => query(hideDeleted(args)),
        aggregate: ({ args, query }) => query(hideDeleted(args)),
        groupBy: ({ args, query }) => query(hideDeleted(args)),
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prisma?: ExtendedClient; prismaVersion?: number };

// Bump when the extension changes so a hot-reloaded dev server drops the stale cached client.
const CLIENT_VERSION = 12;

// After `prisma generate` the dev server hot-reloads a new PrismaClient class;
// a cached instance of the old class would miss new models, so replace it.
const cached = globalForPrisma.prismaVersion === CLIENT_VERSION ? globalForPrisma.prisma : undefined;
export const db = cached ?? createClient();

if (process.env.NODE_ENV !== "production") {
  if (globalForPrisma.prisma && globalForPrisma.prisma !== db) void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = db;
  globalForPrisma.prismaVersion = CLIENT_VERSION;
}

/** Interactive-transaction client (`db.$transaction(async (tx) => …)`) — carries the soft-delete filter too. */
export type Tx = Omit<ExtendedClient, "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on" | "$use">;
