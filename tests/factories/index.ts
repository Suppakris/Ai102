// Mock payload generators shared by unit and E2E tests. Each factory returns
// a realistic, self-contained object for one domain shape used across the
// app (Prisma rows, queue job payloads, API request bodies) with sane
// defaults and an `overrides` escape hatch — so a test only has to spell out
// the one or two fields it actually cares about.
let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeUser(overrides: Partial<{
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  hasAccess: boolean;
}> = {}) {
  const id = overrides.id ?? nextId("user");
  return {
    id,
    name: overrides.name ?? `Test User ${id}`,
    email: overrides.email ?? `${id}@example.test`,
    role: overrides.role ?? "USER",
    hasAccess: overrides.hasAccess ?? true,
  };
}

export function makeSession(overrides: Partial<{
  userId: string;
  isAdmin: boolean;
  role: "ADMIN" | "USER";
}> = {}) {
  const userId = overrides.userId ?? nextId("user");
  const role = overrides.role ?? "USER";
  return {
    user: {
      id: userId,
      name: `Test User ${userId}`,
      email: `${userId}@example.test`,
      image: null,
      hasAccess: true,
      role,
      isAdmin: overrides.isAdmin ?? role === "ADMIN",
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function makeTenant(overrides: Partial<{
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
}> = {}) {
  const id = overrides.id ?? nextId("tenant");
  return {
    id,
    name: overrides.name ?? "Personal",
    slug: overrides.slug ?? `personal-${id}`,
    isPersonal: overrides.isPersonal ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function makeBaseDocument(overrides: Partial<{
  id: string;
  title: string;
  type: "PRESENTATION" | "NOTE" | "DOCUMENT";
  userId: string;
  tenantId: string;
  isPublic: boolean;
}> = {}) {
  const id = overrides.id ?? nextId("doc");
  const userId = overrides.userId ?? nextId("user");
  return {
    id,
    title: overrides.title ?? `Untitled ${id}`,
    type: overrides.type ?? "PRESENTATION",
    documentType: "presentation",
    userId,
    tenantId: overrides.tenantId ?? nextId("tenant"),
    createdById: userId,
    updatedById: userId,
    thumbnailUrl: null,
    isPublic: overrides.isPublic ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function makeGeneratedImage(overrides: Partial<{
  id: string;
  url: string;
  prompt: string;
  userId: string;
}> = {}) {
  const id = overrides.id ?? nextId("image");
  return {
    id,
    url: overrides.url ?? `https://images.example.test/${id}.png`,
    prompt: overrides.prompt ?? "a scenic mountain landscape at sunset",
    userId: overrides.userId ?? nextId("user"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function makeImageGenerationJobData(overrides: Partial<{
  provider: "together" | "fal";
  prompt: string;
  model: string;
  userId: string;
}> = {}) {
  const provider = overrides.provider ?? "together";
  return {
    provider,
    prompt: overrides.prompt ?? "a minimalist product photo on a white background",
    model:
      overrides.model ??
      (provider === "together"
        ? "black-forest-labs/FLUX.1-schnell-Free"
        : "fal-ai/flux-2/flash"),
    userId: overrides.userId ?? nextId("user"),
  };
}

// Matches the SlidesRequest shape POSTed to /api/presentation/generate.
export function makePresentationGenerateRequest(overrides: Partial<{
  title: string;
  outline: string[];
  language: string;
  presentationId: string;
}> = {}) {
  return {
    title: overrides.title ?? "Test Presentation",
    outline: overrides.outline ?? [
      "## Introduction\nWhy this topic matters",
      "## Key Point\nThe main argument",
      "## Conclusion\nWrap-up and next steps",
    ],
    language: overrides.language ?? "en-US",
    presentationId: overrides.presentationId ?? nextId("doc"),
  };
}
