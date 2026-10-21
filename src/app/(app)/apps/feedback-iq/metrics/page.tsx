import type { Metadata } from "next";
import { EMBED_BASE } from "@/features/module-host/apps";
import { ModuleHost } from "@/features/module-host/module-host";

export const metadata: Metadata = { title: "Feedback IQ · Metrics" };

// Deep-embed the existing Feedback IQ analytics dashboard (chrome-hidden) rather than a placeholder.
// ModuleHost (bare) provides the loading spinner and the retry-on-error overlay.
export default function Page() {
  return <ModuleHost title="Feedback IQ" src={`${EMBED_BASE["feedback-iq"]}/dashboard`} bare />;
}
