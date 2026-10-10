"use client";

import { GapCard } from "./gap-card";

/**
 * "MCP" tab. The shipped console router does not expose `/mcp-sessions`; external MCP sessions are shared with the AI
 * governance console (Epic 73 read model, `origin='external'`). Linked here (gap note).
 */
export function McpTab() {
  return (
    <GapCard title="MCP sessions" link={{ href: "/admin/ai/mcp-sessions", label: "Open MCP sessions" }}>
      External AI assistant sessions (client, user, tools called, Proposals, violations) are shown in the AI governance
      console. The ecosystem console API does not yet expose an MCP session read, so they are not listed inline here.
    </GapCard>
  );
}
