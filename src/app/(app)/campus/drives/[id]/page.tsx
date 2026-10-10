import type { Metadata } from "next";
import { DriveDetail } from "@/features/campus/drives/drive-detail";

export const metadata: Metadata = { title: "Campus drive" };

/** `/campus/drives/[id]` (Epic 43). */
export default async function Page({ params }: PageProps<"/campus/drives/[id]">) {
  const { id } = await params;
  return <DriveDetail key={id} driveId={id} />;
}
