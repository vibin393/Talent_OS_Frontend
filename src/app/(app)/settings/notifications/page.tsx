import type { Metadata } from "next";
import { NotificationPreferences } from "@/features/notifications/notification-preferences";

export const metadata: Metadata = { title: "Notification settings" };

export default function Page() {
  return <NotificationPreferences />;
}
