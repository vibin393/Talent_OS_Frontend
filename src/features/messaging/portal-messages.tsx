"use client";

import { Body1, Caption1, Card, makeStyles, MessageBar, MessageBarBody, Subtitle1, Switch, Text, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { ErrorBlock, InlineError, LoadingBlock, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { messagingKeys, portalMessagingApi } from "./api";
import type { PortalMessaging } from "./types";

const useStyles = makeStyles({
  notice: {
    maxHeight: "240px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  switchRow: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, "& .fui-Switch": { minHeight: "44px", alignItems: "center" } },
});

/** Candidate portal → Privacy → Messages: WhatsApp opt-in (with the notice version) and SMS opt-out. */
export function PortalMessagesSection() {
  const styles = usePortalStyles();
  const own = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: messagingKeys.portal, queryFn: ({ signal }) => portalMessagingApi.get(signal) });
  const onSaved = (data: PortalMessaging, text: string) => {
    queryClient.setQueryData(messagingKeys.portal, data);
    toast.success(text);
  };
  const wa = useMutation({
    mutationFn: (enabled: boolean) => portalMessagingApi.setWhatsapp(enabled, enabled ? q.data?.whatsapp_notice?.id : undefined),
    onSuccess: (data, enabled) => onSaved(data, enabled ? "WhatsApp messages turned on" : "WhatsApp messages turned off"),
    onError: (e) => setError(errorMessage(e)),
  });
  const sms = useMutation({
    mutationFn: (optedOut: boolean) => portalMessagingApi.setSms(optedOut),
    onSuccess: (data, optedOut) => onSaved(data, optedOut ? "SMS messages turned off" : "SMS messages turned on"),
    onError: (e) => setError(errorMessage(e)),
  });
  const d = q.data;
  const notice = d?.whatsapp_notice ?? null;

  return (
    <Card className={styles.card} role="region" aria-labelledby="messages-title">
      <Subtitle1 as="h2" id="messages-title">
        Messages
      </Subtitle1>
      <Body1 className={styles.muted}>
        Choose whether we may send you SMS and WhatsApp messages about your applications, interviews and onboarding. We never send
        marketing messages on these channels.
      </Body1>
      {q.isPending ? (
        <LoadingBlock rows={2} />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        d && (
          <>
            <InlineError message={error} />
            {!d.has_phone && (
              <MessageBar intent="info" layout="multiline">
                <MessageBarBody>Add a mobile number to your profile to receive SMS or WhatsApp messages.</MessageBarBody>
              </MessageBar>
            )}
            <div className={own.switchRow}>
              <Switch
                checked={d.whatsapp_opted_in}
                disabled={wa.isPending || (!d.whatsapp_opted_in && !notice)}
                label="Receive WhatsApp messages"
                onChange={(_, x) => {
                  setError(null);
                  wa.mutate(x.checked);
                }}
              />
              {notice && (
                <>
                  <Caption1 className={styles.muted}>
                    By turning this on you agree to “{notice.title}” (version {String(notice.version)}).
                  </Caption1>
                  <div className={own.notice}>
                    <MarkdownView source={notice.body_md} />
                  </div>
                </>
              )}
              {!notice && !d.whatsapp_opted_in && <Text className={styles.muted}>WhatsApp messages are not available yet.</Text>}
            </div>
            <div className={own.switchRow}>
              <Switch
                checked={!d.sms_opted_out}
                disabled={sms.isPending}
                label="Receive SMS messages"
                onChange={(_, x) => {
                  setError(null);
                  sms.mutate(!x.checked);
                }}
              />
              <Caption1 className={styles.muted}>
                {d.sms_opted_out ? "You have opted out of SMS messages." : "You can also reply STOP to any SMS to opt out."}
              </Caption1>
            </div>
          </>
        )
      )}
    </Card>
  );
}
