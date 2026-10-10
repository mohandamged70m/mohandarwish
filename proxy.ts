import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin";

// Defense-in-depth for dashboard APIs: the Auth.js owner session is re-checked
// here before route handlers run. Handlers enforce ownership again themselves,
// so this layer can never accidentally grant access.
export async function proxy(req: NextRequest) {
  return (await isAdminRequest(req))
    ? NextResponse.next()
    : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
export const config = { matcher: ["/api/dashboard/:path*"] };
