import type { Metadata } from "next";
import { BgvAdmin } from "@/features/bgv/admin-bgv";

export const metadata: Metadata = { title: "Background verification settings" };

export default function Page() {
  return <BgvAdmin />;
}
