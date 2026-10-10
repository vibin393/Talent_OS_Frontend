import type { MetadataRoute } from "next";

/**
 * Site-wide robots rules: only the public career sites are crawlable. The candidate portal, secure links,
 * the API and the internal app are disallowed. Each career site also serves its own robots.txt and
 * sitemap under `/careers/<slug>/` (mapped to `/robots.txt` on a tenant subdomain by `src/proxy.ts`).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/careers/",
      disallow: [
        "/careers/*/jobs/*/apply",
        "/portal",
        "/l/",
        "/api/",
        "/platform",
        "/login",
        "/accept-invite",
        "/forgot-password",
        "/reset-password",
        "/dashboard",
        "/admin",
        "/approvals",
        "/candidates",
        "/clients",
        "/demands",
        "/settings",
        "/sub-processors",
        "/tasks",
      ],
    },
  };
}
