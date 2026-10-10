/** Epic 64 Analytics Agent DTOs (hand-mirrored from `app/schemas/analytics_answers.py`; no gen:api). */
import type { Definition, VizSpec } from "@/features/report-builder/types";

export type AnswerStatus = "ok" | "needs_repair";

export type AnswerOut = {
  id: string;
  question: string;
  assumptions: string[];
  source_key: string;
  source_label: string | null;
  definition: Definition;
  definition_version: number;
  viz: VizSpec;
  explanation: string;
  masked_fields: string[];
  row_count: number | null;
  truncated: boolean;
  limit_kind: "row_cap" | "timeout" | null;
  suppressed_cells: number;
  min_cell_size: number | null;
  status: AnswerStatus;
  saved_report_id: string | null;
  saved_report_name: string | null;
  conversation_id: string | null;
  run_id: string | null;
  created_at: string;
  expires_at: string;
};

export type AnswerSummaryOut = {
  id: string;
  question: string;
  source_key: string;
  source_label: string | null;
  status: AnswerStatus;
  row_count: number | null;
  saved_report_id: string | null;
  conversation_id: string | null;
  run_id: string | null;
  created_at: string;
};

export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

/** Epic 54 Copilot surface (subset used by the Ask page until 54's shared conversation components land). */
export type CopilotMode = { agent_key: string; label: string };
export type CopilotStatus = {
  available: boolean;
  reason: "no_permission" | "not_enabled" | "kill_switch" | "global_kill" | "budget_exhausted" | null;
  questions_left_this_hour: number;
  questions_per_hour: number;
  retention_days: number;
  allow_feedback_comments: boolean;
  modes: CopilotMode[];
};
export type ConversationSummary = {
  id: string;
  agent_key: string;
  mode_label: string;
  title: string | null;
  status: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  expires_at: string;
};
export type ConversationMessage = {
  id: string;
  seq: number;
  role: "user" | "assistant" | "event";
  content: { text?: string; status?: string; reason_code?: string; [key: string]: unknown };
  run_id: string | null;
  redacted: boolean;
  created_at: string;
};
export type TurnOut = { message: ConversationMessage; run_id: string | null; stream_url: string | null; status: string; reason: string | null };
