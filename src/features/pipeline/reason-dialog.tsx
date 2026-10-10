"use client";

import {
  Body1,
  Button,
  Checkbox,
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
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { PipelineReasonKind } from "@/lib/api/types";
import { pipelineErrorMessage, reasonErrors } from "./transitions";
import { usePipelineSettings, useReasonCodes } from "./use-pipeline";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

export type ReasonValues = { reasonCode: string | null; note: string; sendRejectionEmail: boolean };

const TITLES: Record<PipelineReasonKind, string> = {
  reject: "Reject",
  withdraw: "Withdraw",
  reopen: "Reopen",
};

/**
 * Reject / Withdraw / Reopen dialog: reason `Dropdown` from the tenant's reason codes, a note (required
 * for "Other" and for reopening) and, when rejecting, the "Send rejection email" option.
 */
export function ReasonDialog({
  kind,
  subject,
  onSubmit,
  onClose,
}: {
  kind: PipelineReasonKind;
  /** "Asha Rao" or "3 candidates". */
  subject: string;
  onSubmit: (values: ReasonValues) => Promise<unknown>;
  onClose: () => void;
}) {
  const styles = useStyles();
  const reasons = useReasonCodes(kind);
  const canConfigure = usePermission("pipeline:configure");
  const settings = usePipelineSettings();
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = touched ? reasonErrors(kind, reasonCode, note) : {};
  const options = (reasons.data ?? []).filter((r) => !r.archived_at);
  const selected = options.find((r) => r.code === reasonCode);
  // Admins see the real setting; other users see the option with a hint (the server applies the setting).
  const emailOption = kind === "reject" && (canConfigure ? !!settings.data?.rejection_email_enabled : true);

  const submit = async () => {
    setTouched(true);
    const found = reasonErrors(kind, reasonCode, note);
    if (found.reason || found.note) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ reasonCode, note: note.trim(), sendRejectionEmail: emailOption && sendEmail });
      onClose();
    } catch (e) {
      setError(isApiError(e) ? pipelineErrorMessage(e.code, errorMessage(e)) : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            {TITLES[kind]} {subject}
          </DialogTitle>
          <DialogContent className={styles.form}>
            {kind === "reopen" && <Body1>The application moves back to Applied. Say why it is being reopened.</Body1>}
            {(kind !== "reopen" || options.length > 0) && (
              <Field
                label="Reason"
                required={kind !== "reopen"}
                validationState={errors.reason ? "error" : "none"}
                validationMessage={errors.reason}
              >
                <Dropdown
                  placeholder={reasons.isPending ? "Loading reasons…" : "Choose a reason"}
                  value={selected?.label ?? ""}
                  selectedOptions={reasonCode ? [reasonCode] : []}
                  onOptionSelect={(_, d) => setReasonCode(d.optionValue ?? null)}
                >
                  {options.map((r) => (
                    <Option key={r.id} value={r.code}>
                      {r.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            <Field
              label={kind === "reopen" ? "Reason for reopening" : "Note"}
              required={kind === "reopen" || reasonCode === "other"}
              validationState={errors.note ? "error" : "none"}
              validationMessage={errors.note}
            >
              <Textarea value={note} maxLength={4000} resize="vertical" onChange={(_, d) => setNote(d.value)} />
            </Field>
            {emailOption && (
              <Field hint={canConfigure ? undefined : "Sent only when rejection emails are turned on for your organization."}>
                <Checkbox
                  checked={sendEmail}
                  onChange={(_, d) => setSendEmail(!!d.checked)}
                  label="Send the rejection email to the candidate"
                />
              </Field>
            )}
            <ErrorBar message={error} />
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={busy}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={submit}
            >
              {TITLES[kind]}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
