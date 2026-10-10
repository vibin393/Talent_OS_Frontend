import type { Metadata } from "next";
import { NoticesAdmin } from "@/features/platform/notices-admin";

export const metadata: Metadata = { title: "Notices" };

export default function Page() {
  return <NoticesAdmin />;
}
