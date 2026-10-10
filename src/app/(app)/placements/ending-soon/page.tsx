import type { Metadata } from "next";
import { EndingSoonView } from "@/features/placement-exit/ending-soon";

export const metadata: Metadata = { title: "Ending soon" };

export default function EndingSoonPage() {
  return <EndingSoonView />;
}
