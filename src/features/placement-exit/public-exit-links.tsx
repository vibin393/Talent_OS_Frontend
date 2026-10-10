"use client";

import {
  Body1,
  Button,
  Card,
  Checkbox,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular, DismissCircle48Regular } from "@fluentui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatDate } from "@/features/placements/format";
import { publicExitApi } from "./api";
import { exitErrorMessage, extensionResponseState, offboardingResponseState, type ResponseState } from "./logic";

const useStyles = makeStyles({
  card: { width: "100%", padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  state: { display: "flex", flexDirection: "column", alignItems: "center", gap: tokens.spacingVerticalM, textAlign: "center" },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  no: { color: tokens.colorNeutralForeground3 },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    "& button": { minHeight: "44px", minWidth: "120px" },
    "@media (max-width: 480px)": { flexDirection: "column", "& button": { width: "100%" } },
  },
  dl: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0 },
  },
});

function Final({ state, title }: { state: ResponseState; title: string }) {
  const styles = useStyles();
  return (
    <Card className={styles.card}>
      <div className={styles.state}>
        {state === "confirmed" ? <CheckmarkCircle48Regular aria-hidden className={styles.ok} /> : <DismissCircle48Regular aria-hidden className={styles.no} />}
        <Text as="h1" size={600} weight="semibold">
          {title}
        </Text>
        <Body1>There is nothing more to do on this page.</Body1>
      </div>
    </Card>
  );
}

function Err({ message }: { message: string | null }) {
  return (
    <div aria-live="assertive">
      {message && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>{message}</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}

/** Purpose `extension_confirmation`: the client confirms or declines a proposed extension. */
export function PublicExtensionConfirmation({ token }: { token: string }) {
  const styles = useStyles();
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<ResponseState | null>(null);
  const view = useQuery({ queryKey: ["public-link", token, "extension"], queryFn: ({ signal }) => publicExitApi.extension(token, signal), retry: false });
  const m = useMutation({
    mutationFn: (decision: "confirm" | "decline") => publicExitApi.respondExtension(token, { decision, comment: comment.trim() || null }),
    onSuccess: (_, decision) => setDone(decision === "confirm" ? "confirmed" : "declined"),
  });
  if (done) return <Final state={done} title={done === "confirmed" ? "Thank you — extension confirmed" : "Your decline was recorded"} />;
  if (view.isPending) return <Spinner label="Loading…" />;
  if (view.isError) return <Err message={exitErrorMessage(view.error, "This link cannot be opened.")} />;
  const v = view.data;
  const state = extensionResponseState(v.status);
  if (state !== "awaiting") return <Final state={state} title={state === "confirmed" ? "This extension is confirmed" : state === "declined" ? "This extension was declined" : "This request is no longer open"} />;
  return (
    <Card className={styles.card}>
      <Text as="h1" size={600} weight="semibold">
        Confirm extension
      </Text>
      <Body1>
        {v.tenant_name ?? "Your staffing partner"} proposes to extend {v.worker_name ?? "the worker"}
        {v.role_title ? ` (${v.role_title})` : ""}.
      </Body1>
      <dl className={styles.dl}>
        <dt>Current end date</dt>
        <dd>{formatDate(v.current_end_date)}</dd>
        <dt>New end date</dt>
        <dd>
          <strong>{formatDate(v.new_end_date)}</strong>
        </dd>
        <dt>Link expires</dt>
        <dd>{formatDate(v.expires_at)}</dd>
      </dl>
      <Field label="Comment (optional)">
        <Textarea value={comment} onChange={(_, d) => setComment(d.value)} resize="vertical" />
      </Field>
      <Err message={m.isError ? exitErrorMessage(m.error) : null} />
      <div className={styles.actions}>
        <Button appearance="primary" disabled={m.isPending} onClick={() => m.mutate("confirm")}>
          Confirm
        </Button>
        <Button disabled={m.isPending} onClick={() => m.mutate("decline")}>
          Decline
        </Button>
      </div>
    </Card>
  );
}

/** Purpose `offboarding_confirmation`: the client acknowledges the worker's last working day. */
export function PublicOffboardingConfirmation({ token }: { token: string }) {
  const styles = useStyles();
  const [ack, setAck] = useState(false);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const view = useQuery({ queryKey: ["public-link", token, "offboarding"], queryFn: ({ signal }) => publicExitApi.offboarding(token, signal), retry: false });
  const m = useMutation({
    mutationFn: () => publicExitApi.confirmOffboarding(token, { last_working_day_ack: ack, comment: comment.trim() || null }),
    onSuccess: () => setDone(true),
  });
  if (done) return <Final state="confirmed" title="Thank you — last working day confirmed" />;
  if (view.isPending) return <Spinner label="Loading…" />;
  if (view.isError) return <Err message={exitErrorMessage(view.error, "This link cannot be opened.")} />;
  const v = view.data;
  const state = offboardingResponseState(v.status, v.client_confirmed);
  if (state !== "awaiting") return <Final state={state} title={state === "confirmed" ? "Already confirmed" : "This request is no longer open"} />;
  return (
    <Card className={styles.card}>
      <Text as="h1" size={600} weight="semibold">
        Confirm last working day
      </Text>
      <Body1>
        {v.tenant_name ?? "Your staffing partner"} asks you to confirm the last working day of {v.worker_name ?? "the worker"}
        {v.role_title ? ` (${v.role_title})` : ""}.
      </Body1>
      <dl className={styles.dl}>
        <dt>Last working day</dt>
        <dd>
          <strong>{formatDate(v.last_working_day)}</strong>
        </dd>
        <dt>Link expires</dt>
        <dd>{formatDate(v.expires_at)}</dd>
      </dl>
      <Checkbox checked={ack} onChange={(_, d) => setAck(!!d.checked)} label="I confirm this last working day" />
      <Field label="Comment (optional)">
        <Textarea value={comment} onChange={(_, d) => setComment(d.value)} resize="vertical" />
      </Field>
      <Err message={m.isError ? exitErrorMessage(m.error) : null} />
      <div className={styles.actions}>
        <Button appearance="primary" disabled={!ack || m.isPending} onClick={() => m.mutate()}>
          Confirm
        </Button>
      </div>
    </Card>
  );
}
