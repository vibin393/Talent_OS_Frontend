import Link from "next/link";
import type { NetworkJobSummary } from "@/lib/api/network";
import { locationLabel, payLabel, relativeTime } from "./format";

/** One result card (Epic 75, B1): title, agency, client (if shown), location or "Location on request", pay, posted. */
export function JobCard({ job }: { job: NetworkJobSummary }) {
  const pay = payLabel(job);
  return (
    <li className="jobs-card" data-listing-id={job.id}>
      <h3 className="jobs-card-title">
        <Link href={`/jobs/${job.id}`}>{job.title}</Link>
      </h3>
      <p className="jobs-card-agency">{job.agency}</p>
      {job.client_name ? <p className="jobs-card-client">{job.client_name}</p> : null}
      <ul className="jobs-card-meta">
        <li>{locationLabel(job)}</li>
        {pay ? <li>{pay}</li> : null}
        <li>Posted {relativeTime(job.published_at)}</li>
      </ul>
    </li>
  );
}
