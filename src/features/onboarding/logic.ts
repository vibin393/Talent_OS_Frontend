/** Pure helpers of the internal onboarding screens (labels, grouping, review rules, template validation). */
import type { BadgeProps } from "@fluentui/react-components";
import type { CaseStatus, OnboardingTask, TaskKind, TaskStatus, TemplateTask } from "./types";

export const KIND_LABELS: Record<TaskKind, string> = {
  personal_details: "Personal details",
  bank_details: "Bank details",
  tax_details: "PAN and tax declaration",
  emergency_contact: "Emergency contact",
  document_upload: "Document upload",
  esign: "eSign agreement",
  policy_ack: "Policy acknowledgement",
  client_form: "Client form",
  credential: "Credential",
  internal: "Internal task",
};
export const TASK_KINDS = Object.keys(KIND_LABELS) as TaskKind[];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "To do",
  submitted: "Submitted",
  returned: "Returned",
  approved: "Approved",
  waived: "Waived",
};
export const TASK_STATUS_COLORS: Record<TaskStatus, BadgeProps["color"]> = {
  pending: "informative",
  submitted: "brand",
  returned: "warning",
  approved: "success",
  waived: "subtle",
};
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  cancelled: "Cancelled",
};
export const CASE_STATUS_COLORS: Record<CaseStatus, BadgeProps["color"]> = {
  not_started: "informative",
  in_progress: "brand",
  complete: "success",
  cancelled: "subtle",
};
export const INTERNAL_TYPES = ["equipment", "system_access", "client_badge", "induction", "other"] as const;

export function groupTasks(tasks: OnboardingTask[]): { worker: OnboardingTask[]; internal: OnboardingTask[] } {
  const sorted = [...tasks].sort((a, b) => a.position - b.position);
  return { worker: sorted.filter((t) => t.assignee === "worker"), internal: sorted.filter((t) => t.assignee === "user") };
}

/** Tasks HR can approve now (submitted; eSign / policy / credential are system-decided). */
export function approvable(t: OnboardingTask): boolean {
  return t.status === "submitted" && !["esign", "policy_ack", "credential"].includes(t.kind);
}

export function canReturn(t: OnboardingTask): boolean {
  return t.status === "submitted";
}

export function canWaive(t: OnboardingTask): boolean {
  return ["pending", "submitted", "returned"].includes(t.status);
}

export function needsPanCheck(t: OnboardingTask): boolean {
  return t.kind === "tax_details";
}

export function needsRedaction(t: OnboardingTask): boolean {
  return Boolean(t.config?.aadhaar) && t.data?.redaction_status === "pending_review";
}

export const RETURN_MIN = 5;
export const WAIVE_MIN = 10;

/** Masked values shown in the review drawer (never full numbers). */
export function maskedSummary(t: OnboardingTask): [string, string][] {
  const d = t.data ?? {};
  const s = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
  switch (t.kind) {
    case "bank_details":
      return [
        ["Account", d.last4 ? `•••• ${s(d.last4)}` : "—"],
        ["IFSC", s(d.ifsc)],
        ["Change approval", d.change_requested ? "Pending in the approval inbox" : "Not needed"],
      ];
    case "tax_details":
      return [
        ["PAN", d.pan_last4 ? `•••• ${s(d.pan_last4)}` : "—"],
        ["Regime", s(d.regime)],
        ...Object.entries((d.declarations as Record<string, string>) ?? {}).map(([k, v]) => [k.replace(/_/g, " "), v] as [string, string]),
      ];
    case "emergency_contact":
      return [
        ["Name", s(d.name)],
        ["Relation", s(d.relation)],
        ["Phone", s(d.phone)],
      ];
    case "document_upload":
      return [
        ["Files", s(t.document_ids.length)],
        ...(d.last4 ? ([["Aadhaar", `•••• ${s(d.last4)}`], ["Redaction", s(d.redaction_status)]] as [string, string][]) : []),
      ];
    case "client_form":
      return Object.entries((d.values as Record<string, unknown>) ?? {}).map(([k, v]) => [k, s(v)]);
    case "personal_details":
      return Object.entries(d).map(([k, v]) => [k.replace(/_/g, " "), s(v)]);
    default:
      return [];
  }
}

export function progressLabel(pct: number): string {
  return `${Math.max(0, Math.min(100, Math.round(pct)))}% complete`;
}

const KEY_RE = /^[a-z0-9_:-]+$/;

/** Client-side template checks (the server re-validates; document templates are checked there). */
export function templateErrors(name: string, tasks: TemplateTask[]): string[] {
  const out: string[] = [];
  if (!name.trim()) out.push("Enter a template name.");
  const seen = new Set<string>();
  tasks.forEach((t, i) => {
    const n = i + 1;
    if (!KEY_RE.test(t.key)) out.push(`Task ${n}: the key may use lower-case letters, digits, _ : and -.`);
    if (seen.has(t.key)) out.push(`Task ${n}: the key "${t.key}" is used twice.`);
    seen.add(t.key);
    if (!t.label.trim()) out.push(`Task ${n}: enter a label.`);
    if ((t.kind === "esign" || t.kind === "policy_ack") && !t.config.document_template_id) out.push(`Task ${n}: pick a document template.`);
    if (t.kind === "credential" && !String(t.config.credential_type_key ?? "").trim()) out.push(`Task ${n}: enter the credential type.`);
    if (t.kind === "document_upload" && !String(t.config.document_category ?? "").trim()) out.push(`Task ${n}: enter the document category.`);
    if (t.kind === "internal" && !t.owner_kind) out.push(`Task ${n}: internal tasks need an owner.`);
    if (t.kind === "internal" && t.owner_kind === "role" && !t.owner_role_key) out.push(`Task ${n}: pick the owning role.`);
  });
  return out;
}

export function moveTask<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export function blankTask(kind: TaskKind, index: number): TemplateTask {
  return {
    key: `${kind}_${index + 1}`,
    kind,
    label: KIND_LABELS[kind],
    instructions: null,
    mandatory: true,
    owner_kind: kind === "internal" ? "case_owner" : null,
    owner_role_key: null,
    due_offset_days: kind === "internal" ? -2 : -5,
    auto_approve: false,
    reusable: kind !== "esign" && kind !== "internal",
    validity_days: null,
    config: kind === "internal" ? { internal_type: "equipment" } : kind === "tax_details" ? { declaration_mode: "either" } : {},
  };
}
