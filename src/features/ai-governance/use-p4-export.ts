"use client";

import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { requestExport } from "@/features/exports/api";
import { outcomeNotices, tooLargeMessage } from "@/features/exports/use-export";
import { errorMessage } from "@/lib/api/errors";
import type { ExportCreate } from "@/lib/api/types";

/** Phase 4 export kinds (foundation 0.3 `ck_exports_kind`). */
export type P4ExportKind = "agent_runs" | "agent_proposals";

/** Run a CSV export of a P4 kind through the P1 export engine and toast the outcome. */
export function useP4Export(kind: P4ExportKind) {
  const toast = useAppToast();
  const [pending, setPending] = useState(false);
  const run = async (filters: Record<string, unknown>) => {
    setPending(true);
    try {
      // The generated ExportCreate predates the P4 kinds; the backend accepts them.
      const outcome = await requestExport({ kind: kind as unknown as ExportCreate["kind"], format: "csv", filters });
      if (outcome.type === "too_large") toast.error(tooLargeMessage(outcome.rowCount, outcome.max));
      for (const n of outcomeNotices(outcome)) {
        if (n.kind === "error") toast.error(n.text);
        else if (n.kind === "success") toast.success(n.text);
        else toast.info(n.text);
      }
    } catch (e) {
      toast.error(errorMessage(e, "The export failed. Please try again."));
    } finally {
      setPending(false);
    }
  };
  return { run, pending };
}
