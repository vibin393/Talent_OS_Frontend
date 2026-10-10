import { api } from "@/lib/api/client";
import type {
  Page,
  PipelineStageOut,
  WorkflowDryRunOut,
  WorkflowExecutionOut,
  WorkflowRegistryOut,
  WorkflowRuleIn,
  WorkflowRuleOut,
  WorkflowRuleUpdate,
} from "@/lib/api/types";

const enc = encodeURIComponent;
const W = "/api/v1/workflow";

/** Workflow rules, executions and dry runs (Epic 10, story 10.4). */
export const workflowApi = {
  registry: (signal?: AbortSignal) => api.get<WorkflowRegistryOut>(`${W}/registry`, { signal }),
  listRules: (includeArchived: boolean, signal?: AbortSignal) =>
    api.get<Page<WorkflowRuleOut>>(`${W}/rules?page=1&page_size=100${includeArchived ? "&include_archived=true" : ""}`, {
      signal,
    }),
  getRule: (id: string, signal?: AbortSignal) => api.get<WorkflowRuleOut>(`${W}/rules/${enc(id)}`, { signal }),
  createRule: (body: WorkflowRuleIn) => api.post<WorkflowRuleOut>(`${W}/rules`, body),
  updateRule: (id: string, body: WorkflowRuleUpdate) => api.patch<WorkflowRuleOut>(`${W}/rules/${enc(id)}`, body),
  activate: (id: string) => api.post<WorkflowRuleOut>(`${W}/rules/${enc(id)}/activate`),
  deactivate: (id: string) => api.post<WorkflowRuleOut>(`${W}/rules/${enc(id)}/deactivate`),
  archive: (id: string) => api.post<WorkflowRuleOut>(`${W}/rules/${enc(id)}/archive`),
  dryRun: (id: string, entityId: string, extras: Record<string, unknown>) =>
    api.post<WorkflowDryRunOut>(`${W}/rules/${enc(id)}/dry-run`, { entity_id: entityId, extras }),
  dryRunDraft: (rule: WorkflowRuleIn, entityId: string, extras: Record<string, unknown>) =>
    api.post<WorkflowDryRunOut>(`${W}/dry-run`, { rule, entity_id: entityId, extras }),
  executions: (
    id: string,
    filters: { status: string | null; mode: "live" | "dry_run" | null },
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ) => {
    const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (filters.status) p.set("status", filters.status);
    if (filters.mode) p.set("mode", filters.mode);
    return api.get<Page<WorkflowExecutionOut>>(`${W}/rules/${enc(id)}/executions?${p}`, { signal });
  },
  execution: (id: string, signal?: AbortSignal) => api.get<WorkflowExecutionOut>(`${W}/executions/${enc(id)}`, { signal }),
  stages: (signal?: AbortSignal) => api.get<{ items: PipelineStageOut[] }>("/api/v1/pipeline/stages", { signal }),
};

export const workflowKeys = {
  all: ["workflow"] as const,
  registry: ["workflow", "registry"] as const,
  rules: ["workflow", "rules"] as const,
  ruleList: (includeArchived: boolean) => ["workflow", "rules", "list", includeArchived] as const,
  rule: (id: string) => ["workflow", "rules", "detail", id] as const,
  executions: (id: string, filters: unknown, page: number) => ["workflow", "rules", "detail", id, "executions", filters, page] as const,
  stages: ["workflow", "stages"] as const,
};
