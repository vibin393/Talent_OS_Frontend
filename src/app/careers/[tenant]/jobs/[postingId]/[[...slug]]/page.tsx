import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { jobPath, serializeJsonLd, textExcerpt } from "@/features/careers/format";
import { loadBranding, loadPosting } from "@/features/careers/load";
import { PostingDetail } from "@/features/careers/posting-detail";

type Props = PageProps<"/careers/[tenant]/jobs/[postingId]/[[...slug]]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant, postingId } = await params;
  const [branding, posting] = await Promise.all([loadBranding(tenant), loadPosting(tenant, postingId)]);
  const description = textExcerpt(posting.description_html) || `${posting.title} at ${branding.display_name}`;
  const canonical = jobPath(tenant, posting.id, posting.slug);
  return {
    title: posting.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${posting.title} – Careers at ${branding.display_name}`,
      description,
      url: canonical,
      images: branding.logo_url ? [{ url: branding.logo_url, alt: branding.display_name }] : undefined,
    },
  };
}

/** Job detail (server-rendered): 404 when unpublished/unknown, redirect to the canonical slug, JSON-LD JobPosting. */
export default async function JobPage({ params }: Props) {
  const { tenant, postingId, slug } = await params;
  const posting = await loadPosting(tenant, postingId);
  const current = (slug ?? []).join("/");
  if (current !== posting.slug) permanentRedirect(jobPath(tenant, posting.id, posting.slug));
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(posting.jsonld) }} />
      <PostingDetail slug={tenant} posting={posting} />
    </>
  );
}
