import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin';
import { convexQuery } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

export const dynamic = 'force-dynamic';

// Owner-only, read-only. Never creates test visits or exposes secret values.
export async function GET(req: Request) {
  if (!(await isAdminRequest(req)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const checks = {
    url: !!process.env.NEXT_PUBLIC_CONVEX_URL,
    serverKey: !!process.env.CONVEX_SERVER_KEY,
    notifications: !!process.env.OWNER_EMAIL && !!process.env.RESEND_API_KEY,
  };
  const respond = (data: Record<string, unknown>) => NextResponse.json(
    { ...data, checks }, { headers: { 'Cache-Control': 'no-store' } },
  );
  if (!checks.url) return respond({ ok: false, message: 'Set NEXT_PUBLIC_CONVEX_URL in the site environment, then redeploy.' });
  if (!checks.serverKey) return respond({ ok: false, message: 'Set CONVEX_SERVER_KEY to the same value in the site and Convex environments, then redeploy.' });
  try {
    const [health, totals] = await Promise.all([
      convexQuery<Record<string, unknown>>(api.trails.diagnostics, {}),
      convexQuery<Record<string, unknown>>(api.docs.getDoc, { path: 'Analytics/Totals' }),
    ]);
    if (!health) throw new Error('Unavailable');
    return respond({
      ok: true,
      message: 'Visit storage connected',
      visits: Number((health.totals as Record<string, unknown> | undefined)?.Sessions) || 0,
      retained: Number(health.sessions) || 0,
      lastVisitAt: Number(totals?.LastAt) || 0,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : '';
    const message = /Unauthorized|serverKey/i.test(error)
      ? 'Check that CONVEX_SERVER_KEY matches in the site and Convex environments.'
      : /Could not find|not found|not a registered|does not exist/i.test(error)
        ? 'Deploy the current Convex functions to the same deployment as NEXT_PUBLIC_CONVEX_URL.'
        : 'Could not reach visit storage. Check the Convex deployment and try again.';
    return respond({ ok: false, message });
  }
}
