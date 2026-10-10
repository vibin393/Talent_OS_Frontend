/** Client Portal content types (Epic 18). Hand-written mirrors of `app/schemas/*_portal.py` (client_user). */

export type ClientDemandSummary = {
  id: string;
  req_id: string;
  title: string;
  positions: number;
  status: string;
  location: string | null;
  start_date: string | null;
  sent_submissions: number;
  requested_by_me: boolean;
  requested_via_portal: boolean;
  created_at: string;
};

export type ClientDemandRequestIn = {
  title: string;
  positions: number;
  skills: string[];
  location: string | null;
  start_date: string | null;
  budget_amount: string | null;
  budget_currency: string | null;
  budget_unit: "hour" | "day" | "month" | "year" | null;
  description: string | null;
};

export type ClientDemandRequestOut = { id: string; req_id: string; title: string; status: string; source: "client_portal"; jd_attached: boolean };

export type SlotOut = { starts_at: string; ends_at: string; tz: string };
export type SlotIn = SlotOut;

export type ClientSlotProposalOut = {
  id: string;
  kind: "client_proposed" | "recruiter_offered";
  status: "open" | "chosen" | "scheduled" | "declined" | "expired";
  slots: SlotOut[];
  chosen_index: number | null;
  created_at: string;
};

export type FeedbackDecision = "interested" | "rejected" | "on_hold";

export type ClientSubmissionOut = {
  id: string;
  human_id: string;
  demand_id: string;
  demand_title: string | null;
  candidate_display_name: string;
  headline: string | null;
  experience_months: number | null;
  availability_days: number | null;
  bill_rate: string;
  currency: string;
  rate_unit: string;
  recruiter_summary: string | null;
  has_resume: boolean;
  sent_at: string | null;
  feedback_status: string;
  latest_feedback: { decision: string; comment: string | null; received_at: string } | null;
  interview_status: string | null;
  slot_proposals: ClientSlotProposalOut[];
};

export type ClientCompareOut = { demand_id: string; items: ClientSubmissionOut[] };

export type ClientScorecardItem = {
  participant_id: string;
  interview_id: string;
  candidate_display_name: string;
  demand_title: string | null;
  stage_name: string | null;
  starts_at: string;
  state: "open" | "not_started" | "submitted";
};

export type SummaryField = { label: string; value: string | null };

export type ApprovalItemOut = {
  request_id: string;
  kind: string;
  subject_id: string;
  title: string;
  subtitle: string | null;
  submitted_at: string | null;
  acting_for_id: string | null;
  acting_for_name: string | null;
  decide_via: "generic" | "subject_endpoint";
  link: string | null;
};

export type ApprovalKindOut = { kind: string; label: string; count: number; items: ApprovalItemOut[] };
export type ApprovalsHubOut = { total: number; kinds: ApprovalKindOut[] };
export type ApprovalDetailOut = { item: ApprovalItemOut; fields: SummaryField[]; status: string };

export type DelegationOut = {
  id: string;
  client_user_id: string;
  client_user_name: string | null;
  delegate_client_user_id: string;
  delegate_name: string | null;
  starts_on: string;
  ends_on: string;
  revoked_at: string | null;
  state: "current" | "future" | "past" | "revoked";
  mine: boolean;
};

export type ColleagueOut = { id: string; display_name: string };

export type ClientPlacementOut = {
  id: string;
  human_id: string;
  worker_name: string;
  role_title: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  ending_soon: boolean;
  timesheet_status: string | null;
  pending_actions: string[];
};

export type ClientPlacementDetail = ClientPlacementOut & {
  work_location_text: string | null;
  timesheets: { id: string; period_start: string; period_end: string; status: string }[];
};

export type ClientPoConsumptionOut = {
  po_number: string;
  currency: string;
  value_cap: string | null;
  hours_cap: string | null;
  consumed_amount: string;
  consumed_hours: string;
  remaining_amount: string | null;
  remaining_hours: string | null;
  valid_to: string;
};

export type CompliancePackOut = {
  id: string;
  period_month: string;
  title: string;
  published_at: string | null;
  items: { id: string; label: string }[];
};

export type ClientHomeOut = {
  display_name: string;
  approvals_pending: number | null;
  new_submissions: number | null;
  upcoming_interview_dates: string[] | null;
  team: { size: number; ending_within_30_days: number } | null;
  invoices_issued: number | null;
};

export type ClientApprovalLinkView = {
  kind: string;
  status: string;
  title: string;
  subtitle: string | null;
  fields: SummaryField[];
  tenant_name: string | null;
  expires_at: string;
};
