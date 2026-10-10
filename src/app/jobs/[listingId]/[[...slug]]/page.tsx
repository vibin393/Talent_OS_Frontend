import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EMPLOYMENT_LABELS, locationLabel, payLabel, relativeTime, WORK_MODE_LABELS } from "@/features/network/format";
import { ReportDialog } from "@/features/network/report-dialog";
import { isNotFound, network } from "@/lib/api/network";

export async function generateMetadata({ params }: { params: Promise<{ listingId: string }> }): Promise<Metadata> {
  const { listingId } = await params;
  try {
    const job = await network.job(listingId);
    return { title: `${job.title} – ${job.agency}`, description: `${job.title} at ${job.agency}.` };
  } catch {
    return { title: "Job" };
  }
}

export default async function JobDetail({ params }: { params: Promise<{ listingId: string; slug?: string[] }> }) {
  const { listingId } = await params;
  let job;
  try {
    job = await network.job(listingId);
  } catch (e) {
    if (isNotFound(e)) notFound();
    throw e;
  }
  const pay = payLabel(job);
  const applyHref = `/api/v1/public/network/jobs/${encodeURIComponent(job.id)}/apply`;

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(job.jsonld) }} />
      <h2>{job.title}</h2>
      <p className="jobs-card-agency">{job.agency}</p>
      {job.client_name ? <p className="jobs-card-client">{job.client_name}</p> : null}
      <ul className="jobs-card-meta">
        <li>{locationLabel(job)}</li>
        {job.work_mode ? <li>{WORK_MODE_LABELS[job.work_mode] ?? job.work_mode}</li> : null}
        {job.employment_type ? <li>{EMPLOYMENT_LABELS[job.employment_type] ?? job.employment_type}</li> : null}
        {pay ? <li>{pay}</li> : null}
        <li>Posted {relativeTime(job.published_at)}</li>
      </ul>

      <div className="jobs-detail-actions">
        <a className="jobs-button" href={applyHref} rel="nofollow">
          Apply on {job.agency}&apos;s site
        </a>
        <ReportDialog listingId={job.id} />
      </div>

      {/* The careers description is already sanitised server-side (allow-list HTML). */}
      <div className="jobs-description" dangerouslySetInnerHTML={{ __html: job.description_html }} />

      {job.skills.length > 0 ? (
        <ul className="jobs-card-meta" aria-label="Skills">
          {job.skills.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : null}

      <section className="jobs-agency-box">
        <h3>{job.agency}</h3>
        <p>
          <Link href={`/jobs/agencies/${encodeURIComponent(job.agency_slug)}`}>More jobs from {job.agency}</Link>
        </p>
      </section>

      <p className="jobs-footer-note">Your application goes only to {job.agency}. Talent OS Jobs keeps no copy.</p>
    </article>
  );
}
