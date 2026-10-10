/** Ecosystem controls client (Epic 66): state, the Ecosystem Kill Switch and the app policy. */
import { api } from "@/lib/api/client";

const V = "/api/v1";

export type PublisherKind = "platform" | "partner" | "tenant";

export type AppPolicy = {
  publisher_kinds: PublisherKind[];
  private_apps: boolean;
  user_self_authorize: boolean;
  sensitive_approval_chain_id: string | null;
};

export type EcosystemState = {
  kill_switch_on: boolean;
  kill_switch_at: string | null;
  kill_switch_reason: string | null;
  platform_suspended: boolean;
  platform_suspended_reason: string | null;
  global_suspended: boolean;
  mcp_enabled: boolean;
  mcp_enabled_at: string | null;
  mcp_notice_version: string | null;
  mcp_tool_groups: string[];
  app_policy: AppPolicy;
  rate_tier: string;
  sandbox: boolean;
};

export const ecosystemKeys = { state: ["ecosystem", "state"] as const };

export const ecosystemApi = {
  state: (signal?: AbortSignal) => api.get<EcosystemState>(`${V}/ecosystem`, { signal }),
  setKillSwitch: (on: boolean, reason: string) => api.post<EcosystemState>(`${V}/ecosystem/kill-switch`, { on, reason }),
  setAppPolicy: (policy: AppPolicy) => api.put<EcosystemState>(`${V}/ecosystem/app-policy`, policy),
};
