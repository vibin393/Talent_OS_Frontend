import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type { GraphDryRunOut, GraphExecutionOut, GraphRegistryOut, GraphRuleBody, GraphRuleOut } from "./types";

const enc = encodeURIComponent;
const W = "/api/v1/workflow";

/** Workflow v2 (graph) endpoints: the P1 rule endpoints with a `graph` body and the extended outputs. */
export const graphApi = {
  registry: (signal?: AbortSignal) => api.get<GraphRegistryOut>(`${W}/registry`, { signal }),
  getRule: (id: string, signal?: AbortSignal) => api.get<GraphRuleOut>(`${W}/rules/${enc(id)}`, { signal }),
  create: (body: GraphRuleBody) => api.post<GraphRuleOut>(`${W}/rules`, body),
  update: (id: string, body: GraphRuleBody) => api.patch<GraphRuleOut>(`${W}/rules/${enc(id)}`, body),
  activate: (id: string) => api.post<GraphRuleOut>(`${W}/rules/${enc(id)}/activate`),
  deactivate: (id: string) => api.post<GraphRuleOut>(`${W}/rules/${enc(id)}/deactivate`),
  dryRun: (id: string, entityId: string, assume: string) =>
    api.post<GraphDryRunOut>(`${W}/rules/${enc(id)}/dry-run`, { entity_id: entityId, extras: {}, assume_approval: assume }),
  dryRunDraft: (rule: GraphRuleBody, entityId: string, assume: string) =>
    api.post<GraphDryRunOut>(`${W}/dry-run`, { rule, entity_id: entityId, extras: {}, assume_approval: assume }),
  executions: (id: string, signal?: AbortSignal) => api.get<Page<GraphExecutionOut>>(`${W}/rules/${enc(id)}/executions?page=1&page_size=25&mode=live`, { signal }),
  execution: (id: string, signal?: AbortSignal) => api.get<GraphExecutionOut>(`${W}/executions/${enc(id)}`, { signal }),
};
