/**
 * SOW & Project Staffing API types (Phase 3 Epic 45), hand-written to mirror `Backend/app/schemas/projects.py`
 * (the generated schema is stale). Money / decimal fields are strings (AD-20); dates are ISO strings.
 */

export type Money = { amount: string; currency: string };

export type ProjectStatus = "draft" | "active" | "on_hold" | "completed" | "cancelled";

export type ProjectOut = {
  id: string;
  human_id: string;
  name: string;
  client_id: string;
  client_name: string | null;
  contract_id: string | null;
  contract_human_id: string | null;
  owner_id: string | null;
  owner_name: string | null;
  business_unit_id: string | null;
  legal_entity_id: string | null;
  currency: string;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  risk_note: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectListItem = ProjectOut & { burn_pct: string | null; risks_count: number };

export type ProjectIn = {
  name: string;
  client_id: string;
  contract_id?: string | null;
  owner_id?: string | null;
  business_unit_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  risk_note?: string | null;
};
export type ProjectUpdate = Partial<Omit<ProjectIn, "client_id">>;

export type ProjectFilters = {
  status?: string;
  client_id?: string;
  contract_id?: string;
  q?: string;
  include_archived?: boolean;
};

// ---------------------------------------------------------------- roles & assignments
export type BillRateUnit = "hour" | "day" | "month" | "fixed";
export type RoleSkill = { skill_key: string; label?: string | null; min_proficiency?: number | null };
export type ProjectRoleIn = {
  title: string;
  headcount: number;
  start_date?: string | null;
  end_date?: string | null;
  skills: RoleSkill[];
  bill_rate?: string | null;
  bill_rate_unit?: BillRateUnit | null;
  notes?: string | null;
};
export type ProjectRoleUpdate = Partial<ProjectRoleIn> & { status?: "open" | "closed" | "cancelled" };
export type ProjectRoleStatus = "open" | "filled" | "closed" | "cancelled";
export type ProjectRoleOut = {
  id: string;
  project_id: string;
  title: string;
  headcount: number;
  status: ProjectRoleStatus;
  start_date: string | null;
  end_date: string | null;
  skills: RoleSkill[];
  bill_rate: string | null;
  bill_rate_unit: BillRateUnit | null;
  notes: string | null;
  filled_fte: string;
  active_assignments: number;
  demand_ids: string[];
};

export type AssignmentIn = { placement_id: string; allocation_pct: string; start_date: string; end_date?: string | null };
export type AssignmentOut = {
  id: string;
  project_id: string;
  project_role_id: string;
  role_title: string | null;
  placement_id: string;
  placement_human_id: string | null;
  candidate_id: string | null;
  worker_name: string | null;
  allocation_pct: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "ended";
  ended_reason: string | null;
  warnings: string[];
};

// ---------------------------------------------------------------- deliverables
export type DeliverableStatus = "planned" | "in_progress" | "submitted" | "accepted" | "rejected" | "cancelled";
export type DeliverableIn = {
  name: string;
  description?: string | null;
  acceptance_criteria?: string | null;
  due_date?: string | null;
  milestone_id?: string | null;
};
export type DeliverableEvent = {
  id: string;
  kind: string;
  actor: string | null;
  reason: string | null;
  evidence_file_id: string | null;
  at: string;
};
export type DeliverableOut = {
  id: string;
  project_id: string;
  milestone_id: string | null;
  milestone_name: string | null;
  name: string;
  description: string | null;
  acceptance_criteria: string | null;
  due_date: string | null;
  status: DeliverableStatus;
  submitted_at: string | null;
  accepted_at: string | null;
  accepted_actor: string | null;
  last_rejection_reason: string | null;
  evidence_file_ids: string[];
  lock_version: number;
  events: DeliverableEvent[];
};

// ---------------------------------------------------------------- milestones / budgets / burn
export type ProjectMilestone = {
  id: string;
  contract_id: string;
  name: string;
  amount: Money;
  due_date: string | null;
  status: "planned" | "accepted" | "cancelled";
  accepted_at: string | null;
  accepted_by: string | null;
  billed: boolean;
};

export type BudgetDimension = "hours" | "cost" | "revenue";
export type BudgetOut = {
  dimension: BudgetDimension;
  amount: string;
  currency: string | null;
  version: number;
  alert_80_at: string | null;
  alert_100_at: string | null;
};
export type BurnOut = {
  dimension: BudgetDimension;
  actual: string;
  budget: string | null;
  pct: string | null;
  burn_rate_per_day: string | null;
  forecast_at_completion: string | null;
  currency: string | null;
  as_of: string | null;
  breakdown: Record<string, unknown> | null;
};

export type RiskKind = "deliverable_overdue" | "role_unfilled" | "over_allocation" | "budget_threshold" | "sow_ending";
export type ProjectRisk = { kind: RiskKind; message: string; ref_id: string | null };

export type ProjectInvoiceRef = {
  kind: "invoice" | "credit_note";
  id: string;
  number: string | null;
  doc_date: string | null;
  status: string;
  amount: Money;
};

export type SowSummary = {
  contract_id: string;
  human_id: string;
  title: string | null;
  pricing_model: string | null;
  total_value: Money | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

export type Project360 = {
  project: ProjectOut;
  sow: SowSummary | null;
  roles: ProjectRoleOut[];
  assignments: AssignmentOut[];
  gap_count: number;
  over_allocation_count: number;
  milestones: ProjectMilestone[];
  deliverables: DeliverableOut[];
  budgets: BudgetOut[];
  burn: BurnOut[];
  invoices: ProjectInvoiceRef[];
  risks: ProjectRisk[];
};

// ---------------------------------------------------------------- resource timeline
export type RoleSegment = { start: string; end: string; assigned_fte: string; headcount: number; gap: boolean };
export type WorkerSplit = { project_id: string; project_name: string; allocation_pct: string };
export type WorkerSegment = { start: string; end: string; total_pct: string; over: boolean; split: WorkerSplit[] };
export type ResourceTimeline = {
  from_date: string;
  to_date: string;
  roles: { project_role_id: string; title: string; headcount: number; segments: RoleSegment[] }[];
  workers: { candidate_id: string; placement_id: string; worker_name: string | null; segments: WorkerSegment[] }[];
  gap_count: number;
  over_allocation_count: number;
};

// ---------------------------------------------------------------- client portal
export type PortalProjectSummary = {
  id: string;
  human_id: string;
  name: string;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  awaiting_acceptance: number;
};
export type PortalProjectDeliverable = {
  id: string;
  project_id: string;
  milestone_id: string | null;
  name: string;
  description: string | null;
  acceptance_criteria: string | null;
  due_date: string | null;
  status: DeliverableStatus;
  submitted_at: string | null;
  accepted_at: string | null;
  last_rejection_reason: string | null;
};
export type PortalProjectDetail = PortalProjectSummary & {
  roles: { id: string; title: string; headcount: number; status: string; start_date: string | null; end_date: string | null; workers: string[] }[];
  milestones: {
    id: string;
    name: string;
    due_date: string | null;
    amount: Money;
    status: string;
    billed: boolean;
    invoice_id: string | null;
    invoice_number: string | null;
  }[];
  deliverables: PortalProjectDeliverable[];
};
