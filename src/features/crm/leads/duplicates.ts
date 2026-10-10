/** Duplicate-warning flow for the lead form (pure, unit-tested). */
import { isApiError } from "@/lib/api/errors";
import type { DuplicateMatch } from "../types";

export const DUPLICATE_DEBOUNCE_MS = 400;

export const DUPLICATE_REASON_LABELS: Record<DuplicateMatch["reason"], string> = {
  name: "same name",
  similar_name: "similar name",
  domain: "same website",
  gstin: "same GSTIN",
};

/** Run the live duplicate check only once a company name (or website / GSTIN) is meaningful. */
export function shouldCheckDuplicates(companyName: string, website?: string | null, gstin?: string | null): boolean {
  return companyName.trim().length >= 3 || !!website?.trim() || (gstin?.trim().length ?? 0) >= 15;
}

/** Matches carried by a 409 `possible_duplicate` error, else null. */
export function duplicateMatchesFromError(e: unknown): DuplicateMatch[] | null {
  if (!isApiError(e) || e.status !== 409 || e.code !== "possible_duplicate") return null;
  const m = e.details.matches;
  return Array.isArray(m) ? (m as DuplicateMatch[]) : [];
}

/** App route of a duplicate match. */
export function matchHref(m: DuplicateMatch): string {
  return m.kind === "client" ? `/clients/${m.id}` : `/leads/${m.id}`;
}

export type DuplicateState = { matches: DuplicateMatch[]; acknowledged: boolean };
export const NO_DUPLICATES: DuplicateState = { matches: [], acknowledged: false };

/** Events: live-check results, a 409 from save, "Save anyway" and a reset. */
export type DuplicateEvent =
  | { type: "checked"; matches: DuplicateMatch[] }
  | { type: "conflict"; matches: DuplicateMatch[] }
  | { type: "acknowledge" }
  | { type: "reset" };

function sameIds(a: DuplicateMatch[], b: DuplicateMatch[]): boolean {
  const ids = new Set(a.map((m) => m.id));
  return a.length === b.length && b.every((m) => ids.has(m.id));
}

export function duplicateReducer(state: DuplicateState, ev: DuplicateEvent): DuplicateState {
  switch (ev.type) {
    case "checked":
      // An acknowledgement survives a re-check only while the matches are unchanged.
      return {
        matches: ev.matches,
        acknowledged: ev.matches.length > 0 && state.acknowledged && sameIds(state.matches, ev.matches),
      };
    case "conflict":
      return { matches: ev.matches, acknowledged: false };
    case "acknowledge":
      return { ...state, acknowledged: true };
    case "reset":
      return NO_DUPLICATES;
  }
}

/** Whether the form should submit with `acknowledge_duplicates=true`. */
export function acknowledgeFlag(state: DuplicateState): boolean {
  return state.acknowledged && state.matches.length > 0;
}

/** Whether the warning should offer "Save anyway" (matches exist and not yet acknowledged). */
export function needsAcknowledgement(state: DuplicateState): boolean {
  return state.matches.length > 0 && !state.acknowledged;
}
