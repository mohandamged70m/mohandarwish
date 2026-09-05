// Receipt/invoice builder (replaces the old lib/receipt).

import type { Currency } from "./treasury";
import { CURRENCY_SYMBOL } from "./treasury";

export interface ReceiptLine {
  name: string;
  note?: string;
  price: number;
  paid: number;
  balance: number | null;
}

export interface ReceiptPaymentRow {
  dateLabel: string;
  amount: number;
  note?: string;
}

export interface ReceiptData {
  receiptNo: string;
  dateLabel: string;
  customerName?: string;
  customerEmail?: string;
  currency: Currency;
  lines: ReceiptLine[];
  totals: { price: number; paid: number; balance: number };
  note?: string;
  converted?: boolean;
  perPayment?: boolean;
  kind: "paid" | "due";
  paidOnLabel?: string;
  dueByLabel?: string;
  payments?: ReceiptPaymentRow[];
}

export function receiptNumber(): string {
  const d = new Date();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `R-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${rand}`;
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(n: number, cur: Currency): string {
  return `${CURRENCY_SYMBOL[cur] ?? cur}${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildReceiptHtml(data: ReceiptData): string {
  const title = data.kind === "due" ? "Payment request" : "Receipt";
  const lineRows = data.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px;border:1px solid #e2e8f0">${esc(l.name)}${l.note ? `<div style="font-size:12px;color:#64748b">${esc(l.note)}</div>` : ""}</td>` +
        `<td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${esc(money(l.price, data.currency))}</td>` +
        `<td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${esc(money(l.paid, data.currency))}</td>` +
        `<td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${l.balance === null ? "—" : esc(money(l.balance, data.currency))}</td></tr>`
    )
    .join("");
  const payRows = (data.payments ?? [])
    .map(
      (p) =>
        `<tr><td style="padding:8px;border:1px solid #e2e8f0">${esc(p.dateLabel)}${p.note ? ` — ${esc(p.note)}` : ""}</td>` +
        `<td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${esc(money(p.amount, data.currency))}</td></tr>`
    )
    .join("");
  return (
    `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;color:#0f172a;max-width:640px;margin:0 auto;padding:24px">` +
    `<h1 style="font-size:22px">${esc(title)} ${esc(data.receiptNo)}</h1>` +
    `<p style="color:#64748b">${esc(data.dateLabel)}${data.customerName ? ` · ${esc(data.customerName)}` : ""}${data.customerEmail ? ` · ${esc(data.customerEmail)}` : ""}</p>` +
    (data.paidOnLabel ? `<p>Paid on: ${esc(data.paidOnLabel)}</p>` : "") +
    (data.dueByLabel ? `<p>Due by: ${esc(data.dueByLabel)}</p>` : "") +
    `<table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr>` +
    `<th style="text-align:left;padding:8px;border:1px solid #e2e8f0">Item</th><th style="padding:8px;border:1px solid #e2e8f0">Price</th><th style="padding:8px;border:1px solid #e2e8f0">Paid</th><th style="padding:8px;border:1px solid #e2e8f0">Balance</th>` +
    `</tr></thead><tbody>${lineRows}</tbody></table>` +
    `<p style="text-align:right;font-size:16px">Total: <strong>${esc(money(data.totals.price, data.currency))}</strong> · Paid: <strong>${esc(money(data.totals.paid, data.currency))}</strong> · Balance: <strong>${esc(money(data.totals.balance, data.currency))}</strong></p>` +
    (payRows ? `<h3>Payments</h3><table style="width:100%;border-collapse:collapse"><tbody>${payRows}</tbody></table>` : "") +
    (data.note ? `<p style="margin-top:12px;white-space:pre-wrap">${esc(data.note)}</p>` : "") +
    `<p style="margin-top:24px;color:#64748b">— Mohand Darwish</p></body></html>`
  );
}
