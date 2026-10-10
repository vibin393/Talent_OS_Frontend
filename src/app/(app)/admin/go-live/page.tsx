import type { Metadata } from "next";
import { GoLivePage } from "@/features/golive/go-live-page";

export const metadata: Metadata = { title: "Go-live import" };

export default function Page() {
  return <GoLivePage />;
}
