"use client";

/**
 * One-time bridge from the original portfolio treasury shape to the newer
 * one-entry-per-document shape. The old dashboard kept all rows inside six
 * map-style docs (`Treasury/projects` -> `{ entries: {...} }`); the newer tabs
 * listen to collections like `TreasuryProjects`. Copy once, only where the new
 * collection is empty, so existing entries are never overwritten.
 */
import { dataCall } from "@/lib/dash-transport";

const KEY = "dash.treasury.v2-migrated";

const PAIRS = [
  { legacy: "Treasury/projects", target: "TreasuryProjects" },
  { legacy: "Treasury/income", target: "TreasuryIncome" },
  { legacy: "Treasury/spendings", target: "TreasurySpendings" },
  { legacy: "Treasury/accounts", target: "TreasuryAccounts" },
  { legacy: "Treasury/receipts", target: "TreasuryReceipts" },
] as const;

export async function migrateLegacyTreasury(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(KEY) === "1") return;
  } catch {
    /* storage blocked: still try the (idempotent) migration below */
  }

  try {
    for (const { legacy, target } of PAIRS) {
      const existing = await dataCall<{ path: string }[]>("listCollection", {
        prefix: target,
      });
      if (Array.isArray(existing) && existing.length > 0) continue;

      const doc = await dataCall<{ entries?: Record<string, unknown> } | null>(
        "getDoc",
        { path: legacy },
      );
      const entries = doc?.entries;
      if (!entries || typeof entries !== "object") continue;

      const ops = Object.entries(entries)
        .slice(0, 500)
        .map(([id, value]) => ({
          type: "set" as const,
          path: `${target}/${id}`,
          data:
            value && typeof value === "object" && !Array.isArray(value)
              ? (value as Record<string, unknown>)
              : {},
        }));
      if (ops.length) await dataCall("batch", { ops });
    }
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* private mode: the empty-target check keeps this idempotent anyway */
    }
  } catch {
    // Best effort: a fresh treasury is usable even if there is nothing to copy.
  }
}
