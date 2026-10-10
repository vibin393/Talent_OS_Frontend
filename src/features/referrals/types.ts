/**
 * Employee Referrals (Epic 42) -- hand-written API types (the generated schema predates these endpoints).
 * Money is a Decimal serialised as a string.
 */

// ---------------------------------------------------------------- referrer-safe (self-service + worker portal)
export type ReferrerStatusLabel = "Received" | "In process" | "Hired" | "Not selected";
export type RewardStatusLabel = "Pending" | "Eligible" | "Approved" | "Paid" | "Not payable";

export type ReferrerRewardOut = { status_label: RewardStatusLabel; amount: string | null; currency: string | null };

export type ReferrerReferralOut = {
  id: string;
  human_id: string;
  referee_name: string | null;
  demand_title: string | null;
  submitted_at: string;
  status_label: ReferrerStatusLabel;
  can_withdraw: boolean;
  reward: ReferrerRewardOut | null;
};

export type ReferrerOpeningOut = {
  demand_id: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  work_mode: string | null;
  client_name: string | null;
  reward_amount: string | null;
  reward_currency: string | null;
};

export type ReferrerShareLinkOut = { url: string; demand_id: string | null; expires_at: string };

/** Fields of the multipart refer form (`POST /me/referrals`, `POST /portal/work/referrals`). */
export type ReferIn = {
  referee_name: string;
  referee_email: string;
  demand_id?: string | null;
  referee_phone?: string | null;
  relationship?: string | null;
  note?: string | null;
  resume: File;
};

// ---------------------------------------------------------------- internal
export type ReferralStatus =
  | "submitted"
  | "accepted"
  | "in_process"
  | "hired"
  | "not_selected"
  | "duplicate"
  | "declined"
  | "expired"
  | "withdrawn";

export type ReferralChannel = "upload" | "share_link";
export type ReferrerKind = "user" | "worker";
export type IneligibleReason = "duplicate" | "excluded_referrer" | "no_program" | "self_referral";
export type RewardStatus = "pending_condition" | "eligible" | "approved" | "paid" | "void";
export type PayoutChannel = "payroll" | "payout_export";
export type EligibleReferrers = "users" | "workers" | "both";
export type SeniorityLevel = "junior" | "mid" | "senior";

export type RewardOut = {
  id: string;
  referral_id: string;
  referral_human_id: string;
  referee_name: string | null;
  referrer_kind: ReferrerKind;
  referrer_name: string | null;
  program_id: string;
  placement_id: string;
  status: RewardStatus;
  amount: string;
  currency: string;
  condition_due_on: string | null;
  eligible_at: string | null;
  approval_request_id: string | null;
  approved_at: string | null;
  payout_channel: PayoutChannel;
  payee_placement_id: string | null;
  paid_at: string | null;
  payout_ref: string | null;
  void_reason: string | null;
  created_at: string;
};

export type ReferralOut = {
  id: string;
  human_id: string;
  status: ReferralStatus;
  channel: ReferralChannel;
  demand_id: string | null;
  demand_title: string | null;
  program_id: string | null;
  program_name: string | null;
  referrer_kind: ReferrerKind;
  referrer_user_id: string | null;
  referrer_candidate_id: string | null;
  referrer_name: string | null;
  referee_name: string | null;
  referee_email: string | null;
  referee_phone: string | null;
  relationship: string | null;
  note: string | null;
  has_resume: boolean;
  candidate_id: string | null;
  application_id: string | null;
  placement_id: string | null;
  reward_eligible: boolean;
  ineligible_reason: IneligibleReason | null;
  accepted_at: string | null;
  decided_at: string | null;
  created_at: string;
  reward: RewardOut | null;
};

export type ReferralPage = { items: ReferralOut[]; total: number };

export type CandidateReferralOut = {
  referral_id: string;
  human_id: string;
  referrer_name: string | null;
  referrer_kind: ReferrerKind;
  status: ReferralStatus;
  created_at: string;
};

export type RewardMatch = { seniority_level?: SeniorityLevel | null; demand_id?: string | null; employment_type?: string | null };
export type RewardRule = { match: RewardMatch; amount: string; currency: string };

export type EligibleDemands = {
  all: boolean;
  client_ids: string[];
  demand_ids: string[];
  employment_types: string[];
  seniority_levels: SeniorityLevel[];
};

export type Exclusions = { assigned_recruiters: boolean; demand_owner: boolean; excluded_role_keys: string[] };

export type ProgramIn = {
  name: string;
  active: boolean;
  valid_from: string;
  valid_to: string | null;
  eligible_referrers: EligibleReferrers;
  eligible_demands: EligibleDemands;
  reward_rules: RewardRule[];
  default_amount: string | null;
  currency: string;
  joining_condition_days: number;
  exclusions: Exclusions;
  priority: number;
};

export type ProgramOut = ProgramIn & { id: string; archived_at: string | null; created_at: string; updated_at: string };

export type ReferralSettings = {
  duplicate_activity_months: number;
  referee_link_days: number;
  share_link_days: number;
  default_owner_user_id: string | null;
  payout_export_currency_default: string;
};

export type MarkPaidIn = { ids: string[]; paid_on: string; payout_ref: string };

// ---------------------------------------------------------------- public referee page
export type PublicReferralNotice = { notice_id: string | null; version: number | null; title: string; body_md: string };

export type PublicReferralView = {
  mode: "accept" | "submit";
  status: "open" | "answered" | string;
  tenant_name: string | null;
  job_title: string | null;
  general: boolean;
  referrer_first_name: string | null;
  referee_first_name: string | null;
  notice: PublicReferralNotice;
  expires_at: string;
  /** Optional bot challenge config (not sent today; the widget renders only when present). */
  challenge?: { provider: string; site_key: string } | null;
};

export type PublicReferralOut = { status: "accepted" | "declined" | "received" | string };
