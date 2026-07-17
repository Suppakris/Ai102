import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const create = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    tenantMembership: { findFirst: (...args: unknown[]) => findFirst(...args) },
    tenant: { create: (...args: unknown[]) => create(...args) },
  },
}));

const { getOrCreatePersonalTenant } = await import("@/server/tenant");

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
});

describe("getOrCreatePersonalTenant", () => {
  it("returns the existing personal tenant without creating a new one", async () => {
    findFirst.mockResolvedValue({ tenantId: "tenant_existing" });

    const tenantId = await getOrCreatePersonalTenant("user_1");

    expect(tenantId).toBe("tenant_existing");
    expect(create).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1", tenant: { isPersonal: true } },
      }),
    );
  });

  it("creates a personal tenant with an owner membership on first use", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "tenant_new" });

    const tenantId = await getOrCreatePersonalTenant("user_2");

    expect(tenantId).toBe("tenant_new");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isPersonal: true,
          memberships: { create: { userId: "user_2", role: "OWNER" } },
        }),
      }),
    );
  });
});
