import { careersPath } from "@/features/careers/format";
import { siteOrigin } from "@/features/careers/load";
import { isNotFound, publicCareers } from "@/lib/api/public-server";

// Absolute URLs come from the request host, so render per request (the API reads are still cached).
export const dynamic = "force-dynamic";

/**
 * Per-tenant robots.txt (served at `/robots.txt` of a tenant subdomain by `src/proxy.ts`): the career site
 * is crawlable, the apply flow and the candidate portal are not.
 */
export async function GET(_request: Request, ctx: RouteContext<"/careers/[tenant]/robots.txt">) {
  const { tenant } = await ctx.params;
  try {
    await publicCareers.branding(tenant);
  } catch (e) {
    if (isNotFound(e)) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
    throw e;
  }
  const origin = await siteOrigin();
  const base = careersPath(tenant);
  const body = [
    "User-agent: *",
    `Allow: ${base}/`,
    `Disallow: ${base}/jobs/*/apply`,
    "Disallow: /portal",
    "Disallow: /l/",
    "Disallow: /api/",
    `Sitemap: ${origin}${base}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
