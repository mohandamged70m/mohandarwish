// LLM transport for the Spark assistant (replaces the old lib/llm).
//
// Same public API the copy-pasted Assistant.tsx calls:
//   chat / userMessage / toolResultMessage / getApiKey / setKeyOverride /
//   getModel / setModel / resolveProvider / listModels / PROVIDER_LABEL
//
// Two modes (old semantics kept):
//   1. Override key pasted in Spark settings -> direct browser calls.
//   2. Otherwise -> server proxy /api/dashboard/llm (holds LLM_API_KEY).
// Providers: OpenAI-compatible chat completions + Google Gemini native.

export type Provider = "openai" | "gemini";

export const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI",
  gemini: "Google",
};

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: string;
  output: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NativeMsg = any;

export interface ChatResult {
  assistant: NativeMsg;
  text: string;
  toolCalls: ToolCall[];
}

const KEY_LS = "spark_key_override";
const MODEL_LS = "spark_model";

function lsGet(k: string): string {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}

function lsSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore
  }
}

export function getApiKey(): string {
  return lsGet(KEY_LS);
}

export function setKeyOverride(key: string): void {
  lsSet(KEY_LS, key);
}

export function getModel(): string {
  return lsGet(MODEL_LS);
}

export function setModel(m: string): void {
  lsSet(MODEL_LS, m);
}

function detectProvider(key: string): Provider {
  if (key.startsWith("AIza") || key.startsWith("AQ.")) return "gemini";
  return "openai";
}

export async function resolveProvider(): Promise<Provider | null> {
  const key = getApiKey();
  if (key) return detectProvider(key);
  try {
    const r = await fetch("/api/dashboard/llm", { headers: adminHeaders() });
    const j = (await r.json()) as { provider?: Provider | null };
    return j.provider ?? null;
  } catch {
    return null;
  }
}

const FALLBACK_MODELS: Record<Provider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o"],
  gemini: ["gemini-2.5-flash", "gemini-3.6-flash"],
};

export async function listModels(): Promise<string[]> {
  const key = getApiKey();
  if (key) {
    const prov = detectProvider(key);
    try {
      if (prov === "openai") {
        const r = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (r.ok) {
          const j = (await r.json()) as { data?: { id: string }[] };
          const ids = (j.data ?? []).map((m) => m.id).filter((id) => /gpt|o1|o3|o4/i.test(id));
          if (ids.length) return ids.sort();
        }
      } else {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
        if (r.ok) {
          const j = (await r.json()) as { models?: { name: string }[] };
          const ids = (j.models ?? [])
            .map((m) => m.name.replace(/^models\//, ""))
            .filter((id) => /gemini/i.test(id));
          if (ids.length) return ids;
        }
      }
    } catch {
      // fall through to fallbacks
    }
    return FALLBACK_MODELS[prov];
  }
  try {
    const r = await fetch("/api/dashboard/llm?action=models", { headers: adminHeaders() });
    const j = (await r.json()) as { models?: string[] };
    if (Array.isArray(j.models) && j.models.length) return j.models;
  } catch {
    // ignore
  }
  return [];
}

// ---------------------------------------------------------------------------
// Tool schemas (mirror the 9 tools Assistant.tsx handles in execTool)
// ---------------------------------------------------------------------------

export const TOOL_SCHEMAS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: "navigate",
    description: "Switch the dashboard to another page.",
    parameters: {
      type: "object",
      properties: { page: { type: "string", description: "One of: projects, tags, trails, developer, treasury, settings, canary" } },
      required: ["page"],
    },
  },
  {
    name: "click",
    description: "Click the on-screen element whose visible label matches the text.",
    parameters: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "list_clickables",
    description: "List the labels of currently clickable on-screen elements.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "set_memory",
    description: "Persist memory: userName, standing instructions, or one fact to remember.",
    parameters: {
      type: "object",
      properties: {
        userName: { type: "string" },
        instructions: { type: "string" },
        addFact: { type: "string" },
      },
    },
  },
  {
    name: "read_data",
    description: "Read a Firestore-style path (even segments = document, odd = collection), e.g. Treasury/projects.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "read_screen",
    description: "Read the data backing the page the user is currently viewing.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "write_data",
    description: "Write a document at a path. Asks the user to confirm first unless auto mode.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        data: { type: "object" },
        merge: { type: "boolean" },
      },
      required: ["path", "data"],
    },
  },
  {
    name: "delete_data",
    description: "Delete the document at a path. Asks the user to confirm first unless auto mode.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "ask_user",
    description: "Ask the user a question with up to 6 options.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        allow_multiple: { type: "boolean" },
      },
      required: ["question", "options"],
    },
  },
];

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

export function userMessage(prov: Provider, text: string): NativeMsg {
  if (prov === "gemini") return { role: "user", parts: [{ text }] };
  return { role: "user", content: text };
}

export function toolResultMessage(prov: Provider, results: ToolResult[]): NativeMsg | NativeMsg[] {
  if (prov === "gemini") {
    return [
      {
        role: "user",
        parts: results.map((r) => ({ functionResponse: { name: r.name, response: { output: r.output } } })),
      },
    ];
  }
  return results.map((r) => ({ role: "tool", tool_call_id: r.id, content: r.output }));
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

function adminHeaders(): HeadersInit {
  try {
    return { "x-admin-token": localStorage.getItem("dashboard_token") ?? "" };
  } catch {
    return {};
  }
}

function openAiTools(): unknown[] {
  return TOOL_SCHEMAS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

async function chatDirectOpenAi(key: string, model: string, messages: NativeMsg[], system: string): Promise<ChatResult> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      tools: openAiTools(),
      tool_choice: "auto",
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`OpenAI error (${r.status}): ${t.slice(0, 200)}`);
  }
  const j = (await r.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
  };
  const msg = j.choices?.[0]?.message;
  if (!msg) throw new Error("Empty reply from model");
  const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
    } catch {
      args = {};
    }
    return { id: tc.id, name: tc.function.name, args };
  });
  return {
    assistant: { role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls ?? undefined },
    text: msg.content ?? "",
    toolCalls,
  };
}

async function chatDirectGemini(key: string, model: string, messages: NativeMsg[], system: string): Promise<ChatResult> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages,
        tools: [{ function_declarations: TOOL_SCHEMAS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
      }),
    }
  );
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Gemini error (${r.status}): ${t.slice(0, 200)}`);
  }
  const j = (await r.json()) as {
    candidates?: { content?: { parts?: ({ text?: string; functionCall?: { name: string; args: Record<string, unknown> } })[] } }[];
  };
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  const toolCalls: ToolCall[] = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({ id: `${p.functionCall!.name}-${Date.now()}-${i}`, name: p.functionCall!.name, args: p.functionCall!.args ?? {} }));
  return { assistant: { role: "model", parts }, text, toolCalls };
}

export async function chat(prov: Provider, model: string, messages: NativeMsg[], system: string): Promise<ChatResult> {
  const key = getApiKey();
  if (key) {
    const direct = detectProvider(key);
    if (direct === "gemini") return chatDirectGemini(key, model, messages, system);
    return chatDirectOpenAi(key, model, messages, system);
  }
  const r = await fetch("/api/dashboard/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ provider: prov, model, messages, system }),
  });
  const j = (await r.json().catch(() => ({}))) as ChatResult & { error?: string };
  if (!r.ok) throw new Error(j.error || `Assistant proxy failed (${r.status})`);
  return { assistant: j.assistant, text: j.text ?? "", toolCalls: j.toolCalls ?? [] };
}
