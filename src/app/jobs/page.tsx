import type { Metadata } from "next";
import Link from "next/link";
import { ImpressionsBeacon } from "@/features/network/impressions-beacon";
import { JobCard } from "@/features/network/job-card";
import { SearchFilters } from "@/features/network/search-filters";
import { type JobsFilters, network, PAGE_SIZE } from "@/lib/api/network";

export const metadata: Metadata = {
  title: { absolute: "Talent OS Jobs" },
  description: "Jobs from verified recruitment agencies. You apply directly to the agency.",
};

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 200) ?? "";
}

export default async function JobsHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const pageNo = Number.parseInt(one(sp.page), 10);
  const filters: JobsFilters = {
    q: one(sp.q),
    location: one(sp.location).slice(0, 100),
    work_mode: one(sp.work_mode).slice(0, 20),
    employment_type: one(sp.employment_type).slice(0, 30),
    experience: one(sp.experience).slice(0, 5),
    pay_min: one(sp.pay_min).slice(0, 15),
    category: one(sp.category).slice(0, 60),
    posted_within: one(sp.posted_within).slice(0, 4),
    page: Number.isFinite(pageNo) && pageNo > 0 ? Math.min(pageNo, 10_000) : 1,
  };
  const page = await network.jobs(filters);
  const totalPages = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
  const current = page.page;

  function pageHref(n: number): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v && k !== "page") params.set(k, String(v));
    }
    params.set("page", String(n));
    return `/jobs?${params.toString()}`;
  }

  return (
    <>
      <SearchFilters filters={filters} />
      <p className="jobs-count">{page.total} jobs</p>
      {page.items.length === 0 ? (
        <p className="jobs-empty">No jobs match your search. Try fewer filters.</p>
      ) : (
        <ul className="jobs-list">
          {page.items.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ul>
      )}
      {totalPages > 1 ? (
        <nav className="jobs-pagination" aria-label="Pagination">
          {current > 1 ? <Link href={pageHref(current - 1)}>Previous</Link> : <span />}
          <span>
            Page {current} of {totalPages}
          </span>
          {current < totalPages ? <Link href={pageHref(current + 1)}>Next</Link> : <span />}
        </nav>
      ) : null}
      <ImpressionsBeacon listingIds={page.items.map((j) => j.id)} />
    </>
  );
}
