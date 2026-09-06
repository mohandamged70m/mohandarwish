// Firebase-auth compatible shim over the NextAuth dashboard session.
//
// The dashboard components were written against Firebase Auth. The dashboard
// now logs in with email+password via NextAuth (see lib/auth.ts); this module
// lets the copy-pasted components keep calling onAuthStateChanged(appAuth(), cb)
// unchanged — the session is verified against NextAuth's session endpoint.

export interface DashUser {
  uid: string;
  email: string | null;
}

export function appAuth(): { __dash: true } {
  return { __dash: true };
}

async function verifySession(): Promise<DashUser | null> {
  try {
    const r = await fetch("/api/auth/session");
    if (!r.ok) return null;
    const s = (await r.json()) as { user?: { email?: string } };
    if (!s?.user) return null;
    return { uid: "admin", email: s.user.email ?? null };
  } catch {
    return null;
  }
}

export function onAuthStateChanged(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _auth: unknown,
  cb: (user: DashUser | null) => void
): () => void {
  let alive = true;
  verifySession().then((user) => {
    if (!alive) return;
    cb(user);
  });
  // Re-verify when the tab regains focus (login/logout in another tab).
  const onFocus = () => {
    verifySession().then((user) => {
      if (!alive) return;
      cb(user);
    });
  };
  window.addEventListener("focus", onFocus);
  return () => {
    alive = false;
    window.removeEventListener("focus", onFocus);
  };
}
