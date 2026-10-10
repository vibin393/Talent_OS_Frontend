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
  makeStyles,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import { ErrorBar } from "@/features/admin/ui";
import { recordingBadge } from "@/features/telephony/logic";
import type { CallOptions } from "@/features/telephony/types";

const useStyles = makeStyles({
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

/** Pre-call dialog "Call {candidate first name}" (spec B1): who rings first, the caller ID and the recording badge. */
export function PrecallDialog({
  open,
  options,
  candidate,
  busy,
  error,
  onCall,
  onClose,
}: {
  open: boolean;
  options: CallOptions;
  candidate: string;
  busy: boolean;
  error: string | null;
  onCall: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const first = candidate.split(" ")[0] || candidate;
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Call {first}</DialogTitle>
          <DialogContent className={styles.content}>
            <ErrorBar message={error} />
            <Body1>
              We&apos;ll ring your phone ••••{options.phone_last4 ?? "????"} first, then connect {candidate}.
            </Body1>
            <Body1>Caller ID shown to the candidate: {options.caller_id_label ?? "—"}</Body1>
            <div>
              <Badge appearance="tint" color={options.recording_will_be === "recorded" ? "brand" : "subtle"}>
                {recordingBadge(options)}
              </Badge>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={onCall} disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined}>
              Call now
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
