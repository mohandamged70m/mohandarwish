import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type {} from "next-auth/jwt";
import { isOwnerEmail } from "@/lib/owner";

// Owner-only authentication (Auth.js v5). Only the Google account whose
// verified email matches DASHBOARD_OWNER_EMAIL may establish a session.
// Every private page and API route re-checks ownership via auth()/isAdminRequest,
// so this signIn gate is the front door, not the only lock.

function googleEmailVerified(
  profile: unknown,
): { email: string; verified: boolean } {
  if (!profile || typeof profile !== "object") return { email: "", verified: false };
  const p = profile as Record<string, unknown>;
  return {
    email: typeof p.email === "string" ? p.email : "",
    verified: p.email_verified === true,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required in production; `npx auth secret` generates a value for AUTH_SECRET.
  secret: process.env.AUTH_SECRET,
  // Vercel and other proxies terminate TLS before Next.js; trust their host headers.
  trustHost: true,
  session: {
    // Same lifetime the HMAC owner_session cookie had: 24 hours.
    maxAge: 24 * 60 * 60,
  },
  pages: {
    // No framework sign-in form: the dashboard renders its own Google button.
    // Denied Google accounts land back on /dashboard?error=AccessDenied so the
    // owner UI can explain what happened in the site's own design.
    signIn: "/dashboard",
    error: "/dashboard",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const claimed = user?.email || googleEmailVerified(profile).email;
      const { verified } = googleEmailVerified(profile);
      // Require Google's verified-email claim in addition to the address match.
      return isOwnerEmail(claimed, verified || undefined);
    },
    async jwt({ token, profile }) {
      if (profile) {
        const { email, verified } = googleEmailVerified(profile);
        token.isOwner = isOwnerEmail(email || token.email, verified || undefined);
      } else if (typeof token.email === "string") {
        // Re-check the configured owner address on every JWT use so rotating
        // DASHBOARD_OWNER_EMAIL revokes stale sessions on next refresh.
        token.isOwner = isOwnerEmail(token.email, true);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.isOwner = token.isOwner === true;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** True only for the configured owner Gmail account. */
      isOwner?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isOwner?: boolean;
  }
}
