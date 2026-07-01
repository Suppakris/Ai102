// ─────────────────────────────────────────────────────────────
// AUTH DISABLED — college project.
//
// This app normally gates every route/action behind NextAuth +
// Google OAuth. For coursework we don't want a login wall, so this
// module is stubbed to always return a single fixed "demo" admin
// user. No Google, no sign-in screen, no NEXTAUTH_* env vars needed.
//
// `auth()` is called server-side (routes, server actions); `handlers`
// backs GET/POST /api/auth/* so the client `useSession()` also sees
// the demo user. To restore real auth, revert this file (see git
// history) and set the Google/NEXTAUTH env vars again.
// ─────────────────────────────────────────────────────────────
import { db } from "@/server/db";
import { type DefaultSession, type Session } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      hasAccess: boolean;
      location?: string;
      role: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    hasAccess: boolean;
    role: string;
  }
}

// Fixed identity every request runs as. Admin + hasAccess so all
// features (including admin-only ones) are unlocked.
export const DEMO_USER_ID = "demo-user";

const demoSession: Session = {
  user: {
    id: DEMO_USER_ID,
    name: "Demo User",
    email: "demo@ai102.local",
    image: null,
    role: "ADMIN",
    isAdmin: true,
    hasAccess: true,
  },
  // 30 days out — client useSession treats it as a live session.
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

// The demo user must exist as a real DB row, otherwise anything that
// foreign-keys to userId (presentations, documents) fails to insert.
// Idempotent, and guarded so it only runs once per server instance.
let ensured = false;
async function ensureDemoUser(): Promise<void> {
  if (ensured) return;
  try {
    await db.user.upsert({
      where: { id: DEMO_USER_ID },
      update: {},
      create: {
        id: DEMO_USER_ID,
        name: "Demo User",
        email: "demo@ai102.local",
        role: "ADMIN",
        hasAccess: true,
      },
    });
    ensured = true;
  } catch (error) {
    // Never let auth() throw (e.g. DB unreachable at build time) — the
    // real DB operations downstream will surface any genuine problem.
    console.warn("[auth-stub] could not ensure demo user:", error);
  }
}

/** Always returns the demo session. Never null. */
export async function auth(): Promise<Session> {
  await ensureDemoUser();
  return demoSession;
}

// Serve the demo session at /api/auth/* so next-auth/react's
// SessionProvider / useSession() report the user as signed in.
const sessionJson = () => Response.json(demoSession);
export const handlers = {
  GET: async () => sessionJson(),
  POST: async () => sessionJson(),
};

// Kept as harmless no-ops in case anything imports them.
export async function signIn(): Promise<Session> {
  return demoSession;
}
export async function signOut(): Promise<{ url: string }> {
  return { url: "/" };
}
