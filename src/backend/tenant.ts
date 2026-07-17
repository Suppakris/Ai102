import { db } from "@/backend/db";

// Every user gets exactly one personal tenant, created lazily the first
// time they touch a tenant-scoped resource (documents, themes, font
// pairs). Shared/team tenants (multiple members) are created explicitly
// elsewhere and are not personal.
export async function getOrCreatePersonalTenant(userId: string): Promise<string> {
  const existing = await db.tenantMembership.findFirst({
    where: { userId, tenant: { isPersonal: true } },
    select: { tenantId: true },
  });
  if (existing) return existing.tenantId;

  const tenant = await db.tenant.create({
    data: {
      name: "Personal",
      slug: `personal-${userId}`,
      isPersonal: true,
      memberships: {
        create: { userId, role: "OWNER" },
      },
    },
    select: { id: true },
  });
  return tenant.id;
}
