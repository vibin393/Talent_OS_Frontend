"use client";

import { Button, Caption1, Card, makeStyles, tokens, Tooltip } from "@fluentui/react-components";
import { Call20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePermission } from "@/features/auth/use-permission";
import { telephonyApi, telephonyKeys, type CallSubject } from "@/features/telephony/api";
import { offersManualFallback, refusalTooltip } from "@/features/telephony/logic";
import type { VoiceCall } from "@/features/telephony/types";
import { errorMessage } from "@/lib/api/errors";
import { CallPanel } from "./call-panel";
import { PrecallDialog } from "./precall-dialog";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  fallback: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, padding: tokens.spacingHorizontalS },
});

/** The "Call" button (spec B1; visible with `voice:call`): pre-call dialog, then the live call panel. A person always
 *  clicks Call (★); disabled states explain why. Provider / budget refusals offer "Call outside Talent OS". */
export function CallButton({ subject, candidate, onManual, onOpenSession }: { subject: CallSubject; candidate: string; onManual?: () => void; onOpenSession?: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const canCall = usePermission("voice:call");
  const [dialog, setDialog] = useState(false);
  const [call, setCall] = useState<VoiceCall | null>(null);
  const opts = useQuery({ queryKey: telephonyKeys.options(subject), queryFn: ({ signal }) => telephonyApi.options(subject, signal), enabled: canCall, retry: false });
  const place = useMutation({
    mutationFn: () => telephonyApi.place(subject),
    onSuccess: (out) => {
      setCall(out);
      setDialog(false);
      void qc.invalidateQueries({ queryKey: ["voice"] });
      void qc.invalidateQueries({ queryKey: ["telephony", "options"] });
    },
  });
  if (!canCall) return null;
  const o = opts.data;
  const tip = o ? refusalTooltip(o.refusal_code, o.next_window_at) : opts.isError ? errorMessage(opts.error) : null;
  const button = (
    <Button icon={<Call20Regular />} disabled={!o?.can_call || place.isPending || (call !== null && !["completed", "no_answer", "busy", "failed"].includes(call.status))} onClick={() => setDialog(true)}>
      Call
    </Button>
  );
  return (
    <div className={styles.root}>
      {tip ? <Tooltip content={tip} relationship="description">{button}</Tooltip> : button}
      {o && !o.can_call && offersManualFallback(o.refusal_code) && (
        <Card className={styles.fallback}>
          <Caption1>{tip}</Caption1>
          <Button size="small" onClick={onManual}>
            Call outside Talent OS
          </Button>
        </Card>
      )}
      {o && dialog && (
        <PrecallDialog
          open={dialog}
          options={o}
          candidate={candidate}
          busy={place.isPending}
          error={place.error ? errorMessage(place.error) : null}
          onCall={() => place.mutate()}
          onClose={() => setDialog(false)}
        />
      )}
      {call && <CallPanel key={call.id} initial={call} candidate={candidate} onOpenSession={onOpenSession} />}
    </div>
  );
}
