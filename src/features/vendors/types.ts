/**
 * Vendors API types (Epic 17), hand-written to mirror `Backend/app/schemas/vendors.py`.
 * Money / rate fields are Decimal strings (AD-12); ids are UUID strings; dates are ISO strings.
 */

export type VendorStatus = "prospective" | "onboarding" | "active" | "suspended" | "inactive";
export type VendorTier = "gold" | "silver" | "bronze" | "custom";
export type DocCategory = "agreement" | "insurance" | "registration" | "other";
export type DocStatus = "valid" | "expiring" | "expired" | "no_expiry";
export type RateUnit = "hour" | "day" | "month" | "year" | "fixed";
export type SubmissionStatus = "submitted" | "under_review" | "accepted" | "rejected" | "duplicate" | "withdrawn";
export type DuplicateCategory = "owned_by_other_vendor" | "existing_candidate" | "submitted_by_other_vendor" | "other";

export type Contact = { name?: string; email?: string; phone?: string };

export type VendorOut = {
  id: string;
  human_id: string;
  legal_name: string;
  status: VendorStatus;
  tier: string | null;
  pan_last4: string | null;
  address: Record<string, unknown>;
  primary_contact: Contact;
  services: string[];
  skill_ids: string[];
  regions: string[];
  owner_id: string | null;
  suspended_reason: string | null;
  inactive_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type GstinOut = { id: string; gstin: string; state_code: string };
export type BankAccountOut = {
  id: string;
  account_name: string;
  account_no_last4: string;
  ifsc: string;
  is_primary: boolean;
  status: string;
  approval_request_id: string | null;
};

export type VendorDetailOut = VendorOut & {
  gstins: GstinOut[];
  bank_accounts: BankAccountOut[];
  activation_blockers: string[];
  agreement_active: boolean;
};

export type VendorCreate = {
  legal_name: string;
  pan?: string | null;
  tier?: VendorTier | null;
  primary_contact?: Contact;
  services?: string[];
  regions?: string[];
};
export type VendorUpdate = Partial<VendorCreate>;

export type VendorDocumentOut = {
  id: string;
  human_id: string;
  category: string;
  title: string;
  expires_on: string | null;
  status: DocStatus;
  current_version_id: string | null;
  pending_review: boolean;
  created_at: string;
};

export type VendorSettingsOut = {
  ownership_window_days: number;
  duplicate_activity_months: number;
  suspension_grace_days: number;
  mandatory_document_kinds: string[];
  scorecard_visible_to_vendor: boolean;
  vendor_labels: Record<string, string>;
  notice_link_days: number;
  require_bench_review_for_vendor_release: boolean;
};
export type VendorSettingsUpdate = Partial<VendorSettingsOut>;

export type ReleaseCreate = {
  vendor_ids?: string[];
  tier?: VendorTier | null;
  reveal_client?: boolean;
  max_vendor_rate?: string | null;
  rate_unit?: RateUnit | null;
  submission_limit?: number | null;
  deadline_at?: string | null;
  instructions?: string | null;
};

export type ReleaseOut = {
  id: string;
  human_id: string;
  demand_id: string;
  vendor_id: string;
  vendor_name: string | null;
  status: "active" | "paused" | "withdrawn" | "closed";
  reveal_client: boolean;
  max_vendor_rate: string | null;
  rate_unit: string | null;
  currency: string;
  submission_limit: number | null;
  submissions_count: number;
  deadline_at: string | null;
  instructions: string | null;
  released_at: string;
  paused_by_system: boolean;
  title: string;
};

export type ReleaseItemResult = {
  vendor_id: string;
  status: "released" | "skipped";
  reason: string | null;
  release: ReleaseOut | null;
};
export type ReleaseBatchOut = { items: ReleaseItemResult[] };

export type DuplicateFinding = {
  rule: string;
  category: DuplicateCategory;
  detail: string;
  candidate_id: string | null;
  vendor_id: string | null;
  submission_id: string | null;
};

export type MarginPreviewOut = {
  bill_rate: string | null;
  pay_rate: string;
  margin_amount: string | null;
  margin_pct: string | null;
  currency: string;
};

export type VendorSubmissionOut = {
  id: string;
  human_id: string;
  vendor_release_id: string;
  vendor_id: string;
  vendor_name: string | null;
  demand_id: string;
  demand_title: string | null;
  client_id: string;
  full_name: string | null;
  email: string | null;
  phone_e164: string | null;
  current_location: string | null;
  total_experience_months: number | null;
  availability_date: string | null;
  notice_period_days: number | null;
  vendor_rate: string;
  rate_unit: string | null;
  currency: string;
  max_vendor_rate: string | null;
  status: SubmissionStatus;
  duplicate_reason_category: DuplicateCategory | null;
  reject_reason_code: string | null;
  reason_text_internal: string | null;
  duplicate_findings: DuplicateFinding[];
  candidate_id: string | null;
  application_id: string | null;
  progress_label: string | null;
  resume_file_id: string | null;
  notice_consent: string | null;
  margin: MarginPreviewOut | null;
  review_due_at: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type AcceptIn = {
  link_candidate_id?: string | null;
  create?: boolean;
  override_duplicate_rule?: boolean;
  reason?: string | null;
};
export type RejectIn = { reason_code: string; note?: string | null };
export type MarkDuplicateIn = { category: DuplicateCategory; note?: string | null };

export type VendorScorecard = {
  vendor_id: string;
  vendor_name: string | null;
  period_from: string;
  period_to: string;
  releases_received: number;
  submissions: number;
  accepted: number;
  acceptance_pct: string | null;
  duplicates: number;
  duplicate_pct: string | null;
  interviews: number;
  submission_to_interview_pct: string | null;
  offers: number;
  interview_to_offer_pct: string | null;
  placements: number;
  median_hours_to_first_submission: string | null;
  sla_breaches: number;
  early_exits: number;
};

export type StatementStatus = "draft" | "finalized" | "superseded";
export type StatementOut = {
  id: string;
  human_id: string;
  vendor_id: string;
  vendor_name: string | null;
  legal_entity_id: string;
  period_start: string;
  period_end: string;
  status: StatementStatus;
  currency: string;
  total_amount: string;
  content_hash: string | null;
  finalized_at: string | null;
  line_count: number;
  created_at: string;
};
export type StatementLineOut = {
  id: string;
  line_kind: "time" | "expense" | "adjustment";
  source_kind: string;
  source_id: string;
  placement_id: string | null;
  worker_name_snapshot: string | null;
  work_date: string;
  time_category: string | null;
  quantity: string;
  vendor_rate: string | null;
  multiplier: string;
  amount: string;
  currency: string;
};
export type StatementDetailOut = StatementOut & { lines: StatementLineOut[] };
export type StatementBuildIn = {
  vendor_ids?: string[] | null;
  all?: boolean;
  legal_entity_id: string;
  period_start: string;
  period_end: string;
};
export type StatementBuildOut = { statements: StatementOut[]; skipped: { vendor_id: string; reason: string }[] };
