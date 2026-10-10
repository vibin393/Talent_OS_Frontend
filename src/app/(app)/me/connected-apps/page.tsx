import type { Metadata } from "next";
import { ConnectedAppsPage } from "@/features/apps/connected-apps-page";

export const metadata: Metadata = { title: "Connected apps" };

export default function Page() {
  return <ConnectedAppsPage />;
}
