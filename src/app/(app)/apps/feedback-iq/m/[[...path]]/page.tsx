import { EMBED_BASE } from "@/features/module-host/apps";
import { ModuleHost } from "@/features/module-host/module-host";

// Deep-embed an existing Feedback IQ page inside the unified shell (chrome-hidden).
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const src = `${EMBED_BASE["feedback-iq"]}/${path.join("/")}`;
  return <ModuleHost title="Feedback IQ" src={src} bare />;
}
