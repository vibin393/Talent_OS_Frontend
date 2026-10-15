import type { Metadata } from "next";
import { embeddedApp } from "@/features/module-host/apps";
import { ModuleHost } from "@/features/module-host/module-host";

export const metadata: Metadata = { title: "Croar" };

export default function Page() {
  const app = embeddedApp("croar");
  return <ModuleHost title={app.label} src={app.url} />;
}
