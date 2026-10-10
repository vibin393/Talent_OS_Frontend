/** Sales dashboard drill-down links (pure, unit-tested). */

const KNOWN = ["/leads", "/opportunities", "/tasks", "/clients"];

/** The in-app href of a tile `link` (frontend route + query), or null for an unknown route. */
export function crmTileHref(link: string | null | undefined): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;
  const path = link.split("?")[0];
  return KNOWN.some((p) => path === p || path.startsWith(`${p}/`)) ? link : null;
}

/** A drill-down link for one bucket of a tile, merging extra filters into the tile link's query. */
export function bucketHref(link: string | null | undefined, extra: Record<string, string | null | undefined>): string | null {
  const base = crmTileHref(link);
  if (!base) return null;
  const [path, qs = ""] = base.split("?");
  const params = new URLSearchParams(qs);
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
    else params.delete(k);
  }
  const s = params.toString();
  return s ? `${path}?${s}` : path;
}

/** First / last day of a `YYYY-MM` month. */
export function monthRange(month: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const last = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return { from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}` };
}
