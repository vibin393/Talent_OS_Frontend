import type { Metadata } from "next";
import { McpSettingsPage } from "@/features/mcp/mcp-settings-page";

export const metadata: Metadata = { title: "AI assistant access (MCP)" };

export default function Page() {
  return <McpSettingsPage />;
}
