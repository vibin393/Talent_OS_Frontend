"use client";

import {
  Badge,
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
} from "@fluentui/react-components";
import { MailArrowUp20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { ConsentRequestResult } from "@/lib/api/types";
import { privacyApi, privacyErrorMessage, privacyKeys } from "./api";

export type AiConsentState = "granted" | "pending" | "withdrawn" | "not_required" | string | null | undefined;

/** "AI consent pending" / "AI consent withdrawn" badge; nothing for granted or not-required. */
export function AiConsentBadge({ state, size = "small" }: { state: AiConsentState; size?: "small" | "medium" }) {
  if (state === "pending") {
    return (
      <Badge appearance="tint" color="warning" size={size}>
        AI consent pending
      </Badge>
    );
  }
  if (state === "withdrawn") {
    return (
      <Badge appearance="tint" color="danger" size={size}>
        AI consent withdrawn
      </Badge>
    );
  }
  return null;
}

const OUTCOME_LABELS: Record<string, string> = {
  sent: "sent",
  skipped_no_email: "skipped (no email)",
  skipped_already_granted: "skipped (already granted)",
  skipped_recent: "skipped (asked in the last 72 h)",
  not_found: "not found",
};

/** "3 sent, 1 skipped (no email)" from a consent-request result. */
export function consentRequestSummary(result: Pick<ConsentRequestResult, "items">): string {
  const counts = new Map<string, number>();
  for (const i of result.items) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
  return (
    [...counts.entries()]
      .sort((a, b) => (a[0] === "sent" ? -1 : b[0] === "sent" ? 1 : a[0].localeCompare(b[0])))
      .map(([s, n]) => `${n} ${OUTCOME_LABELS[s] ?? s}`)
      .join(", ") || "Nothing to send"
  );
}

/** Ask one or more candidates (≤200) for AI-processing consent by email (`consent:write`). */
export function SendConsentRequestDialog({
  candidateIds,
  open,
  onClose,
  onDone,
}: {
  candidateIds: readonly string[];
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => privacyApi.sendConsentRequests({ candidate_ids: candidateIds.slice(0, 200), purpose: "ai_processing" }),
    onSuccess: async (result) => {
      toast.success(`Consent requests: ${consentRequestSummary(result)}`);
      await queryClient.invalidateQueries({ queryKey: ["candidates"] });
      await queryClient.invalidateQueries({ queryKey: privacyKeys.aiBasis });
      onDone?.();
      onClose();
    },
    onError: (e) => setError(privacyErrorMessage(e)),
  });
  const n = candidateIds.length;
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !send.isPending && (setError(null), onClose())}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Send AI consent request{n === 1 ? "" : "s"}</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ErrorBar message={error} />
            <Body1>
              {n === 1 ? "The candidate is" : `${Math.min(n, 200)} candidates are`} emailed a secure link to review the AI
              processing notice and agree or decline. Candidates without an email, who already agreed, or who were asked in
              the last 72 hours are skipped.
            </Body1>
            {n > 200 && <Body1>Only the first 200 selected candidates are included.</Body1>}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={send.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={n === 0 || send.isPending}
              icon={send.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => {
                setError(null);
                send.mutate();
              }}
            >
              Send
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Candidate 360 header controls: the consent badge plus "Send consent request" while pending. */
export function AiConsentControls({ candidateId, state }: { candidateId: string; state: AiConsentState }) {
  const canWrite = usePermission("consent:write");
  const [open, setOpen] = useState(false);
  if (state !== "pending" && state !== "withdrawn") return null;
  return (
    <>
      <AiConsentBadge state={state} size="medium" />
      {canWrite && state === "pending" && (
        <>
          <Button size="small" appearance="subtle" icon={<MailArrowUp20Regular />} onClick={() => setOpen(true)}>
            Send consent request
          </Button>
          <SendConsentRequestDialog candidateIds={[candidateId]} open={open} onClose={() => setOpen(false)} />
        </>
      )}
    </>
  );
}
