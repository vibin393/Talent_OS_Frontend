/** Pure helpers for the record audit timeline. */
import type { TimelineActorType, TimelineChange } from "./types";

/** External-Principal badge text for actors outside the tenant's own users (AD-26), else null. */
export function externalPrincipalLabel(actorType: string): string | null {
  if (actorType === "client_user") return "Client user";
  if (actorType === "vendor_user") return "Vendor user";
  return null;
}

const ACTOR_FALLBACK: Record<TimelineActorType, string> = {
  user: "A user",
  system: "System",
  ai: "AI assistant",
  workflow: "Workflow",
  client_user: "Client user",
  vendor_user: "Vendor user",
  candidate: "Candidate",
  api_key: "API key",
  support: "Vendor support",
};

/** Display name of the actor: the server's `actor_display`, else a label for its type. */
export function actorName(actorType: string, actorDisplay: string | null | undefined): string {
  const d = actorDisplay?.trim();
  if (d) return d;
  return (ACTOR_FALLBACK as Record<string, string>)[actorType] ?? actorType.replace(/_/g, " ");
}

/**
 * Text of one side of a field change. Masked values are shown exactly as the server sent them
 * (e.g. `••••1234`) and never reformatted; empty values show an em dash.
 */
export function changeValueText(value: unknown, masked: boolean): string {
  if (value === null || value === undefined || value === "") return masked ? "••••" : "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (masked) return "••••";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Rows of the expandable diff. */
export function diffRows(changes: readonly TimelineChange[]): { field: string; old: string; new: string; masked: boolean }[] {
  return changes.map((c) => ({
    field: c.field.replace(/[_.]+/g, " ").replace(/^./, (ch) => ch.toUpperCase()),
    old: changeValueText(c.old, c.masked),
    new: changeValueText(c.new, c.masked),
    masked: c.masked,
  }));
}

export type ActionKind = "create" | "update" | "delete" | "approve" | "reject" | "send" | "sign" | "view" | "other";

/** The icon family for an audit action ("invoice.created" -> create). */
export function actionKind(action: string): ActionKind {
  const verb = action.split(".").pop()?.toLowerCase() ?? "";
  if (/(created|added|imported|uploaded|invited)$/.test(verb)) return "create";
  if (/(deleted|removed|erased|anonymi[sz]ed|expired|archived|cancelled|revoked)$/.test(verb)) return "delete";
  if (/(approved|accepted|verified|activated)$/.test(verb)) return "approve";
  if (/(rejected|refused|declined|failed)$/.test(verb)) return "reject";
  if (/(sent|emailed|notified|submitted|issued)$/.test(verb)) return "send";
  if (/signed$/.test(verb)) return "sign";
  if (/(viewed|exported|downloaded|read)$/.test(verb)) return "view";
  if (/(updated|changed|edited|set|moved|transitioned)$/.test(verb)) return "update";
  return "other";
}
