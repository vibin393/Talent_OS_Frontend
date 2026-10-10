import { careersPath, escapeXml, jobPath } from "@/features/careers/format";
import { siteOrigin } from "@/features/careers/load";
import { isNotFound, publicCareers } from "@/lib/api/public-server";

// Absolute URLs come from the request host, so render per request (the API reads are still cached).
export const dynamic = "force-dynamic";

/** Per-tenant sitemap: the career home plus every live posting (absolute URLs, `lastmod`). */
export async function GET(_request: Request, ctx: RouteContext<"/careers/[tenant]/sitemap.xml">) {
  const { tenant } = await ctx.params;
  let entries;
  try {
    entries = await publicCareers.sitemap(tenant);
  } catch (e) {
    if (isNotFound(e)) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
    throw e;
  }
  const origin = await siteOrigin();
  const urls = [
    `  <url><loc>${escapeXml(`${origin}${careersPath(tenant)}`)}</loc></url>`,
    ...entries.map((e) => {
      const loc = escapeXml(`${origin}${jobPath(tenant, e.posting_id, e.slug)}`);
      const lastmod = e.lastmod ? `<lastmod>${escapeXml(new Date(e.lastmod).toISOString())}</lastmod>` : "";
      return `  <url><loc>${loc}</loc>${lastmod}</url>`;
    }),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
