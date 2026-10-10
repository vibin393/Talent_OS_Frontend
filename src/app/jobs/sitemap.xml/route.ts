import { network } from "@/lib/api/network";

export const dynamic = "force-dynamic";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);
}

function origin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** Sitemap of every listed job (absolute URLs, `lastmod`). */
export async function GET(request: Request): Promise<Response> {
  const base = origin(request);
  const entries = await network.sitemap(1).catch(() => []);
  const urls = [
    `  <url><loc>${escapeXml(`${base}/jobs`)}</loc></url>`,
    ...entries.map((e) => {
      const loc = escapeXml(`${base}/jobs/${e.listing_id}`);
      const lastmod = e.lastmod ? `<lastmod>${escapeXml(new Date(e.lastmod).toISOString())}</lastmod>` : "";
      return `  <url><loc>${loc}</loc>${lastmod}</url>`;
    }),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
