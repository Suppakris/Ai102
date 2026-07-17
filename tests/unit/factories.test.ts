import { describe, expect, it } from "vitest";
import {
  makeBaseDocument,
  makeGeneratedImage,
  makeImageGenerationJobData,
  makePresentationGenerateRequest,
  makeSession,
  makeTenant,
  makeUser,
} from "../factories";

describe("mock payload factories", () => {
  it("gives each user a unique id and derived email by default", () => {
    const a = makeUser();
    const b = makeUser();

    expect(a.id).not.toBe(b.id);
    expect(a.email).toContain(a.id);
  });

  it("honors overrides without dropping the rest of the shape", () => {
    const admin = makeSession({ role: "ADMIN" });

    expect(admin.user.role).toBe("ADMIN");
    expect(admin.user.isAdmin).toBe(true);
    expect(admin.user.id).toBeTruthy();
  });

  it("keeps createdBy/updatedBy/owner consistent on a fresh document", () => {
    const doc = makeBaseDocument({ userId: "user_42" });

    expect(doc.userId).toBe("user_42");
    expect(doc.createdById).toBe("user_42");
    expect(doc.updatedById).toBe("user_42");
    expect(doc.tenantId).toBeTruthy();
  });

  it("picks a model matching the requested image provider", () => {
    const togetherJob = makeImageGenerationJobData({ provider: "together" });
    const falJob = makeImageGenerationJobData({ provider: "fal" });

    expect(togetherJob.model).toContain("FLUX");
    expect(falJob.model).toContain("fal-ai");
  });

  it("builds a presentation-generate request with a non-empty outline", () => {
    const request = makePresentationGenerateRequest();

    expect(request.outline.length).toBeGreaterThan(0);
    expect(request.language).toBe("en-US");
  });

  it("produces independent tenants and images per call", () => {
    const tenant = makeTenant();
    const image = makeGeneratedImage();

    expect(tenant.id).not.toBe(image.id);
    expect(image.url).toContain(image.id);
  });
});
