import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin";
export function proxy(req: NextRequest) {
  return isAdminRequest(req)
    ? NextResponse.next()
    : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
export const config = { matcher: ["/api/dashboard/:path*"] };
