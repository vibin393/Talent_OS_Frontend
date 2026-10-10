"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  MessageBar,
  MessageBarBody,
  Textarea,
} from "@fluentui/react-components";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { hrmsApi } from "./api";

/** "Send {field} to {hrms}?" — Finance records a purpose before a sensitive field (PAN, bank, Aadhaar) is turned on. */
export function SensitiveDialog({
  mappingId,
  fieldLabel,
  hrmsName,
  onClose,
  onDone,
}: {
  mappingId: string;
  fieldLabel: string;
  hrmsName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [purpose, setPurpose] = useState("");
  const m = useMutation({
    mutationFn: () => hrmsApi.enableSensitive(mappingId, purpose.trim()),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            Send {fieldLabel} to {hrmsName}?
          </DialogTitle>
          <DialogContent>
            <Field label="Why do you need to send it?" required>
              <Textarea maxLength={500} value={purpose} onChange={(_, d) => setPurpose(d.value)} />
            </Field>
            {m.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={purpose.trim().length < 5 || m.isPending} onClick={() => m.mutate()}>
              Turn on
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
