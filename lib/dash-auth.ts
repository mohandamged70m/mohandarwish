// Firebase-auth compatible shim over the ADMIN_TOKEN session.
//
// The old dashboard gated everything on Firebase Auth. Here the dashboard page
// verifies ADMIN_TOKEN against /api/booking; this module lets the copy-pasted
// components keep calling onAuthStateChanged(appAuth(), cb) unchanged.

export interface DashUser {
  uid: string;
  email: string | null;
}

export function appAuth(): { __dash: true } {
  return { __dash: true };
}

async function verifyToken(): Promise<boolean> {
  try {
    const saved = localStorage.getItem("dashboard_token") ?? "";
    const cookie = document.cookie.match(/(?:^|;\s*)dashboard_token=([^;]+)/)?.[1] ?? "";
    const token = saved || (cookie ? decodeURIComponent(cookie) : "");
    if (!token) return false;
    const r = await fetch("/api/booking", { headers: { "x-admin-token": token } });
    return r.ok;
  } catch {
    return false;
  }
}

export function onAuthStateChanged(
  _auth: unknown,
  cb: (user: DashUser | null) => void
): () => void {
  let alive = true;
  verifyToken().then((ok) => {
    if (!alive) return;
    cb(ok ? { uid: "admin", email: null } : null);
  });
  const onStorage = (e: StorageEvent) => {
    if (e.key !== "dashboard_token") return;
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
