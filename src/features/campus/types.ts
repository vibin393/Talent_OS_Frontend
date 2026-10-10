/**
 * Hand-written DTOs of Epic 43 (Campus hiring & recruitment events): `app/schemas/campus.py` (internal
 * `/api/v1/campus/*`) and `app/schemas/campus_public.py` (public `/api/v1/public/campus/*`).
 * Decimals arrive as strings (AD-12). Do not regenerate from the OpenAPI schema.
 */

export type Tier = "tier_1" | "tier_2" | "tier_3" | "other";
export type InstitutionStatus = "active" | "archived";
export type DriveStatus = "draft" | "registration_open" | "in_progress" | "closed" | "cancelled";
export type RegistrationStatus =
  | "registered"
  | "eligible"
  | "not_eligible"
  | "assessed"
  | "shortlisted"
  | "interviewed"
  | "offered"
  | "joined"
  | "reneged"
  | "rejected"
  | "withdrawn";
export type RegistrationSource = "link" | "import" | "walk_in";
export type FieldKind = "text" | "number" | "decimal" | "select" | "multiselect" | "date" | "bool" | "file";
export type BatchStatus = "draft" | "scheduled" | "completed" | "cancelled";

// ---------------------------------------------------------------- settings
export type CampusSettings = {
  register_ip_limit: number;
  register_drive_limit: number;
  avg_interview_minutes: number;
  poster_footer: string | null;
};

// ---------------------------------------------------------------- institutions
export type Program = { name: string; branches: string[] };

export type InstitutionIn = {
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string;
  tier?: Tier;
  programs?: Program[];
  website?: string | null;
  notes?: string | null;
};

export type InstitutionPatch = Partial<InstitutionIn> & { status?: InstitutionStatus };

export type ContactIn = {
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
};

export type ContactPatch = Partial<ContactIn>;

export type ContactOut = {
  id: string;
  institution_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  archived_at: string | null;
};

export type InstitutionOut = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  tier: Tier;
  programs: Program[];
  website: string | null;
  status: InstitutionStatus;
  notes: string | null;
  contact_count: number;
  primary_contact_name: string | null;
  created_at: string;
  updated_at: string;
};

export type InstitutionDetailOut = InstitutionOut & { contacts: ContactOut[] };

export type InstitutionFilters = { q?: string; status?: InstitutionStatus; tier?: Tier };

// ---------------------------------------------------------------- forms
export type FormField = {
  key: string;
  label: string;
  type: FieldKind;
  required?: boolean;
  options?: string[] | null;
  /** Decimal as string (or number when typed in the builder). */
  min?: string | number | null;
  max?: string | number | null;
  help?: string | null;
  standard?: boolean;
};

export type FormSchema = { fields: FormField[] };

// ---------------------------------------------------------------- drives
export type DateWindow = { from?: string | null; to?: string | null } & Record<string, unknown>;

export type DriveIn = {
  name: string;
  batch_year: number;
  owner_id?: string | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  assessment_window?: DateWindow | null;
  interview_window?: DateWindow | null;
  form_schema?: FormSchema | null;
  assessment_id?: string | null;
  interview_stage_template_id?: string | null;
  offer_template_id?: string | null;
  notes?: string | null;
};

export type DrivePatch = Partial<DriveIn>;

export type DriveInstitutionOut = {
  id: string;
  institution_id: string;
  institution_name: string;
  status: "active" | "paused";
  registration_cap: number | null;
  registration_url: string | null;
  link_expires_at: string | null;
  link_active: boolean;
  has_qr: boolean;
  registration_count: number;
};

export type DemandRef = { id: string; title: string; req_id?: string | null; status?: string | null };

export type DriveOut = {
  id: string;
  name: string;
  batch_year: number;
  status: DriveStatus;
  owner_id: string;
  owner_name: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  assessment_window: DateWindow | null;
  interview_window: DateWindow | null;
  form_schema: Partial<FormSchema> & Record<string, unknown>;
  /** Full AD-42 definition `{definition_version, source, filters}`; the rule tree is `.filters`. */
  eligibility_definition: { definition_version?: number; source?: string; filters?: unknown } | null;
  eligibility_revision: number;
  assessment_id: string | null;
  assessment_name?: string | null;
  interview_stage_template_id: string | null;
  offer_template_id: string | null;
  notes: string | null;
  cancel_reason: string | null;
  institutions: DriveInstitutionOut[];
  demands: DemandRef[];
  status_counts: Record<string, number>;
  created_at: string;
  updated_at: string;
};

