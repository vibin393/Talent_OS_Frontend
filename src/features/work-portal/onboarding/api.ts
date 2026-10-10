/** Worker "My Work" onboarding calls (Epic 23, candidate session via `portalRequest`). */
import { portalRequest } from "@/lib/api/portal-client";

const O = "/api/v1/portal/work/onboarding";
const enc = encodeURIComponent;

export type PortalTaskStatus = "pending" | "submitted" | "returned" | "approved" | "waived";

export type PortalTask = {
  id: string;
  kind:
    | "personal_details"
    | "bank_details"
    | "tax_details"
    | "emergency_contact"
    | "document_upload"
    | "esign"
    | "policy_ack"
    | "client_form"
    | "credential";
  label: string;
  instructions: string | null;
  mandatory: boolean;
  status: PortalTaskStatus;
  due_on: string | null;
  return_comment: string | null;
  submitted_at: string | null;
  draft: Record<string, unknown> | null;
  masked: Record<string, string | null>;
  form: Record<string, unknown> | null;
  signature_request_id: string | null;
  signer_id: string | null;
};

export type PortalCaseSummary = {
  id: string;
  human_id: string | null;
  status: "not_started" | "in_progress" | "complete" | "cancelled";
  progress_pct: number;
  planned_start_date: string | null;
  open_tasks: number;
};

export type PortalCase = PortalCaseSummary & { tasks: PortalTask[] };

export const workOnboardingApi = {
  cases: (signal?: AbortSignal) => portalRequest<PortalCaseSummary[]>(`${O}/cases`, { signal }),
  case: (id: string, signal?: AbortSignal) => portalRequest<PortalCase>(`${O}/cases/${enc(id)}`, { signal }),
  saveDraft: (taskId: string, draft: Record<string, unknown>) =>
    portalRequest<void>(`${O}/tasks/${enc(taskId)}/draft`, { method: "PATCH", body: { draft } }),
  submit: (taskId: string, payload: Record<string, unknown>) =>
    portalRequest<PortalTask>(`${O}/tasks/${enc(taskId)}/submit`, { method: "POST", body: { payload } }),
  upload: (taskId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return portalRequest<{ document_id: string }>(`${O}/tasks/${enc(taskId)}/files`, { method: "POST", body: form });
  },
  policyUrl: (taskId: string) => `${O}/tasks/${enc(taskId)}/policy`,
  acknowledge: (taskId: string) =>
    portalRequest<void>(`${O}/tasks/${enc(taskId)}/acknowledge`, { method: "POST", body: { accepted: true } }),
};

export const workOnboardingKeys = {
  cases: ["portal", "work", "onboarding", "cases"] as const,
  case: (id: string) => ["portal", "work", "onboarding", "case", id] as const,
};
