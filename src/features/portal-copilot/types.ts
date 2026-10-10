/**
 * Epic 77 portal Copilot DTOs, mirroring `Backend/app/schemas/portal_copilot.py` (hand-written; no gen:api).
 */
export type PortalKind = "client" | "vendor" | "candidate";
export type UnavailableReason =
  | "not_enabled"
  | "agentic_off"
  | "kill_switch"
  | "budget_exhausted"
  | "consent_required"
  | "no_permission"
  | "principal_inactive";

export interface PortalCopilotStatus {
  portal: PortalKind;
  available: boolean;
  reason: UnavailableReason | null;
  tenant_name: string;
  questions_per_hour: number;
  questions_left_this_hour: number;
  retention_days: number;
  disclosure: string;
  disclosure_extra: string | null;
  consent_notice_id: string | null;
  consent_notice_text: string | null;
}

export interface PortalConversation {
  id: string;
  agent_key: string;
  title: string | null;
  status: "open" | "closed";
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface PortalDraft {
  proposal_id: string;
  tool_key: string;
  title: string;
  preview: { title: string; summary: string; fields: [string, string][] } | null;
  status: string;
  expires_at: string | null;
  editable_fields: string[];
}

export interface PortalMessageContent {
  text?: string;
  status?: string;
  reason_code?: string | null;
  links?: string[];
  tools?: { tool_key: string; title: string; outcome: string }[];
  drafts?: PortalDraft[];
  kind?: string;
  message?: string;
  proposal_id?: string;
  redacted?: boolean;
}

export interface PortalMessage {
  id: string;
  seq: number;
  role: "user" | "assistant" | "event";
  content: PortalMessageContent;
  run_id: string | null;
  created_at: string;
}

export interface PortalConversationDetail extends PortalConversation {
  messages: PortalMessage[];
}

export interface PortalTurn {
  message: PortalMessage;
  run_id: string | null;
  stream_url: string | null;
  status: string;
  reason: string | null;
}

export interface DraftResult {
  proposal_id: string;
  status: string;
  error_code: string | null;
  open_url: string | null;
  result: Record<string, unknown> | null;
}

export interface PortalCopilotSettings {
  client_enabled: boolean;
  vendor_enabled: boolean;
  candidate_enabled: boolean;
  questions_per_hour_external: number;
  questions_per_hour_candidate: number;
  retention_days: number;
  handoff_queue_role_key: string | null;
  disclosure_extra: string | null;
  agentic_enabled: boolean;
  updated_at: string | null;
}

export type PortalCopilotSettingsIn = Partial<Omit<PortalCopilotSettings, "agentic_enabled" | "updated_at">>;

export interface PortalUsageRow {
  portal: PortalKind;
  questions: number;
  helpful_pct: number | null;
  drafts_confirmed: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface PortalUsage {
  date_from: string;
  date_to: string;
  rows: PortalUsageRow[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
