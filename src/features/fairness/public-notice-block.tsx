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
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Info20Regular } from "@fluentui/react-icons";
import { useId, useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { publicFairnessApi } from "./api";
import { AEDT_FEATURE_LABELS, showNoticeBlock } from "./logic";
import type { AedtFeature, PublicNoticeOut } from "./types";
import { usePublicNotice } from "./use-fairness";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minWidth: 0 },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  text: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  list: { margin: 0, paddingLeft: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  muted: { color: tokens.colorNeutralForeground2 },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  button: { minHeight: "44px" },
});

function featureLabel(feature: string): string {
  return AEDT_FEATURE_LABELS[feature as AedtFeature] ?? feature;
}

/** The NYC Local Law 144 notice content (pure view of a notice that applies). */
export function NoticeContent({ notice, headingLevel = "h2" }: { notice: PublicNoticeOut; headingLevel?: "h2" | "h3" }) {
  const styles = useStyles();
  const id = useId();
  return (
    <>
      <div className={styles.head}>
        <Info20Regular aria-hidden />
        <Subtitle2 as={headingLevel} id={`${id}-t`}>
          Use of automated employment decision tools
        </Subtitle2>
      </div>
      {notice.notice_text && <Body1 className={styles.text}>{notice.notice_text}</Body1>}
      {notice.aedts.length > 0 && (
        <ul className={styles.list} aria-label="Tools used">
          {notice.aedts.map((a) => (
            <li key={`${a.name}-${a.version ?? ""}`}>
              <Text weight="semibold">{a.name}</Text>
              {a.version ? ` (version ${a.version})` : ""} – {featureLabel(a.feature)}
              {a.data_used ? <Text className={styles.muted}>. Data used: {a.data_used}</Text> : null}
            </li>
          ))}
        </ul>
      )}
      {notice.qualifications_text && (
        <Body1 className={styles.text}>
          <strong>Job qualifications and characteristics assessed: </strong>
          {notice.qualifications_text}
        </Body1>
      )}
      {notice.data_retention_text && (
        <Body1 className={styles.text}>
          <strong>Data type, source and retention: </strong>
          {notice.data_retention_text}
        </Body1>
      )}
      {notice.alternative_process_text && (
        <Body1 className={styles.text}>
          <strong>Alternative selection process or accommodation: </strong>
          {notice.alternative_process_text}
        </Body1>
      )}
    </>
  );
}

/**
 * LL144 notice block for a posting (Epic 49). Renders nothing unless the API says the notice applies. With an
 * `applyToken` (apply success step) it offers "Request an alternative process"; on the posting page it explains
 * that the request is available once the application is submitted.
 */
export function PublicNoticeBlock({ slug, postingId, applyToken }: { slug: string; postingId: string; applyToken?: string | null }) {
  const styles = useStyles();
  const q = usePublicNotice(slug, postingId);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!showNoticeBlock(q.data)) return null;

  const request = async () => {
    if (!applyToken) return;
    setState("busy");
    setError(null);
    try {
      await publicFairnessApi.requestAlternative(slug, applyToken, note.trim() || null);
      setState("done");
    } catch (e) {
      setState("idle");
      if (isApiError(e) && e.status === 410) setError("This page has expired. Request an alternative process from the candidate portal instead.");
      else if (isApiError(e) && e.status === 409) setState("done");
      else setError(errorMessage(e));
    }
  };

  return (
    <Card className={styles.card} role="region" aria-label="Automated employment decision tools notice">
      <NoticeContent notice={q.data} />
      {applyToken ? (
        state === "done" ? (
          <MessageBar intent="success" layout="multiline" role="status">
            <MessageBarBody>Your request for an alternative process was received. A recruiter will contact you.</MessageBarBody>
          </MessageBar>
        ) : (
          <>
            <Field label="Note (optional)" hint="For example, the accommodation you need.">
              <Textarea value={note} maxLength={1000} onChange={(_, d) => setNote(d.value)} disabled={state === "busy"} />
            </Field>
            {error && (
              <MessageBar intent="error" layout="multiline" role="alert">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            <div className={styles.actions}>
              <Button className={styles.button} disabled={state === "busy"} icon={state === "busy" ? <Spinner size="tiny" /> : undefined} onClick={request}>
                Request an alternative process
              </Button>
            </div>
          </>
        )
      ) : (
        <Text className={styles.muted}>You can request an alternative selection process or an accommodation after you submit your application.</Text>
      )}
    </Card>
  );
}
