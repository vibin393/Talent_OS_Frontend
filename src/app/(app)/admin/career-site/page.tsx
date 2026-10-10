import type { Metadata } from "next";
import { CareerSiteSettings } from "@/features/careers/admin/career-site-settings";

export const metadata: Metadata = { title: "Career site" };

export default function Page() {
  return <CareerSiteSettings />;
}
