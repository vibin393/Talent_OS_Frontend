"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Spinner,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { ErrorBar } from "@/features/admin/ui";
import type { DemandOut, ReasonCodesOut } from "@/lib/api/types";
import { demandErrorMessage } from "./errors";
import { reasonLabel, STATUS_LABELS } from "./status";
import { useReasonCodes, useTransitionDemand } from "./use-demand";

const useStyles = makeStyles({
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

export type ReasonTarget = "on_hold" | "cancelled" | "closed";

const TITLES: Record<ReasonTarget, string> = {
  on_hold: "Put demand on hold",
  cancelled: "Cancel demand",
  closed: "Close demand",
};

const CONFIRM: Record<ReasonTarget, string> = { on_hold: "Put on hold", cancelled: "Cancel demand", closed: "Close demand" };

/** Status change that needs a reason code (Hold, Cancel, Close) with an optional comment. */
export function TransitionDialog({
  demand,
  to,
  onClose,
  onDone,
}: {
  demand: DemandOut;
  to: ReasonTarget;
  onClose: () => void;
  onDone?: () => void;
}) {
  const styles = useStyles();
  const codes = useReasonCodes();
  const transition = useTransitionDemand(demand.id);
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const options = codes.data?.[to as keyof ReasonCodesOut] ?? [];
  const busy = transition.isPending;

  const submit = async () => {
    setError(null);
    if (!reason) return setReasonError("Choose a reason");
    try {
      await transition.mutateAsync({ to, reason_code: reason, comment: comment.trim() || null });
      onDone?.();
      onClose();
    } catch (e) {
      setError(demandErrorMessage(e));
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{TITLES[to]}</DialogTitle>
          <DialogContent className={styles.content}>
            <span>
              {demand.req_id} {demand.title} will move from {STATUS_LABELS[demand.status]} to {STATUS_LABELS[to]}.
              {demand.status === "open" && demand.published_jd_version_id ? " Its job posting will be unpublished." : ""}
            </span>
            <ErrorBar message={error} />
            <Field
              label="Reason"
              required
              validationState={reasonError ? "error" : "none"}
              validationMessage={reasonError}
            >
              <Dropdown
                placeholder={codes.isPending ? "Loading…" : "Choose a reason"}
                value={reason ? reasonLabel(reason) : ""}
                selectedOptions={reason ? [reason] : []}
                onOptionSelect={(_, d) => {
                  setReason(d.optionValue ?? null);
                  setReasonError(null);
                }}
              >
                {options.map((c) => (
                  <Option key={c} value={c}>
                    {reasonLabel(c)}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Comment" hint={reason === "other" ? "Explain the reason" : "Optional"}>
              <Textarea value={comment} maxLength={4000} resize="vertical" onChange={(_, d) => setComment(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              {CONFIRM[to]}
            </Button>
            <Button appearance="secondary" disabled={busy} onClick={onClose}>
              Back
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
