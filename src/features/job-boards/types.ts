// Epic 70: hand-written DTOs (mirror app/schemas/job_distribution.py).
export type BoardStatus =
  | "draft"
  | "publishing"
  | "live"
  | "expiring"
  | "expired"
  | "closed"
  | "failed"
  | "abandoned"
  | "rejected";

export type BoardPostingOut = {
  id: string;
  human_id: string;
  demand_id: string;
  posting_id: string;
  installation_id: string;
  board_key: string;
  board_label: string;
  status: BoardStatus;
  revision: number;
  local_revision: number;
  out_of_date: boolean;
  board_ref: string | null;
  board_url: string | null;
  expires_at: string | null;
  views: number | null;
  applies_reported: number | null;
  blocked_fields: string[];
  last_status_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  manual: boolean;
  published_by: string | null;
  published_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  cost_note: string | null;
};

export type BoardFieldOut = {
  key: string;
  label: string;
  required: boolean;
  kind: string;
  options: { value: string; label: string }[];
};

export type BoardPreviewOut = {
  board_key: string;
  label: string;
  installation_id: string | null;
  title: string;
  company: string | null;
  location: string | null;
  experience: string | null;
  salary: string | null;
  apply_url: string;
  description_excerpt: string;
  fields: BoardFieldOut[];
  values: Record<string, unknown>;
  blocked_fields: string[];
  blocked_labels: string[];
  credits_left: number | null;
  will_publish: boolean;
};

export type MultiPostPreviewOut = {
  demand_id: string;
  posting_id: string;
  bias_matches: { term: string; category?: string }[];
  boards: BoardPreviewOut[];
};

export type MultiPostIn = {
  board_keys?: string[] | null;
  board_set_id?: string | null;
  board_fields: Record<string, Record<string, unknown>>;
};

export type PublishOut = { published: BoardPostingOut[]; blocked: BoardPreviewOut[] };

export type PackOut = {
  board_key: string;
  title: string;
  description_text: string;
  description_html: string;
  fields: { label: string; value: string }[];
  apply_url: string;
};

export type RecordIn = { board_ref: string; board_url?: string | null; posted_on: string; expires_on?: string | null };

export type JobBoardSettings = {
  expiry_warning_days: number;
  applicant_digest: boolean;
  auto_close_on_demand_change: boolean;
  default_board_set_id: string | null;
};

export type BoardSetOut = {
  id: string;
  name: string;
  employment_type: string | null;
  board_keys: string[];
  is_default: boolean;
};

export type MappingOut = {
  id?: string;
  board_key?: string;
  kind: string;
  local_value: string;
  board_value: string;
  board_label?: string | null;
};

export type FeedSettings = {
  enabled: boolean;
  include_salary: boolean;
  company_name_mode: "tenant" | "client";
  feed_url: string;
};

export type BoardReportLine = {
  board_posting_id: string;
  human_id: string;
  demand_id: string;
  title: string;
  status: string;
  applications: number;
  submissions: number;
  interviews: number;
  offers: number;
  placements: number;
  cost_note: string | null;
};

export type BoardReportRow = {
  board_key: string;
  label: string;
  postings: number;
  applications: number;
  submissions: number;
  interviews: number;
  offers: number;
  placements: number;
  cost_note: string | null;
  rows: BoardReportLine[];
};
