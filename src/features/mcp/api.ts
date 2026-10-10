/** AI assistant access (MCP) administration and self-service (Epic 73). Hand-written DTOs. */
import { api } from "@/lib/api/client";

const V = "/api/v1/mcp";

export type Execution = "read" | "draft" | "propose";
export type LowToolMode = "suggest" | "auto";

export type McpTool = { key: string; name: string; title: string; group: string; execution: Execution; mcp_scope: string; risk: string };
export type McpGroup = { key: string; label: string; description: string; enabled: boolean; tools: McpTool[] };

export type McpSettings = {
  enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
  enabled_by_name: string | null;
  notice_version: string | null;
  current_notice_version: string;
  notice_text: string;
  agentic_enabled: boolean;
  kill_switch: boolean;
  tool_groups: string[];
  groups: McpGroup[];
  calls_per_minute: number | null;
  tier_calls_per_minute: number;
  calls_per_user_day: number;
  proposals_per_hour: number;
  bulk_read_threshold: number;
  max_results: number;
  allowed_origins: string[];
  notify_user_on_first_connection: boolean;
  low_tool_modes: Record<string, LowToolMode>;
  server_url: string;
};

export type McpSettingsIn = Partial<{
  tool_groups: string[];
  calls_per_minute: number | null;
  clear_calls_per_minute: boolean;
  calls_per_user_day: number;
  proposals_per_hour: number;
  bulk_read_threshold: number;
  max_results: number;
  allowed_origins: string[];
  notify_user_on_first_connection: boolean;
  low_tool_modes: Record<string, LowToolMode>;
}>;

export type SessionStatus = "active" | "paused" | "ended";
export type McpSession = {
  id: string;
  run_id: string;
  installation_id: string;
  user_id: string;
  user_name: string | null;
  client_name: string;
  client_version: string | null;
  protocol_version: string;
  status: SessionStatus;
  end_reason: string | null;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  call_count: number;
  proposal_count: number;
  refusal_count: number;
  violation_count: number;
  redaction_count: number;
  distinct_candidates: number;
};
export type McpSessionPage = { items: McpSession[]; total: number; page: number; page_size: number };
export type McpHold = {
  id: string;
  user_id: string;
  user_name: string | null;
  installation_id: string | null;
  session_id: string | null;
  reason: "bulk_read" | "admin";
  held_at: string;
  auto_release_at: string | null;
  released_at: string | null;
  note: string | null;
};
export type McpMe = { enabled: boolean; has_permission: boolean; on_hold: boolean; server_url: string };

export type SessionFilter = { status?: SessionStatus; mine?: boolean; page?: number };

export const mcpKeys = {
  settings: ["mcp", "settings"] as const,
  sessions: (f: SessionFilter) => ["mcp", "sessions", f] as const,
  holds: ["mcp", "holds"] as const,
  me: ["mcp", "me"] as const,
};

function query(f: SessionFilter): string {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.mine) p.set("mine", "true");
  p.set("page", String(f.page ?? 1));
  p.set("page_size", "50");
  return p.toString();
}

export const mcpApi = {
  settings: (signal?: AbortSignal) => api.get<McpSettings>(`${V}/settings`, { signal }),
  enable: (body: { notice_version: string; acknowledged: boolean; tool_groups: string[] }) => api.post<McpSettings>(`${V}/enable`, body),
  disable: (reason: string) => api.post<McpSettings>(`${V}/disable`, { reason }),
  update: (body: McpSettingsIn) => api.patch<McpSettings>(`${V}/settings`, body),
  sessions: (f: SessionFilter, signal?: AbortSignal) => api.get<McpSessionPage>(`${V}/sessions?${query(f)}`, { signal }),
  endSession: (id: string, reason?: string) => api.post<McpSession>(`${V}/sessions/${id}/end`, { reason: reason ?? null }),
  holds: (signal?: AbortSignal) => api.get<McpHold[]>(`${V}/holds`, { signal }),
  releaseHold: (id: string, note: string) => api.post<McpHold>(`${V}/holds/${id}/release`, { note }),
  me: (signal?: AbortSignal) => api.get<McpMe>(`${V}/me`, { signal }),
};
