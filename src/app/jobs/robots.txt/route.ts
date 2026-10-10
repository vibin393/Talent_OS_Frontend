export const dynamic = "force-dynamic";

function origin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** robots.txt for the Job Network site: jobs are crawlable, the apply redirect and the API are not. */
export function GET(request: Request): Response {
  const body = [
    "User-agent: *",
    "Allow: /jobs",
    "Disallow: /jobs/*/apply",
    "Disallow: /api/",
    `Sitemap: ${origin(request)}/jobs/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
