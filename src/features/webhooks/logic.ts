/** Pure webhook UI rules (Epic 68): status labels, event groups, filter fields, polling and the replay window. */
import type { Delivery, DeliveryStatus, DisabledReason, EventType, Subscription } from "./api";

export type BadgeIntent = "warning" | "success" | "informative" | "danger";

export const DISABLED_REASON_LABELS: Record<DisabledReason, string> = {
  manual: "Turned off",
  gone: "the endpoint returned 410 Gone",
  failing: "deliveries failed for 72 hours",
  egress_refused: "the endpoint address became a private network address",
  uninstalled: "the app was uninstalled",
  scope_lost: "the app no longer has access to these events",
};

/** Badge label + intent of a Subscription (B2 "Status"). */
export function subscriptionBadge(s: Pick<Subscription, "status" | "disabled_reason" | "paused">): {
  label: string;
  intent: BadgeIntent;
  tooltip?: string;
} {
  if (s.status === "disabled") {
    const reason = s.disabled_reason ?? "manual";
    return { label: "Turned off", intent: "danger", tooltip: reason === "manual" ? undefined : `Turned off because ${DISABLED_REASON_LABELS[reason]}` };
  }
  if (s.status === "pending_verification") return { label: "Pending verification", intent: "warning" };
  if (s.paused) return { label: "Paused", intent: "informative", tooltip: "External access is paused" };
  return { label: "Active", intent: "success" };
}

/** "Turned off because …" message of the detail page. */
export function disabledMessage(reason: DisabledReason | null): string | null {
  if (!reason) return null;
  if (reason === "manual") return "This webhook was turned off.";
  return `Turned off because ${DISABLED_REASON_LABELS[reason]}`;
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Pending",
  in_flight: "Sending",
  retrying: "Retrying",
  succeeded: "Delivered",
  failed: "Failed",
  held: "Not sent",
  cancelled: "Cancelled",
};

/** Deliveries filter "Status" options -> API statuses. */
export const STATUS_FILTERS: { label: string; statuses?: DeliveryStatus[] }[] = [
  { label: "All" },
  { label: "Delivered", statuses: ["succeeded"] },
  { label: "Failed", statuses: ["failed"] },
  { label: "Retrying", statuses: ["retrying", "in_flight"] },
  { label: "Paused", statuses: ["pending"] },
  { label: "Not sent", statuses: ["held"] },
];

const ACTIVE: ReadonlySet<DeliveryStatus> = new Set(["pending", "in_flight", "retrying"]);

/** The log refreshes every 15 s only while a row is still moving (B, "Polling only"). */
export function pollInterval(rows: readonly Pick<Delivery, "status">[] | undefined): number | false {
  return rows?.some((r) => ACTIVE.has(r.status)) ? 15_000 : false;
}

export const EVENT_GROUPS: { label: string; prefixes: string[] }[] = [
  { label: "Candidates", prefixes: ["candidate.", "subject."] },
  { label: "Demands", prefixes: ["demand.", "posting."] },
  { label: "Applications", prefixes: ["application.", "submission."] },
  { label: "Interviews", prefixes: ["interview."] },
  { label: "Offers", prefixes: ["offer."] },
  { label: "Placements", prefixes: ["placement."] },
  { label: "Timesheets", prefixes: ["timesheet."] },
  { label: "Finance", prefixes: ["invoice.", "payment."] },
  { label: "Apps", prefixes: ["app.", "proposal."] },
];

export function groupEventTypes(types: readonly EventType[]): { label: string; types: EventType[] }[] {
  const out = EVENT_GROUPS.map((g) => ({ label: g.label, types: types.filter((t) => g.prefixes.some((p) => t.type.startsWith(p))) }));
  const known = new Set(out.flatMap((g) => g.types.map((t) => t.type)));
  const rest = types.filter((t) => !known.has(t.type));
  if (rest.length) out.push({ label: "Other", types: rest });
  return out.filter((g) => g.types.length > 0);
}

export const FILTER_FIELD_LABELS: Record<string, string> = {
  client_id: "Client",
  demand_id: "Demand",
  legal_entity_id: "Legal entity",
  placement_id: "Placement",
  candidate_id: "Candidate",
  to_stage: "Stage",
  to_status: "Status",
  status: "Status",
};
export const MAX_FILTERS = 3;
const WILDCARD_FIELDS = ["client_id", "legal_entity_id"];

/** Filter fields allowed for the selection (the server's §0.2 rule: common to every type, on the allow-list). */
export function allowedFilterFields(selected: readonly string[], allEvents: boolean, catalogue: readonly EventType[]): string[] {
  if (allEvents) return [...WILDCARD_FIELDS];
  if (selected.length === 0) return [];
  const sets = selected.map((t) => new Set(Object.keys(catalogue.find((c) => c.type === t)?.schema.properties ?? {})));
  return Object.keys(FILTER_FIELD_LABELS).filter((f) => sets.every((s) => s.has(f)));
}

export function canAddFilter(current: Record<string, string[]>, allowed: readonly string[]): boolean {
  return Object.keys(current).length < MAX_FILTERS && allowed.some((f) => !(f in current));
}

export const MAX_REPLAY_DAYS = 30;

/** Validate a replay range: "To" after "From", at most 30 days, inside the 30-day log window. */
export function replayRangeError(from: Date, to: Date, now: Date = new Date()): string | null {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "Enter both dates.";
  if (to <= from) return "\"To\" must be after \"From\".";
  const day = 86_400_000;
  if (to.getTime() - from.getTime() > MAX_REPLAY_DAYS * day) return "Pick at most 30 days.";
  if (from.getTime() < now.getTime() - MAX_REPLAY_DAYS * day) return "Deliveries older than 30 days can't be replayed.";
  return null;
}

/** Host + path of a URL without the query (it may hold the receiver's own token). */
export function endpointLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

/** "Failing for 3 h 10 min" or "None". */
export function streakLabel(since: string | null, now: Date = new Date()): string {
  if (!since) return "None";
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `Failing for ${h} h ${mins % 60} min` : `Failing for ${mins} min`;
}
