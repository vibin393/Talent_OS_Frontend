/**
 * Vendor Portal API types (Epic 17), hand-written to mirror `Backend/app/schemas/vendors_portal.py`.
 * The portal never receives bill rates, margins, client feedback, candidate ids or other vendors' data (FR-80).
 */

export type PortalReleaseOut = {
  id: string;
  human_id: string;
  status: "active" | "paused" | "withdrawn" | "closed";
  title: string;
  positions: number;
  skills: string[];
  location: string | null;
  employment_type: string | null;
  experience_range: string | null;
  jd_public_text: string | null;
  client_name: string;
  max_vendor_rate: string | null;
  rate_unit: string | null;
  currency: string;
  submission_limit: number | null;
  submissions_used: number;
  remaining_slots: number | null;
  deadline_at: string | null;
  instructions: string | null;
  released_at: string;
};

export type PortalTimelineItem = { label: string; at: string };

export type PortalSubmissionOut = {
  id: string;
  human_id: string;
  release_id: string;
  release_title: string | null;
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
  status: "submitted" | "under_review" | "accepted" | "rejected" | "duplicate" | "withdrawn";
  label: string;
  outcome_category: string | null;
  next_interview_at: string | null;
  placed: boolean;
  resume_file_id: string | null;
  resume_locked: boolean;
  created_at: string;
  timeline: PortalTimelineItem[];
};

export type PortalPlacementOut = {
  id: string;
  human_id: string;
  worker_name: string | null;
  role_title: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
};

export type PortalDocumentOut = {
  id: string;
  category: string;
  title: string;
  expires_on: string | null;
  status: "valid" | "expiring" | "expired" | "no_expiry";
  pending_review: boolean;
  file_id: string | null;
  created_at: string;
};

export type PortalStatementOut = {
  id: string;
  human_id: string;
  period_start: string;
  period_end: string;
  status: string;
  currency: string;
  total_amount: string;
  finalized_at: string | null;
};

export type PortalDashboardOut = {
  vendor_name: string;
  vendor_status: string;
  open_releases: number;
  submissions_by_label: { label: string; count: number }[];
  upcoming_interviews: { submission_id: string; full_name: string | null; at: string }[];
  active_placements: number;
  can_operate: boolean;
};

export type PortalScorecardOut = {
  period_from: string;
  period_to: string;
  releases_received: number;
  submissions: number;
  acceptance_pct: string | null;
  duplicate_pct: string | null;
  submission_to_interview_pct: string | null;
  interview_to_offer_pct: string | null;
  placements: number;
  median_hours_to_first_submission: string | null;
};

/** Epic 14 portal permissions (`me.portal_permissions`). */
export type PortalPermission =
  | "releases:view"
  | "submissions:create"
  | "placements:view"
  | "documents:manage"
  | "statements:view"
  | "users:manage";
