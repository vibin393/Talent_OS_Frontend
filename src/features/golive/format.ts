/** Pure helpers for the go-live import page. */
import { topoOrderKinds } from "./p3/kind-order";
import type { GoLiveImport, GoLiveKindOut, GoLiveRow } from "./types";

/** Import kinds in the order they must be loaded. */
export const GO_LIVE_KIND_ORDER = ["workers", "placements", "opening_invoices", "leave_balances"] as const;

/** Kinds in load order (known kinds first, then any others the server lists), dependencies before dependents. */
export function orderedKinds(kinds: readonly GoLiveKindOut[]): GoLiveKindOut[] {
  const rank = (k: string) => {
    const i = (GO_LIVE_KIND_ORDER as readonly string[]).indexOf(k);
    return i === -1 ? GO_LIVE_KIND_ORDER.length : i;
  };
  return topoOrderKinds([...kinds].sort((a, b) => rank(a.kind) - rank(b.kind)));
}

/** "Available after Epic 16 ships" for an unavailable kind. */
export function availableAfterText(ownerEpic: string | number | null | undefined): string {
  if (ownerEpic === null || ownerEpic === undefined || String(ownerEpic).trim() === "") return "Not available yet";
  const raw = String(ownerEpic).trim();
  const n = /^(?:epic[\s_-]*)?(\d+)$/i.exec(raw);
  return `Available after ${n ? `Epic ${n[1]}` : raw} ships`;
}

export const GO_LIVE_STEPS = ["Upload", "Validate", "Preview", "Apply", "Results"] as const;
export type GoLiveStep = (typeof GO_LIVE_STEPS)[number];

/** The stepper position for an import (no import yet = Upload). */
export function goLiveStep(imp: Pick<GoLiveImport, "status"> | null | undefined): GoLiveStep {
  if (!imp) return "Upload";
  switch (imp.status) {
    case "validating":
      return "Validate";
    case "previewed":
      return "Preview";
    case "applied":
    case "failed":
      return "Results";
    default:
      return "Upload";
  }
}

/** Whether the import is still being validated (the page polls while true). */
export function isValidating(imp: Pick<GoLiveImport, "status"> | null | undefined): boolean {
  return imp?.status === "validating";
}

/** The typed confirmation required before applying an import. */
export const APPLY_CONFIRM_WORD = "APPLY";

/**
 * Whether Apply can be confirmed: the exact word typed, a previewed import with at least one valid row,
 * and either no error rows or `skip_invalid` chosen (the server refuses otherwise with 409 `has_errors`).
 */
export function canApply(
  imp: Pick<GoLiveImport, "status" | "valid_count" | "error_count"> | null | undefined,
  skipInvalid: boolean,
  typed: string,
): boolean {
  if (!imp || imp.status !== "previewed") return false;
  if (imp.valid_count <= 0) return false;
  if (imp.error_count > 0 && !skipInvalid) return false;
  return typed.trim() === APPLY_CONFIRM_WORD;
}

/** Only CSV files are accepted by the upload zone. */
export function isCsvFile(file: Pick<File, "name" | "type"> | null | undefined): boolean {
  if (!file) return false;
  return /\.csv$/i.test(file.name) || file.type === "text/csv";
}

/** Result counts shown after apply, by row status. */
export function resultCounts(imp: Pick<GoLiveImport, "applied_count" | "failed_count" | "skipped_count">) {
  return [
    { status: "applied", label: "Applied", count: imp.applied_count, color: "success" as const },
    { status: "skipped", label: "Skipped", count: imp.skipped_count, color: "warning" as const },
    { status: "failed", label: "Failed", count: imp.failed_count, color: "danger" as const },
  ];
}

/** `GET /rows` returns a bare list. */
export function rowsOf(data: GoLiveRow[] | undefined): GoLiveRow[] | undefined {
  return data;
}

/** One-line detail of a row: its first error, else the created record reference. */
export function rowDetail(r: GoLiveRow): string {
  const first = r.errors[0];
  if (first) return first.column ? `${first.column}: ${first.message}` : first.message;
  return r.result_ref ?? "—";
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