export type DriveListItem = {
  id: string;
  name: string;
  batch_year: number;
  status: DriveStatus;
  owner_id: string;
  owner_name: string | null;
  registration_closes_at: string | null;
  institution_count: number;
  registration_count: number;
  created_at: string;
};

// ---------------------------------------------------------------- registrations
export type FailingRule = { index: number; field: string | null; op: string | null; value?: unknown; label: string };

export type EligibilityOut = {
  eligible: boolean;
  failing_rule?: FailingRule | null;
  evaluated_at?: string | null;
  definition_version?: number | null;
  revision?: number | null;
};

export type RegistrationOut = {
  id: string;
  drive_id: string;
  institution_id: string;
  institution_name: string | null;
  candidate_id: string;
  candidate_name: string | null;
  candidate_email: string | null;
  status: RegistrationStatus;
  source: RegistrationSource;
  program: string | null;
  branch: string | null;
  cgpa: string | null;
  percentage: string | null;
  backlogs: number | null;
  graduation_year: number | null;
  answers: Record<string, unknown>;
  eligibility: EligibilityOut | null;
  overridden: boolean;
  override_reason: string | null;
  override_at: string | null;
  assessment_invitation_id: string | null;
  assessment_status?: string | null;
  assessment_flag: string | null;
  score: string | null;
  application_id: string | null;
  offer_id: string | null;
  offer_status?: string | null;
  planned_joining_date: string | null;
  registered_at: string;
  eligible_at: string | null;
  assessed_at: string | null;
  shortlisted_at: string | null;
  interviewed_at: string | null;
  offered_at: string | null;
  accepted_at: string | null;
  joined_at: string | null;
  reneged_at: string | null;
  rejected_at: string | null;
  withdrawn_at: string | null;
};

export type RegistrationPage = { items: RegistrationOut[]; total: number; limit: number; offset: number };

export type RegistrationFilters = {
  status?: RegistrationStatus[];
  institution_id?: string | null;
  q?: string;
  flagged?: boolean | null;
};

// ---------------------------------------------------------------- import
export type ImportRowOut = { row: number; email: string | null; name: string | null; errors: string[] };
export type ImportPreviewOut = {
  batch_id: string;
  drive_institution_id: string;
  row_count: number;
  error_count: number;
  rows: ImportRowOut[];
};
export type ImportApplyOut = { batch_id: string; sent: number; skipped: number };

// ---------------------------------------------------------------- assessments / shortlist
export type ItemError = { id: string; code: string; message?: string | null };
export type InviteIn = { registration_ids?: string[] | null; deadline_at: string };
export type InviteOut = { invited: number; skipped: number; batches: number; errors: ItemError[] };

export type ProposeIn = { mode: "top_n" | "min_score"; value: string; per_demand?: boolean };
export type ProposalItem = {
  registration_id: string;
  candidate_id: string;
  candidate_name: string | null;
  institution_name: string | null;
  score: string | null;
  tie: boolean;
};
export type ProposalOut = { mode: string; value: string; cutoff: string | null; count: number; ties: number; items: ProposalItem[] };
export type ConfirmIn = { registration_ids: string[]; demand_id: string };
export type ConfirmResult = { registration_id: string; application_id?: string | null; error?: string | null };
export type ConfirmOut = { shortlisted: number; results: ConfirmResult[] };

