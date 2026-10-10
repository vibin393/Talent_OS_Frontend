import type { Metadata } from "next";
import { CalendarSyncSettingsPage } from "@/features/calendar-sync/settings-page";

export const metadata: Metadata = { title: "Calendar sync" };

export default function Page() {
  return <CalendarSyncSettingsPage />;
}
