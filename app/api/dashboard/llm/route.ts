import { NextResponse } from "next/server";
import { TOOL_SCHEMAS, type Provider } from "@/lib/llm";
import { isAdminRequest } from "@/lib/dash-admin";

// Server proxy for Spark (holds LLM_API_KEY so it never ships to the bundle).
// Env: LLM_API_KEY (required), LLM_PROVIDER=openai|gemini (auto-detected from
// key prefix when unset), LLM_MODEL (default per provider).

function serverProvider(): Provider | null {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const env = process.env.LLM_PROVIDER;
  if (env === "gemini" || env === "openai") return env;
  return key.startsWith("AIza") ? "gemini" : "openai";
}

function defaultModel(prov: Provider): string {
  const env = process.env.LLM_MODEL;
  if (env) return env;
  return prov === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini";
}

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prov = serverProvider();
  const url = new URL(req.url);
  if (url.searchParams.get("action") === "models") {
    if (!prov) return NextResponse.json({ models: [] });
    const key = process.env.LLM_API_KEY!;
    try {
      if (prov === "openai") {
        const r = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        const j = (await r.json()) as { data?: { id: string }[] };
        const ids = (j.data ?? []).map((m) => m.id).filter((id) => /gpt|o1|o3|o4/i.test(id)).sort();
        return NextResponse.json({ models: ids.length ? ids : ["gpt-4o-mini", "gpt-4o"] });
      }
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
      );
      const j = (await r.json()) as { models?: { name: string }[] };
      const ids = (j.models ?? [])
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((id) => /gemini/i.test(id));
      return NextResponse.json({ models: ids.length ? ids : ["gemini-2.0-flash"] });
    } catch {
      return NextResponse.json({ models: [] });
    }
  }
  return NextResponse.json({ provider: prov });
}

type Body = {
  provider?: Provider;
  model?: string;
  messages?: unknown[];
  system?: string;
};

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prov = serverProvider();
  const key = process.env.LLM_API_KEY;
  if (!prov || !key) {
    return NextResponse.json(
      { error: "Spark isn't configured on the server (set LLM_API_KEY) — paste a key in Spark settings instead." },
      { status: 503 }
    );
  }
  const body = (await req.json().catch(() => null)) as Body | null;
  const model = body?.model || defaultModel(prov);
  const messages = body?.messages ?? [];
  const system = body?.system ?? "You are Spark, a dashboard copilot.";

  try {
    if (prov === "gemini") {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: messages,
            tools: [
              {
                function_declarations: TOOL_SCHEMAS.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                })),
              },
            ],
          }),
        }
      );
      if (!r.ok) return NextResponse.json({ error: `Gemini error (${r.status})` }, { status: 502 });
      const j = (await r.json()) as {
        candidates?: { content?: { parts?: ({ text?: string; functionCall?: { name: string; args: Record<string, unknown> } })[] } }[];
      };
      const parts = j.candidates?.[0]?.content?.parts ?? [];
      return NextResponse.json({
        assistant: { role: "model", parts },
        text: parts.map((p) => p.text ?? "").join(""),
        toolCalls: parts
          .filter((p) => p.functionCall)
          .map((p, i) => ({
            id: `${p.functionCall!.name}-${Date.now()}-${i}`,
            name: p.functionCall!.name,
            args: p.functionCall!.args ?? {},
          })),
      });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...messages],
        tools: TOOL_SCHEMAS.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        tool_choice: "auto",
      }),
    });
    if (!r.ok) return NextResponse.json({ error: `OpenAI error (${r.status})` }, { status: 502 });
    const j = (await r.json()) as {
      choices?: {
        message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
      }[];
    };
    const msg = j.choices?.[0]?.message;
    if (!msg) return NextResponse.json({ error: "Empty reply from model" }, { status: 502 });
    return NextResponse.json({
      assistant: { role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls ?? undefined },
      text: msg.content ?? "",
      toolCalls: (msg.tool_calls ?? []).map((tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        return { id: tc.id, name: tc.function.name, args };
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "LLM call failed" }, { status: 502 });
  }
}
