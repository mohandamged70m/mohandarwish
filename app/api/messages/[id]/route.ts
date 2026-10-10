import { isAdminRequest } from "@/lib/admin";
import { NextResponse } from "next/server";
import { convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

const checkAuth = isAdminRequest;
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await convexMutation(api.messages.remove, { id });
  return NextResponse.json({ ok: true });
}
