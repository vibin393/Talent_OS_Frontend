import type { Metadata } from "next";
import { PrivateAppsPage } from "@/features/apps/apps-page";

export const metadata: Metadata = { title: "Private apps" };

export default function Page() {
  return <PrivateAppsPage />;
}
