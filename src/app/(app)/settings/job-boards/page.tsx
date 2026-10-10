import type { Metadata } from "next";
import { JobBoardsSettingsPage } from "@/features/job-boards/settings-page";

export const metadata: Metadata = { title: "Job boards" };

export default function Page() {
  return <JobBoardsSettingsPage />;
}
