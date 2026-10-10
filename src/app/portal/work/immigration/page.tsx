import type { Metadata } from "next";
import { WorkImmigrationList } from "@/features/immigration/work-immigration";

export const metadata: Metadata = { title: "Immigration" };

export default function Page() {
  return <WorkImmigrationList />;
}
