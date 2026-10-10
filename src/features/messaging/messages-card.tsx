"use client";

import {
  Badge,
  Body1,
  Button,
  type ButtonProps,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownLeft16Regular, ArrowUpRight16Regular, Chat20Regular, CheckmarkCircle20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { errorMessage } from "@/lib/api/errors";
import { messagingApi, messagingKeys } from "./api";
import { CHANNEL_LABELS, messageStatusBadge, reasonLabel } from "./logic";
import { type MessageRecipient, SendMessageDialog } from "./send-message-dialog";
import type { Channel, Recipient, WhatsappNotice } from "./types";

const useStyles = makeStyles({
  card: { maxWidth: "720px", marginTop: tokens.spacingVerticalL },
  state: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" },
  item: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, padding: `${tokens.spacingVerticalS} 0`, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  meta: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  body: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  notice: { maxHeight: "320px", overflowY: "auto", padding: tokens.spacingHorizontalM, borderRadius: tokens.borderRadiusMedium, border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, backgroundColor: tokens.colorNeutralBackground2 },
});

/** "Send SMS/WhatsApp" action (hidden without `messaging:send`). */
export function SendMessageButton({
  recipients,
  contextRefs,
  disabled,
  appearance,
  size,
  label = "Send SMS/WhatsApp",
}: {
  recipients: () => MessageRecipient[];
  contextRefs?: Record<string, string>;
  disabled?: boolean;
  appearance?: ButtonProps["appearance"];
  size?: ButtonProps["size"];
  label?: string;
}) {
  const canSend = usePermission("messaging:send");
  const [open, setOpen] = useState<MessageRecipient[] | null>(null);
  if (!canSend) return null;
  return (
    <>
      <Button appearance={appearance} size={size} icon={<Chat20Regular />} disabled={disabled} onClick={() => setOpen(recipients())}>
        {label}
      </Button>
      {open && open.length > 0 && <SendMessageDialog recipients={open} contextRefs={contextRefs} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Candidate 360 / Worker "Messages" card: SMS and WhatsApp history plus consent / opt-out state. */
export function MessagesCard({ recipient, name }: { recipient: Recipient; name: string }) {
  const styles = useStyles();
  const canSend = usePermission("messaging:send");
  const [attesting, setAttesting] = useState<WhatsappNotice | null>(null);
  const state = useQuery({
    queryKey: messagingKeys.state(recipient),
    queryFn: ({ signal }) => messagingApi.state(recipient, signal),
    enabled: canSend,
  });
  const messages = useQuery({
    queryKey: messagingKeys.messages(recipient),
    queryFn: ({ signal }) => messagingApi.messages(recipient, null, signal),
    enabled: canSend,
  });
  if (!canSend) return null;
  const s = state.data;
  const items = messages.data ?? [];

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Messages</Subtitle2>}
        description={<Body1 className={styles.muted}>SMS and WhatsApp sent from Talent OS and replies received.</Body1>}
        action={<SendMessageButton size="small" recipients={() => [{ ...recipient, label: name }]} label="Send" />}
      />
      {state.isError && <ErrorBar message={errorMessage(state.error)} />}
      {s && (
        <div className={styles.state}>
          {s.has_phone ? (
            <Badge appearance="outline" color="informative">
              {s.phone_masked ?? "Phone on file"}
            </Badge>
          ) : (
            <Badge appearance="tint" color="warning">
              No phone number
            </Badge>
          )}
          <Badge appearance="tint" color={s.sms_opted_out ? "danger" : "success"}>
            {s.sms_opted_out ? "SMS: opted out" : "SMS: allowed"}
          </Badge>
          <Badge appearance="tint" color={s.whatsapp_consent ? "success" : "subtle"}>
            {s.whatsapp_consent ? "WhatsApp: opted in" : "WhatsApp: no opt-in"}
          </Badge>
          {!s.whatsapp_consent && s.whatsapp_notice && recipient.entity_type === "candidate" && (
            <Button size="small" appearance="subtle" icon={<CheckmarkCircle20Regular />} onClick={() => setAttesting(s.whatsapp_notice)}>
              Record WhatsApp opt-in
            </Button>
          )}
        </div>
      )}
      {messages.isPending ? (
        <Spinner size="tiny" label="Loading messages…" />
      ) : messages.isError ? (
        <ErrorBar message={errorMessage(messages.error)} />
      ) : items.length === 0 ? (
        <Text className={styles.muted}>No SMS or WhatsApp messages yet.</Text>
      ) : (
        <ul className={styles.list} aria-label="Messages">
          {items.map((m) => {
            const badge = messageStatusBadge(m.status);
            return (
              <li key={m.id} className={styles.item}>
                <div className={styles.meta}>
                  {m.direction === "inbound" ? <ArrowDownLeft16Regular aria-label="Received" /> : <ArrowUpRight16Regular aria-label="Sent" />}
                  <Text weight="semibold">{CHANNEL_LABELS[m.channel as Channel] ?? m.channel}</Text>
                  {m.template_name && <Caption1 className={styles.muted}>{m.template_name}</Caption1>}
                  <Badge size="small" appearance="tint" color={badge.color}>
                    {badge.label}
                  </Badge>
                  <Caption1 className={styles.muted}>{formatDateTime(m.sent_at ?? m.created_at)}</Caption1>
                </div>
                {m.body_rendered && (
                  <Body1 as="p" className={styles.body}>
                    {m.body_rendered}
                  </Body1>
                )}
                {(m.refusal_reason || m.error_code) && (
                  <Caption1 className={styles.muted}>{m.refusal_reason ? reasonLabel(m.refusal_reason) : `Error: ${m.error_code}`}</Caption1>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {attesting && <AttestWhatsappDialog candidateId={recipient.entity_id} name={name} notice={attesting} onClose={() => setAttesting(null)} />}
    </Card>
  );
}

/** Recruiter records that the candidate agreed to WhatsApp messages (shows the notice they agreed to). */
export function AttestWhatsappDialog({
  candidateId,
  name,
  notice,
  onClose,
}: {
  candidateId: string;
  name: string;
  notice: WhatsappNotice;
  onClose: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const m = useMutation({
    mutationFn: () => messagingApi.attestWhatsapp(candidateId, notice.id),
    onSuccess: (state) => {
      queryClient.setQueryData(messagingKeys.state({ entity_type: "candidate", entity_id: candidateId }), state);
      toast.success("WhatsApp opt-in recorded");
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !m.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Record WhatsApp opt-in</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            {m.isError && (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
              </MessageBar>
            )}
            <Body1>
              Only record this if {name} has agreed to receive WhatsApp messages after seeing this notice (version {String(notice.version)}).
            </Body1>
            <div className={styles.notice}>
              <Text weight="semibold" as="p" style={{ margin: 0 }}>
                {notice.title}
              </Text>
              <MarkdownView source={notice.body_md} />
            </div>
            <Checkbox
              checked={confirmed}
              onChange={(_, d) => setConfirmed(!!d.checked)}
              label={`${name} agreed to this notice and to receive WhatsApp messages`}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={m.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!confirmed || m.isPending} icon={m.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => m.mutate()}>
              Record opt-in
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
