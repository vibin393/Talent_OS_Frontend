"use client";

import {
  Body1,
  Button,
  Card,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { ApiError, toApiError } from "@/lib/api/errors";
import type { PublicLinkView } from "@/lib/api/types";
import { formatDate } from "./format";
import { type JoiningState, joiningErrorMessage, joiningScreen } from "./public-joining-logic";
import type { JoiningLinkInfo } from "./types";

const useStyles = makeStyles({
  card: { maxWidth: "560px", width: "100%", padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  state: { display: "flex", flexDirection: "column", alignItems: "center", gap: tokens.spacingVerticalM, textAlign: "center" },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  button: { minHeight: "44px" },
});

async function respond(token: string, response: "confirmed" | "question", note: string | null): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/public/links/${encodeURIComponent(token)}/joining`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ response, note }),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return String((body as { status?: string } | null)?.status ?? "");
}

/** Purpose `joining_confirmation`: confirm the start date or ask a question (one use). */
export function PublicJoiningConfirmation({ token, view }: { token: string; view: PublicLinkView }) {
  const styles = useStyles();
  const info = (view as PublicLinkView & { joining?: JoiningLinkInfo | null }).joining ?? null;
  const [state, setState] = useState<JoiningState>(() => joiningScreen(view as PublicLinkView & { joining?: JoiningLinkInfo | null }));
  const [choice, setChoice] = useState<"confirmed" | "question">("confirmed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state !== "form") {
    const text =
      state === "confirmed"
        ? "Thank you — your joining is confirmed. See you on your first day."
        : state === "question_sent"
          ? "Thanks — your recruiter will get back to you shortly."
          : "You have already responded to this reminder.";
    return (
      <Card className={styles.card}>
        <div className={styles.state}>
          <CheckmarkCircle48Regular aria-hidden className={styles.ok} />
          <Body1 role="status">{text}</Body1>
        </div>
      </Card>
    );
  }
  return (
    <Card className={styles.card}>
      <Text as="h1" size={500} weight="semibold">
        {info?.candidate_first_name ? `Hi ${info.candidate_first_name}, are you joining?` : "Are you joining?"}
      </Text>
      <Body1>
        {info?.role_title ?? view.job_title ?? "Your new role"}
        {info?.client_name ? ` at ${info.client_name}` : ""} starts on {formatDate(info?.planned_start_date)}.
      </Body1>
      <RadioGroup value={choice} onChange={(_, d) => setChoice(d.value as "confirmed" | "question")} aria-label="Your response">
        <Radio value="confirmed" label="Yes, I confirm I am joining" />
        <Radio value="question" label="I have a question" />
      </RadioGroup>
      <Field label={choice === "question" ? "Your question" : "Note (optional)"}>
        <Textarea value={note} maxLength={2000} onChange={(_, d) => setNote(d.value)} />
      </Field>
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <Button
        appearance="primary"
        className={styles.button}
        disabled={busy || (choice === "question" && !note.trim())}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const status = await respond(token, choice, note.trim() || null);
            setState(status === "confirmed" ? "confirmed" : "question_sent");
          } catch (e) {
            setError(joiningErrorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Send
      </Button>
    </Card>
  );
}
