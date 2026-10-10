"use client";

import { Badge, Body1, Button, Card, Checkbox, Field, Subtitle2, Text, Textarea } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { formatDate } from "@/features/placements/format";
import { clientExitApi, clientExitKeys } from "./api";
import { CASE_REASON_LABELS, exitErrorMessage, extensionResponseState, offboardingResponseState, RESPONSE_COPY, type ResponseState } from "./logic";
import type { CaseReason, ClientExtensionSummary, ClientOffboardingSummary } from "./types";

const STATE_COLORS: Record<ResponseState, "warning" | "success" | "danger" | "subtle"> = {
  awaiting: "warning",
  confirmed: "success",
  declined: "danger",
  closed: "subtle",
};

function ExtensionCard({ ext }: { ext: ClientExtensionSummary }) {
  const portal = usePortalStyles();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const state = extensionResponseState(ext.status);
  const m = useMutation({
    mutationFn: (decision: "confirm" | "decline") =>
      clientExitApi.respond(ext.placement_id, ext.id, { decision, comment: comment.trim() || null }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clientExitKeys.extensions }),
  });
  return (
    <Card className={portal.card}>
      <Subtitle2 as="h3">
        {ext.worker_name ?? "Worker"} · {ext.role_title ?? ext.placement_human_id}
      </Subtitle2>
      <Badge appearance="tint" color={STATE_COLORS[state]}>
        {RESPONSE_COPY[state]}
      </Badge>
      <dl className={portal.dl}>
        <dt>Current end date</dt>
        <dd>{formatDate(ext.current_end_date)}</dd>
        <dt>Proposed new end date</dt>
        <dd>
          <strong>{formatDate(ext.new_end_date)}</strong>
        </dd>
        {ext.client_comment && (
          <>
            <dt>Your comment</dt>
            <dd>{ext.client_comment}</dd>
          </>
        )}
      </dl>
      {state === "awaiting" && (
        <>
          <Field label="Comment (optional)">
            <Textarea value={comment} onChange={(_, d) => setComment(d.value)} resize="vertical" />
          </Field>
          <InlineError message={m.isError ? exitErrorMessage(m.error) : null} />
          <div className={portal.actions}>
            <Button className={portal.button} appearance="primary" disabled={m.isPending} onClick={() => m.mutate("confirm")}>
              Confirm extension
            </Button>
            <Button className={portal.button} disabled={m.isPending} onClick={() => m.mutate("decline")}>
              Decline
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function OffboardingCard({ c }: { c: ClientOffboardingSummary }) {
  const portal = usePortalStyles();
  const qc = useQueryClient();
  const [ack, setAck] = useState(false);
  const [comment, setComment] = useState("");
  const state = offboardingResponseState(c.status, c.client_confirmed_at !== null);
  const m = useMutation({
    mutationFn: () => clientExitApi.confirmOffboarding(c.placement_id, { last_working_day_ack: ack, comment: comment.trim() || null }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clientExitKeys.offboarding }),
  });
  return (
    <Card className={portal.card}>
      <Subtitle2 as="h3">
        {c.worker_name ?? "Worker"} · {c.role_title ?? c.placement_human_id}
      </Subtitle2>
      <Badge appearance="tint" color={STATE_COLORS[state]}>
        {RESPONSE_COPY[state]}
      </Badge>
      <dl className={portal.dl}>
        <dt>Reason</dt>
        <dd>{CASE_REASON_LABELS[c.reason as CaseReason] ?? c.reason}</dd>
        <dt>Last working day</dt>
        <dd>
          <strong>{formatDate(c.last_working_day)}</strong>
        </dd>
      </dl>
      {state === "awaiting" && (
        <>
          <Checkbox checked={ack} onChange={(_, d) => setAck(!!d.checked)} label="I confirm the last working day above" />
          <Field label="Comment (optional)">
            <Textarea value={comment} onChange={(_, d) => setComment(d.value)} resize="vertical" />
          </Field>
          <InlineError message={m.isError ? exitErrorMessage(m.error) : null} />
          <div className={portal.actions}>
            <Button className={portal.button} appearance="primary" disabled={!ack || m.isPending} onClick={() => m.mutate()}>
              Confirm
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/** `/client/placements`: extension requests and offboarding confirmations (mobile-first). */
export function ClientPlacementsPage() {
  const portal = usePortalStyles();
  const exts = useQuery({ queryKey: clientExitKeys.extensions, queryFn: ({ signal }) => clientExitApi.extensions(signal), retry: false });
  const offs = useQuery({ queryKey: clientExitKeys.offboarding, queryFn: ({ signal }) => clientExitApi.offboarding(signal), retry: false });
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Placements" subtitle="Confirm extensions and last working days for your workers." />
      <Text as="h2" weight="semibold" size={400}>
        Extension requests
      </Text>
      {exts.isPending ? (
        <LoadingBlock />
      ) : exts.isError ? (
        <ErrorBlock error={exts.error} onRetry={() => void exts.refetch()} />
      ) : exts.data.length === 0 ? (
        <Body1 className={portal.empty}>No extension requests.</Body1>
      ) : (
        exts.data.map((e) => <ExtensionCard key={e.id} ext={e} />)
      )}
      <Text as="h2" weight="semibold" size={400}>
        Offboarding
      </Text>
      {offs.isPending ? (
        <LoadingBlock />
      ) : offs.isError ? (
        <ErrorBlock error={offs.error} onRetry={() => void offs.refetch()} />
      ) : offs.data.length === 0 ? (
        <Body1 className={portal.empty}>No offboarding to confirm.</Body1>
      ) : (
        offs.data.map((c) => <OffboardingCard key={c.id} c={c} />)
      )}
    </div>
  );
}
