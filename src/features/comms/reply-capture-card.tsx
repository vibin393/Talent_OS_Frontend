"use client";

import {
  Badge,
  Body1,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Switch,
  tokens,
} from "@fluentui/react-components";
import { MailArrowDown20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime } from "@/features/admin/ui";
import { messagingApi, messagingKeys } from "@/features/messaging/api";
import { errorMessage } from "@/lib/api/errors";

const useStyles = makeStyles({
  card: { maxWidth: "960px", marginTop: tokens.spacingVerticalXL },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, paddingInline: tokens.spacingHorizontalM, paddingBottom: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
  facts: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXL },
});

/** My account → Connections: opt in to capturing replies to emails sent from Talent OS (FR-171). */
export function ReplyCaptureCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: messagingKeys.replyCapture, queryFn: ({ signal }) => messagingApi.replyCapture(signal) });
  const enable = useMutation({
    mutationFn: (provider: string) => messagingApi.enableReplyCapture(provider),
    onSuccess: (out) => window.location.assign(out.authorize_url),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disable = useMutation({
    mutationFn: () => messagingApi.disableReplyCapture(),
    onSuccess: (state) => {
      queryClient.setQueryData(messagingKeys.replyCapture, state);
      toast.success("Reply capture turned off");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const s = q.data;
  const busy = enable.isPending || disable.isPending;
  const noConnection = !!s && !s.provider;
  return (
    <Card className={styles.card}>
      <CardHeader
        image={<MailArrowDown20Regular aria-hidden />}
        header={<Subtitle2 as="h2">Capture replies</Subtitle2>}
        description={<Caption1 className={styles.muted}>Show replies to your Talent OS emails on the candidate or contact record.</Caption1>}
        action={
          s ? (
            <Badge appearance="tint" color={s.enabled ? "success" : "subtle"}>
              {s.enabled ? "On" : "Off"}
            </Badge>
          ) : undefined
        }
      />
      <div className={styles.body}>
        <Body1>
          Talent OS reads only replies in threads it started; nothing else in your mailbox. Each reply is added to the timeline of
          the records the original email was about.
        </Body1>
        {q.isPending ? (
          <Spinner size="tiny" label="Loading…" />
        ) : q.isError ? (
          <ErrorBar message={errorMessage(q.error)} />
        ) : (
          s && (
            <>
              {!s.tenant_enabled && (
                <MessageBar intent="info">
                  <MessageBarBody>Your administrator has turned reply capture off for the organisation.</MessageBarBody>
                </MessageBar>
              )}
              {noConnection && (
                <MessageBar intent="info">
                  <MessageBarBody>Connect your Google or Microsoft account above first.</MessageBarBody>
                </MessageBar>
              )}
              <Switch
                label={busy ? "Updating…" : "Capture replies to emails I send from Talent OS"}
                checked={s.enabled}
                disabled={busy || !s.tenant_enabled || noConnection}
                onChange={(_, d) => {
                  if (d.checked) {
                    if (s.provider) enable.mutate(s.provider);
                  } else disable.mutate();
                }}
              />
              {s.enabled && !s.scopes_granted && (
                <MessageBar intent="warning">
                  <MessageBarBody>Your account has not granted read access to replies. Turn the switch off and on to sign in again.</MessageBarBody>
                </MessageBar>
              )}
              <div className={styles.facts}>
                <Caption1>
                  Threads tracked: <strong>{s.threads_tracked}</strong>
                </Caption1>
                <Caption1>
                  Last sync: <strong>{s.last_synced_at ? formatDateTime(s.last_synced_at) : "never"}</strong>
                </Caption1>
              </div>
              {!s.enabled && s.provider && (
                <Caption1 className={styles.muted}>Turning this on asks your provider to allow Talent OS to read those replies.</Caption1>
              )}
            </>
          )
        )}
      </div>
    </Card>
  );
}
