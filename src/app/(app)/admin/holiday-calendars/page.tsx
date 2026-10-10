import type { Metadata } from "next";
import { HolidayCalendarsAdmin } from "@/features/holidays/holiday-calendars-admin";

export const metadata: Metadata = { title: "Holiday calendars" };

export default function Page() {
  return <HolidayCalendarsAdmin />;
}
