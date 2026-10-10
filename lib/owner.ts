import "server-only";

// Single owner check for every private page, API route, upload and dashboard
// operation. The allowed address lives only in the server-only
// DASHBOARD_OWNER_EMAIL variable and is re-read on each call, so rotating the
// variable takes effect without a redeploy of this module's callers.

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function ownerEmailConfigured(): boolean {
  return normalizeEmail(process.env.DASHBOARD_OWNER_EMAIL) !== "";
}

/**
 * True only when the complete address matches DASHBOARD_OWNER_EMAIL
 * (case-insensitive) and Google verified the address. Anything else —
 * missing config, missing address, unverified claim — is denied.
 */
export function isOwnerEmail(
  email: unknown,
  emailVerified?: boolean,
): boolean {
  if (emailVerified !== true) return false;
  const configured = normalizeEmail(process.env.DASHBOARD_OWNER_EMAIL);
  if (!configured) return false;
  const candidate = normalizeEmail(email);
  return candidate !== "" && candidate === configured;
}

export interface OwnerSessionUser {
  email?: string | null;
  isOwner?: boolean;
}

/** Session-level check for already-authenticated requests (JWT flag + address). */
export function isOwnerSession(
  session: { user?: OwnerSessionUser | null } | null | undefined,
): boolean {
  if (!session?.user) return false;
  if (session.user.isOwner !== true) return false;
  // Belt and braces: the JWT flag alone is not enough; the address must still
  // match the currently configured owner email (verified at sign-in time).
  return isOwnerEmail(session.user.email, true);
}
