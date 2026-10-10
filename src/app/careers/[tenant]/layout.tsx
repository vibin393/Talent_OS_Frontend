import type { Metadata } from "next";
import { CareerFrame } from "@/features/careers/career-frame";
import { textExcerpt } from "@/features/careers/format";
import { loadBranding, siteOrigin } from "@/features/careers/load";

export async function generateMetadata({ params }: LayoutProps<"/careers/[tenant]">): Promise<Metadata> {
  const { tenant } = await params;
  const branding = await loadBranding(tenant);
  const origin = await siteOrigin();
  const siteName = `Careers at ${branding.display_name}`;
  const description = textExcerpt(branding.about_html) || `Open positions at ${branding.display_name}. Search jobs and apply online.`;
  return {
    metadataBase: new URL(origin),
    title: { absolute: siteName, template: `%s – ${siteName}` },
    description,
    openGraph: {
      type: "website",
      siteName,
      title: siteName,
      description,
      images: branding.logo_url ? [{ url: branding.logo_url, alt: branding.display_name }] : undefined,
    },
    twitter: { card: "summary" },
  };
}

/** Tenant-branded, server-rendered career site shell (Epic 9, B2). Unknown / disabled site -> 404. */
export default async function CareersLayout({ children, params }: LayoutProps<"/careers/[tenant]">) {
  const { tenant } = await params;
  const branding = await loadBranding(tenant);
  return <CareerFrame branding={branding}>{children}</CareerFrame>;
}
