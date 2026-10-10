import type { Metadata } from "next";
import { NetworkConsole } from "@/features/platform/network/network-console";

export const metadata: Metadata = { title: "Job network" };

export default function Page() {
  return <NetworkConsole />;
}
