import type { Metadata } from "next";
import { WorkBgv } from "@/features/bgv/work-bgv";

export const metadata: Metadata = { title: "Background verification" };

export default function Page() {
  return <WorkBgv />;
}
