"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Divider,
  makeStyles,
  Spinner,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Attach16Regular, MailArrowDown20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBar, formatDateTime } from "@/features/admin/ui";
import { messagingApi, messagingKeys } from "@/features/messaging/api";
import { replyPlainText, replyPreview } from "@/features/messaging/logic";
import type { EmailReplyActivityData } from "@/features/messaging/types";
import { errorMessage } from "@/lib/api/errors";

const useStyles = makeStyles({
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, padding: tokens.spacingHorizontalM, marginTop: tokens.spacingVerticalXS },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, minWidth: 0 },
  text: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
  surface: { width: "720px", maxWidth: "calc(100vw - 32px)" },
  thread: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxHeight: "60vh", overflowY: "auto" },
  msg: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
});

/** Plain-text reply body with "Show more"; reply HTML is never rendered (text nodes only). */
export function ReplyText({ text, max = 280 }: { text: string; max?: number }) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const clean = replyPlainText(text);
  const preview = replyPreview(clean, max);
  return (
    <>
      <Body1 as="p" className={styles.text}>
        {expanded ? clean : preview.text}
      </Body1>
      {preview.truncated && (
        <Button appearance="transparent" size="small" onClick={() => setExpanded((v) => !v)} style={{ alignSelf: "flex-start", paddingInline: 0 }}>
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </>
  );
}

function replyData(raw: Record<string, unknown> | null | undefined): EmailReplyActivityData {
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    inbound_email_id: str(raw?.inbound_email_id),
    email_message_id: str(raw?.email_message_id),
    from_address: str(raw?.from_address),
    subject: str(raw?.subject),
  };
}

/** Activity-timeline card for an `email_reply` entry: from, subject, text excerpt and the thread view. */
export function EmailReplyCard({ data: raw, body }: { data: Record<string, unknown> | null | undefined; body: string }) {
  const styles = useStyles();
  const data = replyData(raw);
  const [open, setOpen] = useState(false);
  return (
    <Card className={styles.card} appearance="filled-alternative" size="small">
      <div className={styles.head}>
        <MailArrowDown20Regular aria-hidden />
        <Text weight="semibold" truncate wrap={false}>
          {data?.subject || "(no subject)"}
        </Text>
      </div>
      {data?.from_address && <Caption1 className={styles.muted}>From {data.from_address}</Caption1>}
      <ReplyText text={body} />
      {data?.email_message_id && (
        <div className={styles.actions}>
          <Button size="small" onClick={() => setOpen(true)}>
            View thread
          </Button>
        </div>
      )}
      {open && data?.email_message_id && <EmailThreadDialog emailId={data.email_message_id} onClose={() => setOpen(false)} />}
    </Card>
  );
}

/** The original email and every captured reply, oldest first, as plain text. */
export function EmailThreadDialog({ emailId, onClose }: { emailId: string; onClose: () => void }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: messagingKeys.thread(emailId), queryFn: ({ signal }) => messagingApi.emailThread(emailId, signal) });
  const email = q.data?.email;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{email?.subject || "Email thread"}</DialogTitle>
          <DialogContent>
            {q.isPending ? (
              <Spinner label="Loading thread…" />
            ) : q.isError ? (
              <ErrorBar message={errorMessage(q.error)} />
            ) : (
              <div className={styles.thread}>
                <div className={styles.msg}>
                  <Text weight="semibold">{email?.sender_name || email?.from_address}</Text>
                  <Caption1 className={styles.muted}>Sent from Talent OS · {formatDateTime(email?.sent_at ?? email?.created_at)}</Caption1>
                </div>
                {q.data.replies.map((r) => (
                  <div key={r.id} className={styles.msg}>
                    <Divider />
                    <Text weight="semibold">{r.from_address}</Text>
                    <Caption1 className={styles.muted}>
                      {formatDateTime(r.received_at)}
                      {r.subject ? ` · ${r.subject}` : ""}
                    </Caption1>
                    <ReplyText text={r.body_text} max={600} />
                    {r.attachment_names.length > 0 && (
                      <Caption1 className={styles.muted}>
                        <Attach16Regular aria-hidden /> {r.attachment_names.join(", ")}
                      </Caption1>
                    )}
                  </div>
                ))}
                {q.data.replies.length === 0 && <Text className={styles.muted}>No replies captured yet.</Text>}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
