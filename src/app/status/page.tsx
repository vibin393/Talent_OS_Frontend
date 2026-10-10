import type { Metadata } from "next";
import BackendStatus from "@/components/BackendStatus";

export const metadata: Metadata = { title: "Status" };

export default function StatusPage() {
  return <BackendStatus />;
}
