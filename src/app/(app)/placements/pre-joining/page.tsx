import type { Metadata } from "next";
import { PreJoiningView } from "@/features/placements/pre-joining-view";

export const metadata: Metadata = { title: "Pre-joining" };

export default function PreJoiningPage() {
  return <PreJoiningView />;
}
