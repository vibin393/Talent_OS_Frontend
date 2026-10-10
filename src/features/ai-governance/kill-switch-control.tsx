"use client";

import {
  Body1,
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
  Switch,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { governanceApi, governanceKeys, useAgenticState } from "./api";
import { KILL_SWITCH_TEXT, killSwitchView, reasonError } from "./logic";

/** Banner shown while the kill switch (tenant or platform) is on. */
export function KillSwitchBanner() {
  const govern = usePermission("ai:govern");
  const kill = usePermission("ai:kill_switch");
  const configure = usePermission("ai:agent_configure");
  const canSee = govern || kill || configure;
  const state = useAgenticState(canSee);
  const view = killSwitchView(state.data);
  if (!view.banner) return null;
  return (
    <MessageBar intent="error" layout="multiline" role="status">
      <MessageBarBody>{view.banner}</MessageBarBody>
    </MessageBar>
  );
}

/** `Switch` "Agent kill switch" with the stop / resume dialogs (visible with `ai:kill_switch`). */
export function KillSwitchControl() {
  const allowed = usePermission("ai:kill_switch");
  const state = useAgenticState(allowed);
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"stop" | "resume" | null>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = killSwitchView(state.data);
  const close = () => {
    setDialog(null);
    setReason("");
    setTouched(false);
    setError(null);
  };
  const mutation = useMutation({
    mutationFn: (on: boolean) => governanceApi.killSwitch(on, reason.trim() || null),
    onSuccess: (out) => {
      qc.setQueryData(governanceKeys.agentic, (prev: object | undefined) => ({ ...(prev ?? {}), ...out }));
      void qc.invalidateQueries({ queryKey: governanceKeys.summary });
      close();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  if (!allowed) return null;
  const stopping = dialog === "stop";
  const err = stopping && touched ? reasonError(reason) : null;

  return (
    <>
      <Switch
        label={KILL_SWITCH_TEXT.label}
        checked={view.checked}
        disabled={view.disabled || state.isPending}
        onChange={(_, d) => setDialog(d.checked ? "stop" : "resume")}
      />
      <Dialog open={dialog !== null} onOpenChange={(_, d) => !d.open && !mutation.isPending && close()} modalType="alert">
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{stopping ? KILL_SWITCH_TEXT.stopTitle : KILL_SWITCH_TEXT.resumeTitle}</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
              <Body1>{stopping ? KILL_SWITCH_TEXT.stopBody : KILL_SWITCH_TEXT.resumeNote}</Body1>
              {stopping && (
                <Field label="Reason" required validationState={err ? "error" : "none"} validationMessage={err ?? undefined}>
                  <Textarea value={reason} onChange={(_, d) => setReason(d.value)} onBlur={() => setTouched(true)} maxLength={500} />
                </Field>
              )}
              {error && (
                <MessageBar intent="error" role="alert">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions>
              <Button disabled={mutation.isPending} onClick={close}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                style={stopping ? { backgroundColor: tokens.colorPaletteRedBackground3 } : undefined}
                disabled={mutation.isPending}
                icon={mutation.isPending ? <Spinner size="tiny" /> : undefined}
                onClick={() => {
                  if (stopping) {
                    setTouched(true);
                    if (reasonError(reason)) return;
                  }
                  mutation.mutate(stopping);
                }}
              >
                {stopping ? KILL_SWITCH_TEXT.stopButton : KILL_SWITCH_TEXT.resumeButton}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
