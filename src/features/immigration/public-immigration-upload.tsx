"use client";

import { Badge, Body1, Caption1, Card, Checkbox, makeStyles, MessageBar, MessageBarBody, Spinner, Text, tokens, typographyStyles } from "@fluentui/react-components";
import { ErrorCircle48Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { FileDrop } from "@/features/candidates/file-drop";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { publicImmigrationApi } from "./api";
import { fileError, formatDateTime, PORTAL_REQUEST_LABELS, publicCanUpload, UPLOAD_ACCEPT } from "./logic";
import type { PublicUploadItemOut, PublicUploadViewOut } from "./types";

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingHorizontalXL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    boxSizing: "border-box",
    "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL },
  },
  heading: { ...typographyStyles.title2, margin: 0, overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
  notice: {
    maxHeight: "320px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  checkbox: { minHeight: "44px", alignItems: "center" },
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalM,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  state: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalM },
  danger: { color: tokens.colorPaletteRedForeground1 },
});

function linkError(e: unknown): { title: string; body: string } {
  if (isApiError(e)) {
    if (e.code === "link_used") return { title: "This link has been used up", body: "Ask the sender for a new link if you still need to upload documents." };
    if (e.code === "link_expired" || e.status === 410) return { title: "This link has expired", body: "Ask the sender for a new link." };
    if (e.status === 404) return { title: "This link is not valid", body: "Open the link from the email you received, or contact the sender." };
  }
  return { title: "Something went wrong", body: errorMessage(e) };
}

/** Purpose `immigration_upload` (`/l/[token]`): counsel or a person without portal access uploads requested
 * documents. The notice is shown and the consent box must be ticked before any upload. Works from 360 px. */
export function PublicImmigrationUpload({ token }: { token: string }) {
  const styles = useStyles();
  const view = useQuery({
    queryKey: ["public", "immigration-upload", token],
    queryFn: ({ signal }) => publicImmigrationApi.view(token, signal),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [fatal, setFatal] = useState<unknown>(null);
  if (view.isPending) {
    return (
      <Card className={styles.card}>
        <Spinner label="Loading the document request…" />
      </Card>
    );
  }
  if (fatal || view.isError) {
    const copy = linkError(fatal ?? view.error);
    return (
      <Card className={styles.card}>
        <div className={styles.state} role="alert">
          <ErrorCircle48Regular aria-hidden className={styles.danger} />
          <h1 className={styles.heading}>{copy.title}</h1>
          <Body1>{copy.body}</Body1>
        </div>
      </Card>
    );
  }
  return <UploadForm token={token} view={view.data} onFatal={setFatal} />;
}

function UploadForm({ token, view, onFatal }: { token: string; view: PublicUploadViewOut; onFatal: (e: unknown) => void }) {
  const styles = useStyles();
  const noticeId = useId();
  const [consent, setConsent] = useState(false);
  const open = view.items.filter((i) => i.can_upload).length;
  return (
    <Card className={styles.card}>
      <h1 className={styles.heading}>Documents for case {view.reference}</h1>
      <Body1>
        {view.tenant_name ?? "The sender"} asks you to upload the documents listed below. This link expires on {formatDateTime(view.expires_at)}
        {view.uses_left >= 0 ? ` and can be used ${view.uses_left} more time${view.uses_left === 1 ? "" : "s"}` : ""}.
      </Body1>
      <section/* NOSONAR */ className={styles.notice} aria-labelledby={noticeId} tabIndex={0}>
        <Text id={noticeId} weight="semibold" block>
          {view.notice_title}
        </Text>
        <MarkdownView source={view.notice_body_md} />
      </section>
      {view.consent_required && (
        <Checkbox
          className={styles.checkbox}
          required
          label="I have read the notice and agree to these documents being shared for this immigration case"
          checked={consent}
          onChange={(_, d) => setConsent(Boolean(d.checked))}
        />
      )}
      {open === 0 && (
        <MessageBar intent="success" role="status">
          <MessageBarBody>Nothing more is needed. You can close this page.</MessageBarBody>
        </MessageBar>
      )}
      <ul className={styles.list}>
        {view.items.map((item) => (
          <ItemRow key={item.id} token={token} item={item} canUpload={publicCanUpload(view.consent_required, consent, item)} onFatal={onFatal} />
        ))}
      </ul>
      <Caption1 className={styles.muted}>Accepted: PDF, JPG or PNG up to 10 MB each.</Caption1>
    </Card>
  );
}

function ItemRow({
  token,
  item,
  canUpload,
  onFatal,
}: {
  token: string;
  item: PublicUploadItemOut;
  canUpload: boolean;
  onFatal: (e: unknown) => void;
}) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const onFiles = async ([file]: File[]) => {
    if (!file) return;
    const err = fileError(file);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await publicImmigrationApi.upload(token, item.id, file);
      setUploaded(file.name);
      void qc.invalidateQueries({ queryKey: ["public", "immigration-upload", token] });
    } catch (e) {
      if (isApiError(e) && (e.status === 410 || e.status === 404)) onFatal(e);
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={styles.item}>
      <div className={styles.row}>
        <Text weight="semibold">{item.label}</Text>
        <Badge appearance="tint" color={item.status === "verified" ? "success" : item.status === "rejected" ? "danger" : "informative"}>
          {PORTAL_REQUEST_LABELS[item.status] ?? item.status}
        </Badge>
      </div>
      {item.can_upload &&
        (canUpload ? (
          <FileDrop
            accept={UPLOAD_ACCEPT}
            title={busy ? "Uploading…" : `Upload ${item.label}`}
            buttonLabel="Choose file"
            disabled={busy}
            onFiles={(f) => void onFiles(f)}
          />
        ) : (
          <Caption1 className={styles.muted}>Tick the consent box above to upload.</Caption1>
        ))}
      {uploaded && (
        <Caption1 role="status" aria-live="polite">
          {uploaded} uploaded — thank you.
        </Caption1>
      )}
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
    </li>
  );
}
