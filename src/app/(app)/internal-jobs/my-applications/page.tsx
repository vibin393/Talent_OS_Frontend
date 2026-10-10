import type { Metadata } from "next";
import { MyInternalApplications } from "@/features/mobility/board/my-applications";

export const metadata: Metadata = { title: "My internal applications" };

export default function Page() {
  return <MyInternalApplications />;
}
