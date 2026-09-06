import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function allowedEmail(): string {
  return (process.env.DASHBOARD_EMAIL || process.env.OWNER_EMAIL || "").trim().toLowerCase();
}

const googleId = process.env.GOOGLE_CLIENT_ID || "";
const googleSecret = process.env.GOOGLE_CLIENT_SECRET || "";

export const authOptions: NextAuthOptions = {
  providers: [
    ...(googleId && googleSecret
      ? [GoogleProvider({ clientId: googleId, clientSecret: googleSecret })]
      : []),
  ],
  callbacks: {
    // Only the owner Google account may sign in — everyone else is rejected.
    async signIn({ profile }) {
      const email = ((profile as { email?: string } | null)?.email || "").toLowerCase();
      const want = allowedEmail();
      return !!email && !!want && email === want;
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/dashboard" },
};
