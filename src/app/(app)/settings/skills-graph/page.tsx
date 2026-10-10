import type { Metadata } from "next";
import { SkillGraphAdmin } from "@/features/skills/graph-admin";

export const metadata: Metadata = { title: "Skills graph" };

export default function Page() {
  return <SkillGraphAdmin />;
}
