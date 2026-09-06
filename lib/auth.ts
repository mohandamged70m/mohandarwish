import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

function dashboardEmail(): string {
  return (process.env.DASHBOARD_EMAIL || process.env.OWNER_EMAIL || "").trim().toLowerCase();
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Dashboard",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").trim().toLowerCase();
        const password = credentials?.password || "";
        const wantEmail = dashboardEmail();
        const wantHash = process.env.DASHBOARD_PASSWORD_HASH || "";
        if (!email || !password || !wantEmail || !wantHash) return null;
        if (email !== wantEmail) return null;
        try {
          const ok = await bcrypt.compare(password, wantHash);
          if (!ok) return null;
        } catch {
          return null;
        }
        return { id: "admin", email: wantEmail };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/dashboard" },
};
