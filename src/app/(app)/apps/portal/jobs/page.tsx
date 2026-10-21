import type { Metadata } from "next";
import { EMBED_BASE } from "@/features/module-host/apps";
import { ModuleHost } from "@/features/module-host/module-host";

export const metadata: Metadata = { title: "Job Portal · Jobs" };

// Deep-embed the existing Job Portal recruiter "Jobs & responses" screen (chrome-hidden) rather than
// a placeholder. ModuleHost (bare) provides the loading spinner and the retry-on-error overlay.
// EMBED_BASE.portal is host-only; Portal deep paths already include the /hiring recruiter prefix.
export default function Page() {
  return <ModuleHost title="Job Portal" src={`${EMBED_BASE.portal}/hiring/job-listing`} bare />;
}
