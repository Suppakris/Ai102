import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/env";
import { PrismaClient } from "@/prisma/client";

const createNoopClient = () => {
  const createNoopFunction = (name: string) => {
    const fn = async () => {
      if (name === "findMany") return [];
      if (name === "count") return 0;
      return null;
    };

    return new Proxy(fn, {
      get: (_target, prop) => {
        if (prop === "then") return undefined;
        return createNoopFunction(String(prop));
      },
    });
  };

  return new Proxy({}, {
    get: (_target, prop) => {
      if (prop === "then") return undefined;
      return createNoopFunction(String(prop));
    },
  }) as unknown as PrismaClient;
};

// Each serverless function instance gets its own connection pool. Capping it
// to a single connection per instance avoids exhausting a poolers's small
// max-clients limit (e.g. Supabase's Session Pooler) when several instances
// are warm at once; the pooler itself is responsible for multiplexing across
// instances, not the app-side pool.
const SERVERLESS_POOL_MAX_CONNECTIONS = 1;

const createPrismaClient = () => {
  if (!env.DATABASE_URL) {
    console.warn("[db] DATABASE_URL is not set; using a no-op database client in development.");
    return createNoopClient();
  }

  return new PrismaClient({
    adapter:
      env.NODE_ENV === "production" && !process.env.LOCAL_PRODUCTION
        ? new PrismaNeon({
            connectionString: env.DATABASE_URL,
            max: SERVERLESS_POOL_MAX_CONNECTIONS,
          })
        : new PrismaPg({
            connectionString: env.DATABASE_URL,
            max: SERVERLESS_POOL_MAX_CONNECTIONS,
          }),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
