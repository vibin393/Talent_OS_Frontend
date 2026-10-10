import type { Metadata } from "next";
import { Workspace } from "@/features/developers/workspace";

export const metadata: Metadata = { title: "Workspace", robots: { index: false, follow: false } };

export default function Page() {
  return <Workspace />;
}
