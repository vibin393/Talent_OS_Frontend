import type { Metadata } from "next";
import { VendorDashboard } from "@/features/vendor-portal/other-views";

export const metadata: Metadata = { title: "Vendor Portal" };

/** Vendor Portal home (Epic 17 content; the shell, sign-in and users pages are Epic 14's). */
export default function VendorHomePage() {
  return <VendorDashboard />;
}
