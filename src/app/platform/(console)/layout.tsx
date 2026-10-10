import type { Metadata } from "next";
import { PlatformShell } from "@/features/platform/platform-shell";

export const metadata: Metadata = { title: { default: "Platform admin", template: "%s · Platform admin" } };

export default function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
