import type { Metadata } from "next";
import { InterviewsAdmin } from "@/features/interviews/interviews-admin";

export const metadata: Metadata = { title: "Interview settings" };

export default function Page() {
  return <InterviewsAdmin />;
}
