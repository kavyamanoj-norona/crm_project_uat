import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma client singleton — reused across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// After `prisma generate` the dev server hot-reloads a new PrismaClient class;
// a cached instance of the old class would miss new models, so replace it.
const cached = globalForPrisma.prisma;
export const db = cached instanceof PrismaClient ? cached : createClient();

if (process.env.NODE_ENV !== "production") {
  if (cached && cached !== db) void cached.$disconnect();
  globalForPrisma.prisma = db;
}
