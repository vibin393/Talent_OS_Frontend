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
  Spinner,
  Textarea,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { schedulingApi, schedulingKeys } from "./api";

/** Interview drawer "Request reschedule" (participants): "Request a new time" with a reason; the agent re-offers. */
export function RequestRescheduleDialog({ interviewId, onClose }: { interviewId: string; onClose: () => void }) {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => schedulingApi.requestReschedule(interviewId, reason.trim()),
    onSuccess: async () => {
      toast.success("Reschedule requested. The Scheduling Agent will offer the candidate new times.");
      await queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const empty = reason.trim().length === 0;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Request a new time</DialogTitle>
          <DialogContent>
            <Field label="Reason" required validationState={error ? "error" : "none"} validationMessage={error ?? undefined}>
              <Textarea value={reason} maxLength={300} onChange={(_, d) => setReason(d.value)} resize="vertical" />
            </Field>
            {error === null && (
              <MessageBar intent="info" layout="multiline">
                <MessageBarBody>The interview stays booked until the candidate picks a new time.</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={empty || send.isPending} icon={send.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => send.mutate()}>
              Send
            </Button>
            <Button onClick={onClose} disabled={send.isPending}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
