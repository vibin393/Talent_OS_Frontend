"use client";

import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Radio,
  RadioGroup,
  Spinner,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { voiceApi, voiceKeys } from "./api";

/** "Request voice screen": how the call happens. Demo calls (Fake) are hidden where they are not available. */
export function RequestDialog({ applicationId, open, onClose }: { applicationId: string; open: boolean; onClose: () => void }) {
  const toast = useAppToast();
  const qc = useQueryClient();
  const [how, setHow] = useState<"manual" | "fake">("manual");
  const settings = useQuery({ queryKey: voiceKeys.settings, queryFn: ({ signal }) => voiceApi.settings(signal), retry: false, enabled: open });
  const demo = settings.data?.fake_available === true;
  const send = useMutation({
    mutationFn: () => voiceApi.request(applicationId, { mode: "call", provider_key: how }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: voiceKeys.sessions(applicationId) });
      toast.success("Voice screen requested.");
      onClose();
    },
  });
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Request voice screen</DialogTitle>
          <DialogContent>
            <ErrorBar message={send.error ? errorMessage(send.error) : null} />
            <Field label="How">
              <RadioGroup value={how} onChange={(_, d) => setHow(d.value as "manual" | "fake")}>
                <Radio value="manual" label="We'll call outside Talent OS and upload" />
                {demo && <Radio value="fake" label="Demo call" />}
              </RadioGroup>
            </Field>
            <Caption1>The candidate gets a link to agree to the call and, separately, to recording.</Caption1>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={send.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={send.isPending} icon={send.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => send.mutate()}>
              Send request
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
