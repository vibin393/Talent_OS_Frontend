"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/use-me";
import { errorMessage } from "@/lib/api/errors";
import type { ExportCreate, ExportFormat, ExportKind as P1ExportKind } from "@/lib/api/types";

/** Epic 34 (hand-written): the Phase 2 list kinds the backend also exports. */
export const P2_EXPORT_KINDS = [
  "leads",
  "opportunities",
  "vendors",
  "vendor_submissions",
  "placements",
  "timesheets",
  "expense_claims",
  "invoices",
  "payments",
  "bgv_cases",
] as const;
export type P2ExportKind = (typeof P2_EXPORT_KINDS)[number];
export type ExportKind = P1ExportKind | P2ExportKind;
/** Finance lists whose amounts need `report:finance_export` in an export. */
export const FINANCE_EXPORT_KINDS: readonly ExportKind[] = ["invoices", "payments", "expense_claims"];
import { exportKeys, type ExportOutcome, requestExport } from "./api";

/** Read permission each export kind needs besides `report:export`. */
export const EXPORT_READ_PERMISSION: Record<ExportKind, string> = {
  candidates: "candidate:read",
  demands: "demand:read",
  applications: "application:read",
  submissions: "submission:read",
  interviews: "interview:read",
  offers: "offer:read",
  leads: "lead:read",
  opportunities: "opportunity:read",
  vendors: "vendor:read",
  vendor_submissions: "vendor:read",
  placements: "placement:read",
  timesheets: "timesheet:read",
  expense_claims: "expense:read",
  invoices: "billing:read",
  payments: "receivables:read",
  bgv_cases: "bgv:read",
};

export function canExport(permissions: Record<string, string> | null | undefined, kind: ExportKind): boolean {
  return hasPermission(permissions, "report:export") && hasPermission(permissions, EXPORT_READ_PERMISSION[kind]);
}

export type ExportNotice =
  | { kind: "success"; text: string }
  | { kind: "info"; text: string }
  | { kind: "queued"; text: string }
  | { kind: "error"; text: string };

/** The toasts an outcome produces (pure, for tests). */
export function outcomeNotices(outcome: ExportOutcome): ExportNotice[] {
  const masked = "maskedColumns" in outcome && outcome.maskedColumns.length > 0;
  const notices: ExportNotice[] = [];
  switch (outcome.type) {
    case "downloaded":
      notices.push({
        kind: "success",
        text: outcome.rowCount !== null ? `Exported ${outcome.rowCount.toLocaleString()} rows to ${outcome.filename}` : `Downloaded ${outcome.filename}`,
      });
      break;
    case "queued":
      notices.push({ kind: "queued", text: "Preparing your export… we'll notify you when it's ready." });
      break;
    case "rate_limited":
      notices.push({ kind: "error", text: "Too many exports. Try again later." });
      break;
    case "too_large":
      break;
  }
  if (masked) notices.push({ kind: "info", text: "Compensation columns were excluded." });
  return notices;
}

/** "This view has 73,412 rows; exports are limited to 50,000. Narrow your filters." */
export function tooLargeMessage(rowCount: number | null, max: number | null): string {
  const rows = rowCount !== null ? `This view has ${rowCount.toLocaleString()} rows` : "This view has too many rows";
  const limit = max !== null ? `exports are limited to ${max.toLocaleString()}` : "exports are limited in size";
  return `${rows}; ${limit}. Narrow your filters.`;
}

/**
 * Run an export for the current list view and report the outcome through `notify`. A 422
 * `export_too_large` is kept in `tooLarge` (the menu shows it in a dialog).
 */
export function useExport(notify: (notice: ExportNotice) => void) {
  const queryClient = useQueryClient();
  const [tooLarge, setTooLarge] = useState<{ rowCount: number | null; max: number | null } | null>(null);
  const mutation = useMutation({
    mutationFn: (body: ExportCreate) => requestExport(body),
    onSuccess: (outcome) => {
      if (outcome.type === "too_large") setTooLarge({ rowCount: outcome.rowCount, max: outcome.max });
      for (const n of outcomeNotices(outcome)) notify(n);
      void queryClient.invalidateQueries({ queryKey: exportKeys.all });
    },
    onError: (e) => notify({ kind: "error", text: errorMessage(e, "The export failed. Please try again.") }),
  });
  return {
    run: (kind: ExportKind, format: ExportFormat, filters: Record<string, unknown>, columns?: string[]) =>
      // The generated ExportCreate predates the Phase 2 kinds; the backend accepts every ExportKind.
      mutation.mutate({ kind: kind as ExportCreate["kind"], format, filters, columns: columns?.length ? columns : undefined }),
    pending: mutation.isPending,
    tooLarge,
    dismissTooLarge: () => setTooLarge(null),
  };
}

/** Whether the signed-in user may export `kind`. */
export function useCanExport(kind: ExportKind): boolean {
  const { data: me } = useMe();
  return canExport(me?.permissions, kind);
}
