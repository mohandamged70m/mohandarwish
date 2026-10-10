// Compatibility interface backed by the signed owner session.

export interface DashUser {
  uid: string;
  email: string | null;
}

export function appAuth(): { __dash: true } {
  return { __dash: true };
}

async function verifyToken(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/owner", { cache: "no-store" });
    const b = await r.json();
    return b.authenticated === true;
  } catch {
    return false;
  }
}

export function onAuthStateChanged(
  _auth: unknown,
  cb: (user: DashUser | null) => void,
): () => void {
  let alive = true;
  verifyToken().then((ok) => {
    if (!alive) return;
    cb(ok ? { uid: "admin", email: null } : null);
  });
  const onStorage = (e: StorageEvent) => {
    if (e.key !== "owner_signed_in") return;
    verifyToken().then((ok) => {
      if (!alive) return;
      cb(ok ? { uid: "admin", email: null } : null);
    });
  };
  window.addEventListener("storage", onStorage);
  return () => {
    alive = false;
    window.removeEventListener("storage", onStorage);
  };
}
