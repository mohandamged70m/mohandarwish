import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Admin guard for API routes. Accepts EITHER:
//   1. a valid NextAuth dashboard session (email+password login), or
//   2. the legacy ADMIN_TOKEN (header or ?admin=), kept for scripts/curl.
// Dashboard browser calls ride on the session cookie automatically.
export async function isAdminRequest(req: Request): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) return true;
  } catch {
    // fall through to token check
  }
  const token =
    req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("admin");
  return !!process.env.ADMIN_TOKEN && !!token && token === process.env.ADMIN_TOKEN;
}
