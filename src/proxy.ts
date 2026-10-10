import { NextResponse, type NextRequest } from "next/server";
import { backendBase, careersPath, decideHost, HostCache, resolveCustomHost } from "@/features/messaging/host-routing";

/**
 * Career-site host routing.
 *
 * - Subdomain mode (Epic 9, B1): when `CAREERS_ROOT_DOMAIN` is set, a request to
 *   `<slug>.<CAREERS_ROOT_DOMAIN>/<path>` is rewritten to `/careers/<slug>/<path>` (so `/robots.txt` and
 *   `/sitemap.xml` reach the tenant routes). Path mode (`/careers/<slug>`) always works.
 * - Custom domains (Epic 33, FR-174): any other host that is not the app host (`APP_HOST`, or the host of
 *   `NEXT_PUBLIC_APP_URL` / `FRONTEND_URL`; localhost is always the app) is resolved through
 *   `GET /api/v1/public/careers/resolve-host` (cached in memory for 5 min) and rewritten the same way.
 *   App hosts and unresolved hosts are untouched. Logic lives in `features/messaging/host-routing.ts`.
 */
const cache = new HostCache();

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Epic 75 (additive): the Job Network lives at the main host `/jobs` and, when set, the `jobs.<CAREERS_ROOT_DOMAIN>`
  // subdomain, which is rewritten to `/jobs/...` (so `/robots.txt` and `/sitemap.xml` reach the jobs routes too).
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const careersRoot = (process.env.CAREERS_ROOT_DOMAIN ?? "").toLowerCase();
  if (careersRoot && host === `jobs.${careersRoot}`) {
    const url = request.nextUrl.clone();
    if (!url.pathname.startsWith("/jobs")) {
      url.pathname = url.pathname === "/" ? "/jobs" : `/jobs${url.pathname}`;
    }
    return NextResponse.rewrite(url);
  }
  const decision = decideHost(request.headers.get("host"), pathname, process.env);
  if (decision.kind === "pass") return NextResponse.next();
  const slug =
    decision.kind === "subdomain" ? decision.slug : await resolveCustomHost(decision.host, backendBase(process.env), cache);
  if (!slug) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = careersPath(slug, pathname);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
