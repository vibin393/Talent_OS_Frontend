/**
 * Epic 54 Copilot DTOs, mirroring `Backend/app/schemas/copilot.py` (hand-written, as `agentic-types.ts`; no gen:api).
 */

export type CopilotEntityType =
  | "candidate"
  | "demand"
  | "application"
  | "client"
  | "contact"
  | "placement"
  | "interview"
  | "worker"
  | "offer"
  | "project";
export type CopilotListKind = "candidates" | "demands" | "pipeline" | "interviews" | "placements" | "tasks";
export type FilterValue = string | number | boolean | string[];

export interface ListContext {
  kind: CopilotListKind;
  filters?: Record<string, FilterValue>;
  selected_ids?: string[];
}

/** Ids and labels only -- never record content (the server never resolves the entity). */
export interface PageContext {
  route: string;
  entity_type?: CopilotEntityType | null;
  entity_id?: string | null;
  list?: ListContext | null;
  label?: string | null;
}

export type UnavailableReason = "no_permission" | "not_enabled" | "kill_switch" | "global_kill" | "budget_exhausted";

export interface CopilotMode {
  agent_key: string;
  label: string;
}

export interface CopilotStatus {
  available: boolean;
  reason: UnavailableReason | null;
  questions_left_this_hour: number;
  questions_per_hour: number;
  retention_days: number;
  allow_feedback_comments: boolean;
  modes: CopilotMode[];
}

export interface ConversationSummary {
  id: string;
  agent_key: string;
  mode_label: string;
  title: string | null;
  status: "open" | "closed";
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface Conversation extends ConversationSummary {
  context_ref: PageContext | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ToolEntry {
  tool_key: string;
  title: string;
  outcome: string;
  summary: string;
  error_code?: string | null;
}

export interface CardRef {
  kind: string;
  id: string;
}

export type TurnStatus = "completed" | "stopped" | "failed" | "cancelled" | "unavailable";

export interface UserContent {
  text: string;
  page_context?: PageContext | null;
}

export interface AssistantContent {
  text: string;
  status: TurnStatus;
  reason_code?: string | null;
  refs: [string, string][];
  tools: ToolEntry[];
  drafts: string[];
  cards: CardRef[];
}

export type DraftEventKind = "draft_confirmed" | "draft_failed" | "draft_discarded" | "draft_expired" | "draft_stale";

export interface EventContent {
  kind: DraftEventKind | "segment_started";
  proposal_id?: string;
  error_code?: string | null;
  message: string;
}

export interface RedactedContent {
  redacted: true;
  role: string;
}

export interface CopilotMessage {
  id: string;
  seq: number;
  role: "user" | "assistant" | "event";
  content: UserContent | AssistantContent | EventContent | RedactedContent;
  run_id: string | null;
  redacted: boolean;
  created_at: string;
}

export interface TurnOut {
  message: CopilotMessage;
  run_id: string | null;
  stream_url: string | null;
  status: string;
  reason?: string | null;
}

export interface FeedbackIn {
  rating: "helpful" | "unhelpful";
  comment?: string | null;
}

export interface FeedbackOut {
  run_id: string;
  rating: "helpful" | "unhelpful";
  comment: string | null;
  updated_at: string;
}

export interface CopilotSettings {
  retention_days: number;
  questions_per_hour: number;
  max_open_conversations: number;
  allow_feedback_comments: boolean;
  draft_expiry_hours: number;
  enabled: boolean;
  agentic_enabled: boolean;
  updated_at: string | null;
}

export type CopilotSettingsIn = Partial<
  Pick<
    CopilotSettings,
    "retention_days" | "questions_per_hour" | "max_open_conversations" | "allow_feedback_comments" | "draft_expiry_hours"
  >
>;

export interface UsageDay {
  day: string;
  conversations: number;
  turns: number;
  active_users: number;
  input_tokens: number;
  output_tokens: number;
  cost_micros: number;
  helpful: number;
  unhelpful: number;
  helpful_pct: number | null;
  failures: Record<string, number>;
}

export interface UsageComment {
  run_id: string;
  rating: "helpful" | "unhelpful";
  comment: string;
  created_at: string;
}

export interface CopilotUsage {
  date_from: string;
  date_to: string;
  days: UsageDay[];
  comments: UsageComment[];
}

export interface StreamFrame {
  id: string;
  event: string;
  data: Record<string, unknown>;
}

export function isAssistant(content: CopilotMessage["content"]): content is AssistantContent {
  return typeof content === "object" && content !== null && "status" in content && "refs" in content;
}

export function isEvent(content: CopilotMessage["content"]): content is EventContent {
  return typeof content === "object" && content !== null && "kind" in content && "message" in content;
}

export function isRedacted(content: CopilotMessage["content"]): content is RedactedContent {
  return typeof content === "object" && content !== null && "redacted" in content;
}
