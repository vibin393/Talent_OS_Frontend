"use client";

import {
  Button,
  Caption1,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { sourcingApi, sourcingKeys } from "./api";
import { CHANNEL_LABELS, CHANNELS, contactTooltip, counterText, MESSAGE_MAX, reasonLabel } from "./logic";
import type { Channel, EntryOut } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** "Outreach to {name}": review, edit and approve (or reject) the agent's outreach Proposal for one entry. */
export function OutreachDraftDrawer({ entry, onClose }: { entry: EntryOut | null; onClose: () => void }) {
  return (
    <DetailsDrawer open={entry !== null} title={entry ? `Outreach to ${entry.candidate_name ?? "candidate"}` : ""} onClose={onClose} size="medium">
      {entry && <DraftForm key={entry.id} entry={entry} onClose={onClose} />}
    </DetailsDrawer>
  );
}

function DraftForm({ entry, onClose }: { entry: EntryOut; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const router = useRouter();
  const proposalId = entry.outreach_proposal_id;
  const proposal = useQuery({
    queryKey: sourcingKeys.proposal(proposalId ?? "none"),
    queryFn: ({ signal }) => sourcingApi.proposal(proposalId as string, signal),
    enabled: Boolean(proposalId),
  });
  const [channel, setChannel] = useState<Channel>((entry.draft_channel as Channel) ?? entry.best_channel ?? "email");
  const [subject, setSubject] = useState(entry.draft_subject ?? "");
  const [message, setMessage] = useState(entry.draft_body ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: sourcingKeys.all });

  const approve = useMutation({
    mutationFn: () =>
      sourcingApi.decideProposal(proposalId as string, {
        decision: "approve",
        edited_args: { ...(proposal.data?.args ?? {}), channel, subject: subject || null, body: message },
      }),
    onSuccess: (out) => {
      if (out.status === "executed") toast.success("Outreach sent.");
      else toast.error(out.error_code?.startsWith("suppressed:") ? `Not sent: ${reasonLabel(out.error_code)}` : `Not sent (${out.status}).`);
      void refresh();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: (why: string) => sourcingApi.decideProposal(proposalId as string, { decision: "reject", note: why }),
    onSuccess: () => {
      toast.success("Draft rejected.");
      void refresh();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pending = entry.draft_status === "proposed" && proposalId && proposal.data?.status === "pending";
  const canDecide = Boolean(pending && proposal.data?.can_decide);
  const busy = approve.isPending || reject.isPending;

  return (
    <div className={styles.form}>
      <Caption1 className={styles.muted}>AI-generated draft. A person approves before anything is sent.</Caption1>
      {entry.draft_status === "suppressed" && (
        <MessageBar intent="warning">
          <MessageBarBody>Not sent: the candidate could not be contacted when the draft was approved.</MessageBarBody>
        </MessageBar>
      )}
      {proposal.isError && <ErrorBar title="Could not load the proposal." message={errorMessage(proposal.error)} />}
      <Field label="Channel">
        <RadioGroup value={channel} onChange={(_, d) => setChannel(d.value as Channel)} layout="horizontal">
          {CHANNELS.map((ch) => {
            const state = entry.contactability[ch];
            const disabled = !state?.ok || ch !== "email";
            const label = ch !== "email" && state?.ok ? `${CHANNEL_LABELS[ch]} (template only)` : CHANNEL_LABELS[ch];
            return <Radio key={ch} value={ch} label={label} disabled={disabled} title={contactTooltip(ch, state)} />;
          })}
        </RadioGroup>
      </Field>
      <Field label="Subject">
        <Input value={subject} maxLength={200} onChange={(_, d) => setSubject(d.value)} disabled={!canDecide} />
      </Field>
      <Field label="Message" hint={counterText(message)}>
        <Textarea value={message} rows={12} maxLength={MESSAGE_MAX} onChange={(_, d) => setMessage(d.value)} disabled={!canDecide} resize="vertical" />
      </Field>
      {rejecting && (
        <Field label="Reason for rejecting" required validationMessage={note.trim().length < 3 ? "Add a short note (3+ characters)." : undefined}>
          <Input value={note} onChange={(_, d) => setNote(d.value)} />
        </Field>
      )}
      <div className={styles.footer}>
        <Button
          appearance="primary"
          disabled={!canDecide || busy || !message.trim() || channel !== "email"}
          icon={approve.isPending ? <Spinner size="tiny" /> : undefined}
          onClick={() => approve.mutate()}
        >
          Approve and send
        </Button>
        <Button
          disabled={!canDecide || busy}
          onClick={() =>
            reject.mutate("Replaced by a template message", {
              onSuccess: () => router.push(`/candidates/${entry.candidate_id}?tab=messages`),
            })
          }
        >
          Use a template instead
        </Button>
        {rejecting ? (
          <Button disabled={busy || note.trim().length < 3} onClick={() => reject.mutate(note.trim())}>
            Confirm reject
          </Button>
        ) : (
          <Button disabled={!canDecide || busy} onClick={() => setRejecting(true)}>
            Reject
          </Button>
        )}
      </div>
    </div>
  );
}
