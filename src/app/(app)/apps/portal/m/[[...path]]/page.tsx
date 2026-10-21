import { EMBED_BASE } from "@/features/module-host/apps";
import { ModuleHost } from "@/features/module-host/module-host";

// Deep-embed an existing Job Portal (recruiter /hiring) page inside the unified shell (chrome-hidden).
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const src = `${EMBED_BASE.portal}/${path.join("/")}`;
  return <ModuleHost title="Job Portal" src={src} bare />;
}
