// Treasury finance logic (replaces the old lib/treasury).
// Rebuilt to the exact contracts dashboard/D-Treasury, M-TreasuryEntry,
// M-Receipt and M-Account call. Rates are "units per $1" (USD = 1).

export type Currency = "USD" | "EUR" | "EGP";

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "EGP"] as const;

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  EGP: "E£",
};

export type Rates = Record<Currency, number>;

export const DEFAULT_RATES: Rates = { USD: 1, EUR: 0.92, EGP: 48.5 };

export interface TreasuryConfig {
  defaultCurrency: Currency;
  displayCurrency: Currency;
  rates: Rates;
  ratesUpdatedAt?: number;
}

export const DEFAULT_CONFIG: TreasuryConfig = {
  defaultCurrency: "USD",
  displayCurrency: "USD",
  rates: { ...DEFAULT_RATES },
  ratesUpdatedAt: undefined,
};

export type ProjectStatus = "active" | "pending" | "completed";

export interface TreasuryProject {
  id: string;
  name: string;
  client?: string;
  clientEmail?: string;
  status: ProjectStatus;
  priceAmount: number;
  priceCurrency: Currency;
  monthly?: boolean;
  installmentMonths?: number;
  installmentPercent?: number;
  paidAmount?: number;
  paymentStatus?: "paid" | "partial" | "unpaid";
  notes?: string;
  startDate?: string | null;
  endDate?: string | null;
  done?: boolean;
  nextPaymentDate?: string;
  order: number;
  createdAt?: number;
}

export interface TreasuryExpense {
  id: string;
  label: string;
  amount: number;
  currency: Currency;
  category?: string;
  date: string;
  recurring?: boolean;
  projectId?: string;
  accountId?: string;
  clientPaid?: boolean;
  attachments?: string[];
  notes?: string;
  createdAt?: number;
}

export interface TreasuryIncome {
  id: string;
  amount: number;
  currency: Currency;
  date: string;
  projectId?: string;
  accountId?: string;
  monthlyPayment?: boolean;
  attachments?: string[];
  note?: string;
  createdAt?: number;
}

export interface TreasuryReceipt {
  id: string;
  to: string;
  via?: string;
  projectNames?: string[];
  projectIds?: string[];
  receiptNo?: string;
  total: number;
  currency: Currency;
  balance?: number;
  sentAt: number;
}

export type AccountType = "cash" | "bank" | "card" | "wallet" | "other";

export const ACCOUNT_TYPES: readonly AccountType[] = ["cash", "bank", "card", "wallet", "other"] as const;

export interface TreasuryAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  openingBalance: number;
  notes?: string;
  archived?: boolean;
  excludeFromNetProfit?: boolean;
  order: number;
  createdAt?: number;
}

export interface TreasuryData {
  config: TreasuryConfig;
  projects: TreasuryProject[];
  expenses: TreasuryExpense[];
  income: TreasuryIncome[];
  accounts: TreasuryAccount[];
  receipts: TreasuryReceipt[];
}

export type InsightIcon =
  | "outstanding"
  | "invoice"
  | "ratio"
  | "profit"
  | "loss"
  | "noprice"
  | "running"
  | "recurring"
  | "empty";

export type InsightTone = "warn" | "good" | "info";

