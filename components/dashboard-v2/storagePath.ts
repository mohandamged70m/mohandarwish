import { knownPathFromUrl } from '@/lib/dash-storage';

/** The logical Storage path for a download URL — Firebase or Convex. */
export function storagePathFromUrl(url: string): string | null {
    const m = /\/o\/([^?#]+)/.exec(url);
    if (m) {
        try { return decodeURIComponent(m[1]); } catch { return null; }
    }
    return knownPathFromUrl(url);
}
