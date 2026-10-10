import type { Metadata } from "next";
import { DriveWizard } from "@/features/campus/drives/drive-wizard";

export const metadata: Metadata = { title: "New campus drive" };

/** `/campus/drives/new` (Epic 43): drive set-up wizard. */
export default function Page() {
  return <DriveWizard driveId={null} />;
}
