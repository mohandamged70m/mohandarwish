import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Public page-view ping (feeds Trails: Analytics/Days/Items, Totals,
// Sessions/Items capped at 300, Sources/Items). No PII is stored.

const MAX_SESSIONS = 300;

type Body = {
  path?: string;
  referrer?: string;
  screen?: string;
  viewport?: string;
  language?: string;
};

async function readDoc(supabase: ReturnType<typeof supabaseServer>, path: string) {
  const { data } = await supabase.from("dashboard_docs").select("data").eq("path", path).maybeSingle();
  return ((data?.data as Record<string, unknown>) ?? {}) as Record<string, unknown>;
}

async function writeDoc(supabase: ReturnType<typeof supabaseServer>, path: string, data: Record<string, unknown>) {
  await supabase.from("dashboard_docs").upsert(
    { path, data, updated_at: new Date().toISOString() },
    { onConflict: "path" }
  );
}

function sourceKind(host: string): string {
  const h = host.toLowerCase();
  if (/google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|brave/.test(h)) return "search";
  if (/x\.com|twitter|linkedin|github|facebook|instagram|tiktok|reddit|youtube|medium|dev\.to|producthunt/.test(h))
    return "social";
  if (/mail|newsletter|substack/.test(h)) return "mail";
  if (/chatgpt|claude|perplexity|gemini|bard|copilot|grok/.test(h)) return "ai";
  return "referral";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const path = typeof body.path === "string" && body.path ? body.path.slice(0, 200) : "/";
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);

  try {
    const supabase = supabaseServer();

    // Day bucket
    const dayDoc = await readDoc(supabase, `Analytics/Days/Items/${day}`);
    await writeDoc(supabase, `Analytics/Days/Items/${day}`, {
      ...dayDoc,
      Sessions: Number(dayDoc.Sessions || 0) + 1,
    });

    // Totals
    const totals = await readDoc(supabase, "Analytics/Totals");
    await writeDoc(supabase, "Analytics/Totals", {
      ...totals,
      Sessions: Number(totals.Sessions || 0) + 1,
      Visitors: Number(totals.Visitors || 0) + 1,
    });

    // Session row (minimal visit story; detail accumulates only via dashboard edits)
    const id = `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await writeDoc(supabase, `Analytics/Sessions/Items/${id}`, {
      StartedAt: now,
      LastSeenAt: now,
      Ended: true,
      ActiveMs: 0,
      Visit: 1,
      Entry: { Ref: body.referrer || "Direct", Section: path },
      Device: {
        Screen: body.screen || "",
        Viewport: body.viewport || "",
        Language: body.language || "",
      },
      Sections: { [path]: 1 },
    });

    // Trim sessions to the newest MAX_SESSIONS
    const { data: rows } = await supabase
      .from("dashboard_docs")
      .select("path,data")
      .like("path", "Analytics/Sessions/Items/%")
      .limit(2000);
    const list = ((rows ?? []) as { path: string; data: Record<string, unknown> }[]).sort(
      (a, b) => Number(b.data?.StartedAt || 0) - Number(a.data?.StartedAt || 0)
    );
    const extra = list.slice(MAX_SESSIONS);
    for (let i = 0; i < extra.length; i += 50) {
      const chunk = extra.slice(i, i + 50).map((r) => r.path);
      if (chunk.length) await supabase.from("dashboard_docs").delete().in("path", chunk);
    }

    // Source bucket
    let host = "";
    try {
      host = body.referrer ? new URL(body.referrer).hostname.replace(/^www\./, "") : "";
    } catch {
      host = "";
    }
    const srcId = host || "direct";
    const src = await readDoc(supabase, `Analytics/Sources/Items/${srcId}`);
    await writeDoc(supabase, `Analytics/Sources/Items/${srcId}`, {
      ...src,
      Name: host || "Direct",
      Kind: host ? sourceKind(host) : "direct",
      Sessions: Number(src.Sessions || 0) + 1,
      LastAt: now,
    });
  } catch {
    // tracking must never break the page
  }
  return NextResponse.json({ ok: true });
}
