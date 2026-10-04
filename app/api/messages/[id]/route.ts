import { NextResponse } from "next/server";
import { convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

function checkAuth(req: Request): boolean {
  const t = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("admin");
  return !!process.env.ADMIN_TOKEN && t === process.env.ADMIN_TOKEN;
}
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await convexMutation(api.messages.remove, { id });
  return NextResponse.json({ ok: true });
}
