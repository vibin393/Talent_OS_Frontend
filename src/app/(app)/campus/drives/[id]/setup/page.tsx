import type { Metadata } from "next";
import { DriveWizard } from "@/features/campus/drives/drive-wizard";

export const metadata: Metadata = { title: "Drive set-up" };

/** `/campus/drives/[id]/setup` (Epic 43): edit a drive through the wizard. */
export default async function Page({ params }: PageProps<"/campus/drives/[id]/setup">) {
  const { id } = await params;
  return <DriveWizard key={id} driveId={id} />;
}
