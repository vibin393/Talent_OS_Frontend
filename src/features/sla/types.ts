/**
 * Epic 32 SLA API types. Hand-written mirrors of the backend `app/schemas/sla.py` models (GenericSlaTarget*,
 * SlaMilestoneOut, SlaClockView, SlaSummaryOut) until `npm run gen:api` runs against a backend with Epic 32.
 */

export type SlaClockStatus = "healthy" | "at_risk" | "breached" | "met" | "cancelled";
export type SlaCalendar = "business" | "calendar";
export type SlaPriority = "low" | "medium" | "high" | "critical";

export type SlaMilestoneOut = {
  subject_type: string;
  milestone: string;
  label: string;
  scope_keys: string[];
  calendar: string;
  owner_epic: string | null;
  available: boolean;
};

export type GenericSlaTargetIn = {
  subject_type: string;
  milestone: string;
  scope: Record<string, string>;
  priority: SlaPriority | null;
  target_hours: string;
  at_risk_percent: number;
  calendar: SlaCalendar;
  is_active: boolean;
};

export type GenericSlaTargetUpdate = Partial<Omit<GenericSlaTargetIn, "subject_type" | "milestone">>;

export type GenericSlaTargetOut = {
  id: string;
  subject_type: string;
  milestone: string;
  scope: Record<string, string>;
  priority: SlaPriority | null;
  target_hours: string;
  at_risk_percent: number;
  calendar: SlaCalendar;
  is_active: boolean;
  available: boolean;
  created_at: string;
  updated_at: string;
};

export type SlaClockView = {
  id: string;
  subject_type: string;
  subject_id: string;
  milestone: string;
  ref_id: string | null;
  target_hours: string;
  calendar: string;
  at_risk_percent: number;
  started_at: string;
  due_at: string;
  at_risk_at: string;
  completed_at: string | null;
  breached_at: string | null;
  status: SlaClockStatus;
};

export type SlaSummaryOut = {
  subject_type: string;
  milestone: string | null;
  counts: Record<SlaClockStatus, number>;
  total: number;
};