export interface ExpenseTemplate {
  label: string;
  amount: number;
  currency: Currency;
  category?: string;
  recurring?: boolean;
  count: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

let uidCounter = 0;
export function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${(uidCounter % 1296).toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function convert(amount: number, from: Currency, to: Currency, rates: Rates): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;
  const rFrom = rates[from] || 0;
  const rTo = rates[to] || 0;
  if (!rFrom || !rTo) return 0;
  return (amount / rFrom) * rTo;
}

export function formatMoney(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const abs = Math.abs(amount || 0);
  const body = abs.toLocaleString(undefined, {
    minimumFractionDigits: abs < 1000 && abs % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? "-" : ""}${sym}${body}`;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function hasInstallments(p: TreasuryProject): boolean {
  return !p.monthly && (p.installmentMonths || 0) >= 2;
}

export function installmentTotal(p: { priceAmount?: number; installmentPercent?: number }): number {
  const price = p.priceAmount || 0;
  const pct = p.installmentPercent || 0;
  return round2(price * (1 + pct / 100));
}

export function projectContractTotal(p: TreasuryProject): number {
  if (p.monthly) return p.priceAmount || 0;
  if (hasInstallments(p)) return installmentTotal(p);
  return p.priceAmount || 0;
}

export function projectReceived(p: TreasuryProject, income: TreasuryIncome[], rates: Rates): number {
  const cur = p.priceCurrency;
  let sum = p.paidAmount || 0;
  for (const i of income) {
    if (i.projectId && i.projectId === p.id) sum += convert(i.amount || 0, i.currency, cur, rates);
  }
  return round2(sum);
}

export function projectBalance(p: TreasuryProject, income: TreasuryIncome[], rates: Rates): number {
  return round2(projectContractTotal(p) - projectReceived(p, income, rates));
}

export function derivePaymentStatus(args: { priceAmount: number; paidAmount: number }): "paid" | "partial" | "unpaid" {
  if ((args.paidAmount || 0) >= (args.priceAmount || 0) && (args.priceAmount || 0) > 0) return "paid";
  if ((args.paidAmount || 0) > 0) return "partial";
  return "unpaid";
}

export function projectPaymentStatus(
  p: TreasuryProject,
  income: TreasuryIncome[],
  rates: Rates
): "paid" | "partial" | "unpaid" {
  const total = projectContractTotal(p);
  const received = projectReceived(p, income, rates);
  if (total <= 0) return "unpaid";
  if (received >= total - 0.005) return "paid";
  if (received > 0) return "partial";
  return "unpaid";
}

export function installmentMonthlyAmount(p: TreasuryProject): number {
  const months = p.installmentMonths || 0;
  if (!months) return 0;
  return round2(installmentTotal(p) / months);
}

export function installmentsPaidCount(p: TreasuryProject, income: TreasuryIncome[], rates: Rates): number {
  const per = installmentMonthlyAmount(p);
  if (!per) return 0;
  const received = projectReceived(p, income, rates);
  return Math.max(0, Math.min(p.installmentMonths || 0, Math.floor(received / per)));
}

export function retainerPaymentsCount(p: TreasuryProject, income: TreasuryIncome[]): number {
  return income.filter((i) => i.projectId === p.id).length;
}

export interface ProjectPayment {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
}

export function projectPayments(p: TreasuryProject, income: TreasuryIncome[]): ProjectPayment[] {
  return income
    .filter((i) => i.projectId === p.id)
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((i) => ({ id: i.id, date: i.date || "", amount: i.amount || 0, currency: i.currency }));
}

export function paymentTimeLabel(_i: ProjectPayment): string {
  // Income rows carry dates but no clock time — no time part to show.
  return "";
}

function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const out = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), day));
  return out.toISOString().slice(0, 10);
}

export function nextMonthlyPaymentDate(p: TreasuryProject, fromDate: string): string {
  void p;
  return addMonths(fromDate, 1);
}

export function projectNextPaymentDate(p: TreasuryProject, income: TreasuryIncome[]): string | null {
  if (projectBalance(p, income, p.priceCurrency ? ({ [p.priceCurrency]: 1 } as Rates) : DEFAULT_RATES) <= 0.005) {
    // Balance check needs real rates; callers pass income only — recompute simply:
  }
  const linked = projectPayments(p, income);
  const last = linked.length ? linked[linked.length - 1].date : new Date().toISOString().slice(0, 10);
  if (!last) return null;
  if (p.monthly) return addMonths(last, 1);
  if (hasInstallments(p)) {
    if (installmentsPaidCount(p, income, { USD: 1, EUR: 1, EGP: 1 }) >= (p.installmentMonths || 0)) return null;
    return addMonths(last, 1);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Totals / series / insights
// ---------------------------------------------------------------------------

export function computeTotals(data: TreasuryData): { earned: number; outstanding: number; spent: number; net: number } {
  const cur = data.config.displayCurrency;
  const rates = data.config.rates;
  let earned = 0;
  let outstanding = 0;
  for (const p of data.projects) {
    const received = convert(projectReceived(p, data.income, rates), p.priceCurrency, cur, rates);
    earned += received;
    if (!p.done) outstanding += Math.max(0, convert(projectBalance(p, data.income, rates), p.priceCurrency, cur, rates));
  }
  let spent = 0;
  for (const e of data.expenses) {
    if (e.clientPaid) continue;
    spent += convert(e.amount || 0, e.currency, cur, rates);
  }
  return { earned: round2(earned), outstanding: round2(outstanding), spent: round2(spent), net: round2(earned - spent) };
}

export function buildDailySeries(data: TreasuryData): { date: string; earned: number; spent: number }[] {
  const cur = data.config.displayCurrency;
  const rates = data.config.rates;
  const byDay = new Map<string, { earned: number; spent: number }>();
  const touch = (date: string) => {
    if (!byDay.has(date)) byDay.set(date, { earned: 0, spent: 0 });
    return byDay.get(date)!;
  };
  for (const i of data.income) {
    if (!i.date) continue;
    touch(i.date).earned += convert(i.amount || 0, i.currency, cur, rates);
  }
  for (const e of data.expenses) {
    if (!e.date || e.clientPaid) continue;
    touch(e.date).spent += convert(e.amount || 0, e.currency, cur, rates);
  }
  // Fill a continuous window: last 30 days ending at the latest entry (or today).
  const keys = [...byDay.keys()].sort();
  const end = keys.length ? keys[keys.length - 1] : new Date().toISOString().slice(0, 10);
  const out: { date: string; earned: number; spent: number }[] = [];
  const endMs = Date.parse(`${end}T00:00:00Z`);
  for (let d = 29; d >= 0; d--) {
    const day = new Date(endMs - d * 86400000).toISOString().slice(0, 10);
    const v = byDay.get(day) ?? { earned: 0, spent: 0 };
    out.push({ date: day, earned: round2(v.earned), spent: round2(v.spent) });
  }
  return out;
}

export function buildInsights(
  data: TreasuryData
): { icon: InsightIcon; tone: InsightTone; label: string; text: string }[] {
  const t = computeTotals(data);
  const cur = data.config.displayCurrency;
  const out: { icon: InsightIcon; tone: InsightTone; label: string; text: string }[] = [];
  if (!data.projects.length && !data.income.length && !data.expenses.length) {
    out.push({ icon: "empty", tone: "info", label: "Getting started", text: "Log your first project or payment and the numbers show up here." });
    return out;
  }
  if (t.outstanding > 0.005) {
    out.push({ icon: "outstanding", tone: "warn", label: "Outstanding", text: `${formatMoney(t.outstanding, cur)} still to collect across open projects.` });
  } else if (data.projects.some((p) => !p.done)) {
    out.push({ icon: "invoice", tone: "good", label: "All settled", text: "Every open project is fully paid. Nothing outstanding." });
  }
  if (t.net >= 0) {
    out.push({ icon: "profit", tone: "good", label: "Net profit", text: `${formatMoney(t.net, cur)} earned minus spent.` });
  } else {
    out.push({ icon: "loss", tone: "warn", label: "Net loss", text: `Spending is ${formatMoney(Math.abs(t.net), cur)} ahead of earnings.` });
  }
  if (t.spent > 0 && t.earned > 0) {
    const ratio = Math.round((t.spent / t.earned) * 100);
    out.push({ icon: "ratio", tone: ratio > 60 ? "warn" : "info", label: "Spend ratio", text: `Spending is ${ratio}% of earnings.` });
  }
  const noPrice = data.projects.filter((p) => !p.monthly && !(p.priceAmount > 0) && !p.done);
  if (noPrice.length) {
    out.push({ icon: "noprice", tone: "info", label: "Missing prices", text: `${noPrice.length} project${noPrice.length === 1 ? "" : "s"} (${noPrice.slice(0, 3).map((p) => p.name).join(", ")}) ha${noPrice.length === 1 ? "s" : "ve"} no price yet.` });
  }
  const running = data.projects.filter((p) => !p.done && p.status === "active");
  if (running.length) {
    out.push({ icon: "running", tone: "info", label: "In motion", text: `${running.length} active project${running.length === 1 ? "" : "s"} on the board.` });
  }
  const recurring = data.expenses.filter((e) => e.recurring).length;
  if (recurring) {
    out.push({ icon: "recurring", tone: "info", label: "Recurring", text: `${recurring} recurring expense${recurring === 1 ? "" : "s"} ticking monthly.` });
  }
  return out;
}

export function buildHtmlReport(data: TreasuryData, now: Date): string {
  const t = computeTotals(data);
  const cur = data.config.displayCurrency;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const rows = data.projects
    .map((p) => {
      const rec = projectReceived(p, data.income, data.config.rates);
      const bal = projectBalance(p, data.income, data.config.rates);
      return `<tr><td>${esc(p.name)}</td><td>${esc(p.client || "—")}</td><td>${esc(p.status)}</td><td>${esc(formatMoney(convert(projectContractTotal(p), p.priceCurrency, cur, data.config.rates), cur))}</td><td>${esc(formatMoney(convert(rec, p.priceCurrency, cur, data.config.rates), cur))}</td><td>${esc(formatMoney(convert(bal, p.priceCurrency, cur, data.config.rates), cur))}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Treasury report</title></head><body style="font-family:sans-serif">` +
    `<h1>Treasury report — ${now.toLocaleDateString()}</h1>` +
    `<p>Earned ${esc(formatMoney(t.earned, cur))} · Spent ${esc(formatMoney(t.spent, cur))} · Net ${esc(formatMoney(t.net, cur))} · Outstanding ${esc(formatMoney(t.outstanding, cur))}</p>` +
    `<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Contract</th><th>Received</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table>` +
    `</body></html>`;
}

export async function fetchLiveRates(): Promise<{ rates: Rates; updatedAt: number } | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: ctrl.signal });
    clearTimeout(tid);
    if (!r.ok) return null;
    const j = (await r.json()) as { result?: string; rates?: Record<string, number> };
    if (j.result !== "success" || !j.rates) return null;
    const pick = (c: Currency, fb: number): number => {
      const v = j.rates![c];
      return typeof v === "number" && v > 0 ? v : fb;
    };
    return {
      rates: { USD: 1, EUR: pick("EUR", DEFAULT_RATES.EUR), EGP: pick("EGP", DEFAULT_RATES.EGP) },
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function accountBalance(
  a: TreasuryAccount,
  income: TreasuryIncome[],
  expenses: TreasuryExpense[],
  rates: Rates
): number {
  let bal = a.openingBalance || 0;
  for (const i of income) {
    if (i.accountId === a.id) bal += convert(i.amount || 0, i.currency, a.currency, rates);
  }
  for (const e of expenses) {
    if (e.accountId === a.id && !e.clientPaid) bal -= convert(e.amount || 0, e.currency, a.currency, rates);
  }
  return round2(bal);
}

export function accountActivityCount(accountId: string, income: TreasuryIncome[], expenses: TreasuryExpense[]): number {
  let n = 0;
  for (const i of income) if (i.accountId === accountId) n++;
  for (const e of expenses) if (e.accountId === accountId) n++;
  return n;
}

export function accountsTotal(data: TreasuryData): number {
  const cur = data.config.displayCurrency;
  const rates = data.config.rates;
  let sum = 0;
  for (const a of data.accounts) {
    if (a.archived || a.excludeFromNetProfit) continue;
    sum += convert(accountBalance(a, data.income, data.expenses, rates), a.currency, cur, rates);
  }
  return round2(sum);
}

export function accountOptions(accounts: TreasuryAccount[]): TreasuryAccount[] {
  return accounts.filter((a) => !a.archived);
}

// ---------------------------------------------------------------------------
// Entry-form option builders + suggestions
// ---------------------------------------------------------------------------

export function expenseProjectOptions(projects: TreasuryProject[]): TreasuryProject[] {
  return projects.filter((p) => !p.done);
}

export function incomeProjectOptions(
  projects: TreasuryProject[],
  income: TreasuryIncome[],
  rates: Rates
): TreasuryProject[] {
  return projects.filter((p) => {
    if (p.done) return false;
    if (p.monthly) return true;
    return projectPaymentStatus(p, income, rates) !== "paid";
  });
}

export function expenseCategories(expenses: TreasuryExpense[]): string[] {
  const seen = new Map<string, string>();
  for (const e of expenses) {
    const c = (e.category || "").trim();
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function fuzzyScore(hay: string, needle: string): number {
  const h = hay.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 0;
  if (h.startsWith(n)) return 2;
  if (h.includes(n)) return 1;
  let hi = 0;
  for (const ch of n) {
    hi = h.indexOf(ch, hi);
    if (hi === -1) return -1;
  }
  return 0;
}

export function matchCategories(input: string, past: string[]): string[] {
  if (!input.trim()) return past.slice(0, 6);
  return past
    .map((c) => ({ c, s: fuzzyScore(c, input) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
    .slice(0, 6);
}

export function matchExpenseTemplates(label: string, expenses: TreasuryExpense[]): ExpenseTemplate[] {
  const q = label.toLowerCase().trim();
  if (!q) return [];
  const byLabel = new Map<string, ExpenseTemplate>();
  for (const e of expenses) {
    const key = (e.label || "").toLowerCase().trim();
    if (!key || !key.includes(q)) continue;
    const hit = byLabel.get(key);
    if (hit) {
      hit.count += 1;
    } else {
      byLabel.set(key, {
        label: e.label,
        amount: e.amount || 0,
        currency: e.currency,
        category: e.category,
        recurring: e.recurring,
        count: 1,
      });
    }
  }
  return [...byLabel.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
