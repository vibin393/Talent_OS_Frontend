/** Epic 35 B1: retention classes, bindings and class expiry (`/api/v1/privacy/retention/*`). Hand-written. */

export type RetentionAnchor = "document_date" | "fy_end" | "adjudicated_at" | "signed_at" | "placement_end" | "period_end";
export type ExpiryAction = "anonymize" | "delete" | "report_only";

export type RetentionClass = {
  id: string;
  key: string;
  label: string;
  period_months: number;
  anchor: RetentionAnchor;
  expiry_action: ExpiryAction;
  is_system: boolean;
  floor_months: number | null;
  auto_execute: boolean;
  archived_at: string | null;
};

export type RetentionClassCreate = {
  key: string;
  label: string;
  period_months: number;
  anchor: RetentionAnchor;
  expiry_action: ExpiryAction;
  auto_execute: boolean;
};

export type RetentionClassUpdate = Partial<Pick<RetentionClass, "label" | "period_months" | "expiry_action" | "auto_execute">>;

export type RetentionBinding = {
  table: string;
  class_key: string;
  status: "registered" | "pending";
  owner_epic: string | null;
};

export type ClassExpiryTableCount = { table: string; count: number; skipped_legal_hold: number; skipped_override: number };

export type ClassExpiryPreview = {
  run_id: string | null;
  class_key: string;
  report_only: boolean;
  reason: string | null;
  total: number;
  by_table: ClassExpiryTableCount[];
  valid_until: string | null;
};

/** Epic 35 B2: what a DSR erasure kept, and why (`erasure run.retained_summary`). */
export type RetainedSummaryRow = {
  class: string;
  table: string;
  count: number;
  retained_until: string | null;
  reason: string;
};

/** Epic 35: the kinds of data subject a DSR can be raised for. */
export type DsrSubjectKind = "candidate" | "contact" | "client_user" | "vendor_user";
