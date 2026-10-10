"use client";

import {
  Body1,
  Button,
  Card,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular, DismissCircle48Regular, ErrorCircle48Regular } from "@fluentui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { linkErrorCopy } from "@/features/public-links/logic";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { clientApprovalLinkApi } from "./api";
import { commentError } from "./logic";

const useStyles = makeStyles({
  card: { width: "100%", padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  state: { display: "flex", flexDirection: "column", alignItems: "center", gap: tokens.spacingVerticalM, textAlign: "center" },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  no: { color: tokens.colorNeutralForeground3 },
  danger: { color: tokens.colorPaletteRedForeground1 },
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
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
});

/** Public `client_approval` secure link (Epic 18): the item's summary by kind (timesheet: hours by category +
 * flags), Approve / Reject (comment required), a done state, and 404 / 410 / 429 copy. */
export function PublicClientApproval({ token }: { token: string }) {
  const s = useStyles();
  const [comment, setComment] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const q = useQuery({ queryKey: ["public-client-approval", token], queryFn: ({ signal }) => clientApprovalLinkApi.view(token, signal), retry: false });
  const m = useMutation({ mutationFn: (d: "approve" | "reject") => clientApprovalLinkApi.decide(token, d, comment.trim() || null) });
  const failure = q.error ?? (m.error && isApiError(m.error) && (m.error.status === 410 || m.error.status === 404) ? m.error : null);
  if (failure) {
    const copy = isApiError(failure) ? linkErrorCopy(failure.status, failure.code) : linkErrorCopy(500, undefined);
    return (
      <Card className={s.card}>
        <div className={s.state}>
          <ErrorCircle48Regular aria-hidden className={s.danger} />
          <Text as="h1" size={600} weight="semibold">
            {copy.title}
          </Text>
          <Body1>{copy.body}</Body1>
        </div>
      </Card>
    );
  }
  if (!q.data) return <Spinner label="Loading" />;
  if (m.data) {
    const approved = m.data.status === "approved";
    return (
      <Card className={s.card}>
        <div className={s.state}>
          {approved ? <CheckmarkCircle48Regular aria-hidden className={s.ok} /> : <DismissCircle48Regular aria-hidden className={s.no} />}
          <Text as="h1" size={600} weight="semibold">
            {approved ? "Approved — thank you" : "Rejected — your comment was sent"}
          </Text>
          <Body1>There is nothing more to do on this page.</Body1>
        </div>
      </Card>
    );
  }
  const v = q.data;
  const err = rejecting ? commentError("reject", comment) : null;
  return (
    <Card className={s.card}>
      <Text as="h1" size={600} weight="semibold">
        {v.title}
      </Text>
      {v.subtitle ? <Body1>{v.subtitle}</Body1> : null}
      <dl className={s.dl}>
        {v.fields.map((f, i) => (
          <div key={`${f.label}-${i}`} style={{ display: "contents" }}>
            <dt>{f.label}</dt>
            <dd>{f.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {v.status !== "open" ? (
        <Body1>This item no longer needs your decision.</Body1>
      ) : (
        <>
          <Field label="Comment" required={rejecting} validationMessage={err ?? undefined}>
            <Textarea rows={3} value={comment} onChange={(_, d) => setComment(d.value)} />
          </Field>
          {m.error ? (
            <MessageBar intent="error" aria-live="assertive">
              <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
            </MessageBar>
          ) : null}
          <div className={s.actions}>
            <Button appearance="primary" disabled={m.isPending} onClick={() => m.mutate("approve")}>
              Approve
            </Button>
            <Button
              disabled={m.isPending}
              onClick={() => {
                setRejecting(true);
                if (!commentError("reject", comment)) m.mutate("reject");
              }}
            >
              Reject
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