// ---------------------------------------------------------------- batches
export type Panel = { label: string; interviewer_user_ids: string[]; room?: string | null; video_link?: string | null };
export type BatchIn = {
  demand_id: string;
  date: string;
  start_time: string;
  end_time: string;
  timezone?: string;
  slot_minutes?: number;
  panels: Panel[];
  send_sms?: boolean;
};
export type SlotOut = {
  id: string;
  panel_index: number;
  starts_at: string;
  ends_at: string;
  registration_id: string | null;
  candidate_name: string | null;
  interview_id: string | null;
};
export type BatchOut = {
  id: string;
  drive_id: string;
  demand_id: string;
  demand_title: string | null;
  date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  slot_minutes: number;
  panels: Panel[];
  status: BatchStatus;
  send_sms: boolean;
  slot_count: number;
  filled_count: number;
  slots: SlotOut[];
};
export type AutoSlotOut = { batch: BatchOut; slotted: number; unslotted: number; errors: ItemError[] };

// ---------------------------------------------------------------- offers / funnel
export type OfferOverrides = {
  pay_rate?: string | null;
  pay_rate_unit?: "hour" | "day" | "month" | "year" | null;
  employment_type?: string | null;
  expiry_date?: string | null;
  location?: string | null;
};
export type BulkOffersIn = { registration_ids: string[]; planned_joining_date: string; overrides?: OfferOverrides | null };
export type BulkOfferItemOut = {
  registration_id: string;
  offer_id?: string | null;
  offer_status?: string | null;
  error_code?: string | null;
  message?: string | null;
};
export type BulkOffersOut = { created: number; failed: number; results: BulkOfferItemOut[] };

export type JoiningRow = {
  registration_id: string;
  candidate_id: string;
  candidate_name: string | null;
  institution_name: string | null;
  status: RegistrationStatus;
  offer_id: string | null;
  offer_status: string | null;
  planned_joining_date: string | null;
  placement_id?: string | null;
  placement_status?: string | null;
  accepted_at: string | null;
  joined_at: string | null;
  reneged_at: string | null;
};

export const FUNNEL_STAGES = [
  "registered",
  "eligible",
  "assessed",
  "shortlisted",
  "interviewed",
  "offered",
  "accepted",
  "joined",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export type FunnelRow = { institution_id: string; institution_name: string; reneged: number } & Record<FunnelStage, number>;
export type FunnelOut = { drive_id: string | null; stages: string[]; rows: FunnelRow[]; totals: FunnelRow };

// ---------------------------------------------------------------- public pages
export type PublicNotice = { notice_id: string | null; version: number | null; title: string; body_md: string };

export type PublicFormField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[] | null;
  min?: string | null;
  max?: string | null;
  help?: string | null;
};

/** Bot challenge config: not in the current contract; rendered only when the server sends it (as on referrals). */
export type PublicChallenge = { provider: string; site_key: string } | null;

export type PublicDriveView = {
  status: "open" | "closed";
  tenant_name: string | null;
  drive_name: string;
  institution_name: string;
  batch_year: number;
  closes_at: string | null;
  fields: PublicFormField[];
  branches_by_program: Record<string, string[]>;
  notice: PublicNotice;
  marketing_notice: PublicNotice | null;
  prefill?: Record<string, unknown>;
  challenge?: PublicChallenge;
};

export type PublicRegisterIn = {
  full_name: string;
  email: string;
  phone?: string | null;
  answers: Record<string, unknown>;
  notice_id?: string | null;
  agreed: boolean;
  marketing_opt_in: boolean;
  bot_token?: string | null;
};

export type PublicRegisterOut = { status: "registered" | "already_registered" };

export type PublicEventView = {
  mode: "register" | "pass";
  status: "open" | "closed";
  tenant_name: string | null;
  event_name: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue: string | null;
  video_link: string | null;
  demands: { id: string; title: string }[];
  notice: PublicNotice | null;
  marketing_notice: PublicNotice | null;
  whatsapp_opt_in: boolean;
  candidate_first_name?: string | null;
  checkin_url?: string | null;
  qr_svg?: string | null;
  challenge?: PublicChallenge;
};

export type PublicEventRegisterIn = {
  full_name: string;
  email: string;
  phone?: string | null;
  demand_id?: string | null;
  notice_id?: string | null;
  agreed: boolean;
  marketing_opt_in: boolean;
  whatsapp_opt_in: boolean;
  bot_token?: string | null;
};

export type PublicEventRegisterOut = {
  status: "registered" | "already_registered";
  checkin_url?: string | null;
  qr_svg?: string | null;
};
