import { EMBED_BASE } from "@/features/module-host/apps";
import { ModuleHost } from "@/features/module-host/module-host";

// Deep-embed an existing Croar page inside the unified shell (chrome-hidden), driven by the native
// contextual sidebar. Native unification reuses Croar's existing frontend rather than rebuilding it.
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const src = `${EMBED_BASE.croar}/${path.join("/")}`;
  return <ModuleHost title="Croar" src={src} bare />;
}
