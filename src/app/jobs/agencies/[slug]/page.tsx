import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobCard } from "@/features/network/job-card";
import { isNotFound, network } from "@/lib/api/network";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const a = await network.agency(slug);
    return { title: a.display_name, description: a.about_text ?? `Open jobs at ${a.display_name}.` };
  } catch {
    return { title: "Agency" };
  }
}

export default async function AgencyProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let agency;
  try {
    agency = await network.agency(slug);
  } catch (e) {
    if (isNotFound(e)) notFound();
    throw e;
  }
  return (
    <article>
      {agency.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={agency.logo_url} alt={agency.display_name} style={{ maxHeight: 64 }} />
      ) : null}
      <h2>About {agency.display_name}</h2>
      {agency.about_text ? <p>{agency.about_text}</p> : null}
      <p>
        <a href={agency.careers_url} rel="nofollow">
          Visit careers site
        </a>
      </p>
      <h3>Open jobs ({agency.open_jobs})</h3>
      {agency.jobs.length === 0 ? (
        <p className="jobs-empty">No open jobs right now.</p>
      ) : (
        <ul className="jobs-list">
          {agency.jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ul>
      )}
    </article>
  );
}
