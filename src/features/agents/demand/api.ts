/** Epic 55 Demand Agent client: intake inbox, intake / agent settings, sender domains and the Demand "AI assist" data. */
import { api } from "@/lib/api/client";
import type {
  AgentSettings,
  AgentSettingsIn,
  DemandFlag,
  DemandInsights,
  FlagResolution,
  IntakeMessage,
  IntakeMessageSummary,
  IntakeSettings,
  IntakeSettingsIn,
  IntakeTab,
  Page,
  RunRef,
  SenderDomain,
  SenderDomainIn,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(16)}-${crypto.randomUUID()}`;
}

export const demandAgentApi = {
  // intake inbox (demand:create)
  messages: (tab: IntakeTab, page = 1, signal?: AbortSignal) =>
    api.get<Page<IntakeMessageSummary>>(`${V}/demands/intake-messages?tab=${tab}&page=${page}&page_size=25`, { signal }),
  message: (id: string, signal?: AbortSignal) => api.get<IntakeMessage>(`${V}/demands/intake-messages/${enc(id)}`, { signal }),
  createFromText: (clientId: string, text: string) => {
    const form = new FormData();
    form.append("client_id", clientId);
    form.append("text", text);
    return api.post<IntakeMessage>(`${V}/demands/intake-messages`, form);
  },
  createFromFile: (clientId: string, file: File) => {
    const form = new FormData();
    form.append("client_id", clientId);
    form.append("file", file);
    return api.post<IntakeMessage>(`${V}/demands/intake-messages`, form);
  },
  assign: (id: string, clientId: string, contactId: string | null) =>
    api.post<IntakeMessage>(`${V}/demands/intake-messages/${enc(id)}/assign`, { client_id: clientId, contact_id: contactId }),
  retry: (id: string) => api.post<IntakeMessage>(`${V}/demands/intake-messages/${enc(id)}/retry`),
  discard: (id: string, reason: string) => api.post<IntakeMessage>(`${V}/demands/intake-messages/${enc(id)}/discard`, { reason }),
  // intake settings + sender domains (settings:manage)
  intakeSettings: (signal?: AbortSignal) => api.get<IntakeSettings>(`${V}/demands/intake-settings`, { signal }),
  updateIntakeSettings: (body: IntakeSettingsIn) => api.put<IntakeSettings>(`${V}/demands/intake-settings`, body),
  rotateAddress: () => api.post<IntakeSettings>(`${V}/demands/intake-settings/rotate-address`),
  senderDomains: (signal?: AbortSignal) => api.get<SenderDomain[]>(`${V}/demands/intake-sender-domains`, { signal }),
  addSenderDomain: (body: SenderDomainIn) => api.post<SenderDomain>(`${V}/demands/intake-sender-domains`, body),
  removeSenderDomain: (id: string) => api.delete<void>(`${V}/demands/intake-sender-domains/${enc(id)}`),
  // agent settings (ai:agent_configure)
  agentSettings: (signal?: AbortSignal) => api.get<AgentSettings>(`${V}/demands/agent-settings`, { signal }),
  updateAgentSettings: (body: AgentSettingsIn) => api.put<AgentSettings>(`${V}/demands/agent-settings`, body),
  // demand page
  insights: (demandId: string, signal?: AbortSignal) => api.get<DemandInsights>(`${V}/demands/${enc(demandId)}/insights`, { signal }),
  acceptSuggestion: (demandId: string, id: string, body: { min_proficiency?: number | null; skill_kind?: string | null }) =>
    api.post<DemandInsights>(`${V}/demands/${enc(demandId)}/suggestions/${enc(id)}/accept`, body),
  dismissSuggestion: (demandId: string, id: string) =>
    api.post<DemandInsights>(`${V}/demands/${enc(demandId)}/suggestions/${enc(id)}/dismiss`),
  resolveFlag: (flagId: string, resolution: FlagResolution, note?: string) =>
    api.post<DemandFlag>(`${V}/demands/flags/${enc(flagId)}/resolve`, { resolution, note: note ?? null }),
  runAgent: (demandId: string) =>
    api.post<RunRef>(
      `${V}/agent-runs`,
      { agent_key: "demand", subject_type: "demand", subject_id: demandId },
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    ),
};

export const demandAgentKeys = {
  all: ["demand-agent"] as const,
  messages: (tab: IntakeTab, page: number) => ["demand-agent", "messages", tab, page] as const,
  message: (id: string) => ["demand-agent", "message", id] as const,
  intakeSettings: ["demand-agent", "intake-settings"] as const,
  senderDomains: ["demand-agent", "sender-domains"] as const,
  agentSettings: ["demand-agent", "agent-settings"] as const,
  insights: (demandId: string) => ["demand-agent", "insights", demandId] as const,
};
