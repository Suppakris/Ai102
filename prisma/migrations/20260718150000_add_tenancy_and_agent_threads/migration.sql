-- Adds the multi-tenancy models (Tenant, TenantMembership), the ownership
-- audit columns on BaseDocument, tenant scoping on CustomTheme/FontPair, and
-- the AgentThread pruning table. These entered schema.prisma in commit
-- 0f5f190 without a migration (the schema was applied via `db push` at the
-- time); every statement below matches `prisma migrate diff --from-empty
-- --to-schema` output exactly.
--
-- NOTE for existing `db push` databases: the tables/columns already exist
-- there. Baseline instead of applying:
--   pnpm exec prisma migrate resolve --applied 20260718150000_add_tenancy_and_agent_threads

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isPersonal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentThread" (
    "threadId" TEXT NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentThread_pkey" PRIMARY KEY ("threadId")
);

-- AlterTable
ALTER TABLE "BaseDocument" ADD COLUMN "tenantId" TEXT NOT NULL,
ADD COLUMN "createdById" TEXT NOT NULL,
ADD COLUMN "updatedById" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CustomTheme" ADD COLUMN "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FontPair" ADD COLUMN "tenantId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "TenantMembership_userId_idx" ON "TenantMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_tenantId_userId_key" ON "TenantMembership"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AgentThread_lastActiveAt_idx" ON "AgentThread"("lastActiveAt");

-- CreateIndex
CREATE INDEX "BaseDocument_tenantId_idx" ON "BaseDocument"("tenantId");

-- CreateIndex
CREATE INDEX "CustomTheme_tenantId_idx" ON "CustomTheme"("tenantId");

-- CreateIndex
CREATE INDEX "FontPair_tenantId_idx" ON "FontPair"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseDocument" ADD CONSTRAINT "BaseDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseDocument" ADD CONSTRAINT "BaseDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseDocument" ADD CONSTRAINT "BaseDocument_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTheme" ADD CONSTRAINT "CustomTheme_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FontPair" ADD CONSTRAINT "FontPair_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
