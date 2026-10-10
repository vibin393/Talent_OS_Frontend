import type { Metadata } from "next";
import { DrivesList } from "@/features/campus/drives/drives-list";

export const metadata: Metadata = { title: "Campus drives" };

/** `/campus/drives` (Epic 43). */
export default function Page() {
  return <DrivesList />;
}
