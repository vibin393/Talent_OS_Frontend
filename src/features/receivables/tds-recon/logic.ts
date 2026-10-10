/** Pure helpers for TDS reconciliation (Epic 51). */
import { isApiError } from "@/lib/api/errors";
import type { Quarter, TdsLine, TdsMatch, TdsStatusRow, TdsStatusValue } from "./types";

export const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
export const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
export const FY_RE = /^(\d{4})-(\d{2})$/;

/** TAN format check (input is upper-cased and trimmed first). */
export function isValidTan(tan: string): boolean {
  return TAN_RE.test(tan.trim().toUpperCase());
}

/** "2026-27" with the second year following the first. */
export function isValidFy(fy: string): boolean {
  const m = FY_RE.exec(fy.trim());
  if (!m) return false;
  return (Number(m[1]) + 1) % 100 === Number(m[2]);
}

/** Indian FY of a date ("2026-27" for 2026-10-06). */
export function currentFy(now: Date = new Date()): string {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

/** Quarter of the Indian FY for a date (Apr-Jun = Q1). */
export function currentQuarter(now: Date = new Date()): Quarter {
  const m = now.getMonth();
  if (m >= 3 && m <= 5) return "Q1";
  if (m >= 6 && m <= 8) return "Q2";
  if (m >= 9 && m <= 11) return "Q3";
  return "Q4";
}

export type BadgeColor = "success" | "warning" | "danger" | "subtle" | "informative";

export const STATUS_BADGE: Record<TdsStatusValue, { color: BadgeColor; label: string }> = {
  reconciled: { color: "success", label: "Reconciled" },
  partially_reconciled: { color: "warning", label: "Partial" },
  exceptions: { color: "danger", label: "Exceptions" },
  not_started: { color: "subtle", label: "Not started" },
};

export const MATCH_BADGE: Record<TdsMatch["status"] | "none", { color: BadgeColor; label: string }> = {
  proposed: { color: "warning", label: "Proposed" },
  confirmed: { color: "success", label: "Confirmed" },
  rejected: { color: "danger", label: "Rejected" },
  unmatched_ack: { color: "subtle", label: "Acknowledged" },
  none: { color: "informative", label: "Unmatched" },
};

export const RUN_STATUS_COLOR: Record<string, BadgeColor> = {
  parsing: "informative",
  ready: "success",
  failed: "danger",
  superseded: "subtle",
};

export type MatrixRow = { client_id: string; client_name: string; cells: Record<Quarter, TdsStatusRow | null> };

/** Client x quarter matrix rows (clients sorted by name, every quarter present). */
export function statusMatrix(rows: readonly TdsStatusRow[]): MatrixRow[] {
  const by = new Map<string, MatrixRow>();
  for (const r of rows) {
    let entry = by.get(r.client_id);
    if (!entry) {
      entry = { client_id: r.client_id, client_name: r.client_name ?? r.client_id, cells: { Q1: null, Q2: null, Q3: null, Q4: null } };
      by.set(r.client_id, entry);
    }
    if (QUARTERS.includes(r.quarter)) entry.cells[r.quarter] = r;
  }
  return [...by.values()].sort((a, b) => a.client_name.localeCompare(b.client_name));
}

/**
 * Confirm guard: confirming is a single, explicit human decision on ONE selected line whose match is
 * `proposed` (with a deduction). There is no bulk / auto confirm; no selection, several lines, or a match in
 * another state cannot be confirmed.
 */
export function canConfirm(selection: readonly TdsLine[] | TdsLine | null | undefined): boolean {
  const lines: readonly TdsLine[] = selection == null ? [] : Array.isArray(selection) ? selection : [selection as TdsLine];
  if (lines.length !== 1) return false;
  const m = lines[0].match;
  return !!m && m.status === "proposed" && !!m.tds_deduction_id;
}

export function canReject(line: TdsLine | null | undefined): boolean {
  return !!line?.match && line.match.status === "proposed";
}

/** Lines open for a manual pair or an acknowledgement (nothing confirmed / acknowledged yet). */
export function isOpenLine(line: TdsLine | null | undefined): boolean {
  return !!line && (!line.match || line.match.status === "proposed" || line.match.status === "rejected");
}

export const TDS_ERROR_MESSAGES: Record<string, string> = {
  tds_statement_pan_mismatch: "This statement belongs to a different PAN than the selected Legal Entity.",
  tds_statement_unreadable: "The statement could not be read. Upload the TRACES 26AS / AIS file as downloaded.",
  legal_entity_pan_missing: "Add the PAN to this Legal Entity before uploading statements.",
  tds_statement_file_required: "Choose a statement file to upload.",
  unsupported_file_type: "This file type is not supported. Upload the TRACES text, CSV or PDF statement.",
  human_only_action: "Only a signed-in person can confirm or reject a match.",
};

export const GENERIC_TDS_ERROR = "Something went wrong. Please try again.";

export function tdsErrorMessage(e: unknown): string {
  const code = isApiError(e) ? e.code : typeof e === "string" ? e : "";
  if (TDS_ERROR_MESSAGES[code]) return TDS_ERROR_MESSAGES[code];
  if (isApiError(e) && e.status > 0 && e.status < 500 && e.message) return e.message;
  return GENERIC_TDS_ERROR;
}
