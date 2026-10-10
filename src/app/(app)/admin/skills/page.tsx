import type { Metadata } from "next";
import { SkillsAdmin } from "@/features/skills/skills-admin";

export const metadata: Metadata = { title: "Skill catalog" };

export default function Page() {
  return <SkillsAdmin />;
}
