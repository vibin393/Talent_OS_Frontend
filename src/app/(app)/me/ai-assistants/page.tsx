import type { Metadata } from "next";
import { MyAssistants } from "@/features/mcp/my-assistants";

export const metadata: Metadata = { title: "AI assistants" };

export default function Page() {
  return <MyAssistants />;
}
