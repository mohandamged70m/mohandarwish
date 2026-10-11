import { api } from '@/convex/_generated/api';
import { convexQuery } from '@/lib/convex';
import { linkOpenedHtml } from '@/lib/email';
import { siteConfig } from '@/lib/metadata';

type Dict = Record<string, unknown>;
const object = (value: unknown): Dict => value && typeof value === 'object' && !Array.isArray(value) ? value as Dict : {};
const text = (value: unknown, max = 120) => typeof value === 'string' ? value.slice(0, max) : '';

// Both the inline send and the outbox retry render the SAME immutable opening
// metadata. A shared key with two different email bodies is not idempotent.
export async function trailNotification(sessionId: string) {
  const row = await convexQuery<Dict>(api.docs.getDoc, { path: `Analytics/Sessions/Items/${sessionId}` });
  if (!row || Array.isArray(row)) throw new Error('Visit unavailable for notification');
  const link = object(row.Link), geo = object(row.Geo), device = object(row.Device), entry = object(row.Entry);
  const name = text(link.Name) || 'Someone';
  return {
    subject: `${name} opened your link`.replace(/[\r\n]+/g, ' ').slice(0, 200),
    html: linkOpenedHtml({
      linkName: name,
      linkFor: text(link.For) || 'your portfolio',
      country: geo.Code ? `${text(geo.Country)} (${text(geo.Code, 2)})` : '',
      device: [device.Type, device.OS, device.Browser].map(v => text(v, 20)).filter(Boolean).join(' - '),
      localTime: text(device.LocalTime, 10),
      source: text(entry.Ref) || 'Unknown origin',
      visit: typeof row.Visit === 'number' && row.Visit > 0 ? row.Visit : 1,
      storyUrl: `${siteConfig.url}/dashboard?s=${encodeURIComponent(sessionId)}`,
    }),
  };
}
