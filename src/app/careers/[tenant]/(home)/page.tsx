import type { Metadata } from "next";
import { careersPath } from "@/features/careers/format";
import { loadBranding } from "@/features/careers/load";
import { PostingsView, type SearchFilters } from "@/features/careers/postings-view";
import { publicCareers } from "@/lib/api/public-server";

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 200) ?? "";
}

export async function generateMetadata({ params, searchParams }: PageProps<"/careers/[tenant]">): Promise<Metadata> {
  const { tenant } = await params;
  const sp = await searchParams;
  const filtered = ["q", "location", "work_mode", "employment_type", "page"].some((k) => one(sp[k]));
  return {
    alternates: { canonical: careersPath(tenant) },
    // Search result permutations are not indexed; the job pages and the sitemap are.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function CareersHome({ params, searchParams }: PageProps<"/careers/[tenant]">) {
  const { tenant } = await params;
  const sp = await searchParams;
  const pageNo = Number.parseInt(one(sp.page), 10);
  const filters: SearchFilters = {
    q: one(sp.q),
    location: one(sp.location).slice(0, 100),
    work_mode: one(sp.work_mode).slice(0, 20),
    employment_type: one(sp.employment_type).slice(0, 30),
    page: Number.isFinite(pageNo) && pageNo > 0 ? Math.min(pageNo, 10_000) : 1,
  };
  const [branding, page] = await Promise.all([loadBranding(tenant), publicCareers.postings(tenant, filters)]);
  return <PostingsView branding={branding} page={page} filters={filters} />;
}
