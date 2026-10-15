import type { Metadata } from "next";
import { embeddedApp } from "@/features/module-host/apps";
import { ModuleHost } from "@/features/module-host/module-host";

export const metadata: Metadata = { title: "Job Portal" };

export default function Page() {
  const app = embeddedApp("portal");
  return <ModuleHost title={app.label} src={app.url} />;
}
