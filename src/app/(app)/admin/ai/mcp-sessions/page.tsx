import type { Metadata } from "next";
import { ConsoleShell } from "@/features/ai-governance/console-shell";
import { SessionsGrid } from "@/features/mcp/sessions-grid";

export const metadata: Metadata = { title: "MCP sessions" };

export default function Page() {
  return (
    <ConsoleShell>
      <SessionsGrid />
    </ConsoleShell>
  );
}
