"use client";

/**
 * Portal Copilot panel (Epic 77 B1/B2): one shared panel for the Client, Vendor and Candidate portals. It reuses the
 * P4 Copilot pieces (`Composer`, `AnswerMarkdown`, `useCopilotStream` with this portal's `apiBase` / answer poll; no
 * second Copilot stack, AD-89). A floating "Ask Copilot" button opens a Fluent `OverlayDrawer` (full width at 360 px,
 * focus-trapped, Escape closes). The panel mounts only when `GET <apiBase>/status` answers for a signed-in principal.
 */
import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dropdown,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  OverlayDrawer,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import {
  Dismiss24Regular,
  History20Regular,
  Open20Regular,
  Sparkle20Regular,
  ThumbDislike20Regular,
  ThumbLike20Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { AnswerMarkdown } from "@/features/copilot/answer-markdown";
import { Composer } from "@/features/copilot/composer";
import { type StreamTarget, useCopilotStream } from "@/features/copilot/use-copilot-stream";
import { isApiError } from "@/lib/api/errors";
import { useMediaQuery } from "@/lib/use-media-query";
import { portalCopilotApi, portalCopilotKeys } from "./api";
import {
  allowedLink,
  draftTitle,
  FEEDBACK_REASONS,
  isExpired,
  isPublicPath,
  linkLabel,
  PC_COPY,
  PLACEHOLDER,
  rateLimitText,
  STARTERS,
  TALK_TO_PERSON,
  unavailableText,
} from "./logic";
import type { PortalDraft, PortalKind, PortalMessage } from "./types";

const useStyles = makeStyles({
  fab: { position: "fixed", right: tokens.spacingHorizontalXL, bottom: tokens.spacingVerticalXL, zIndex: 10 },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, paddingBottom: tokens.spacingVerticalM },
  subtitle: { color: tokens.colorNeutralForeground3 },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, flex: 1, overflowY: "auto" },
  user: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    background: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusLarge,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
  },
  assistant: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  fields: { display: "grid", gridTemplateColumns: "auto 1fr", columnGap: tokens.spacingHorizontalS, rowGap: "2px" },
  muted: { color: tokens.colorNeutralForeground3 },
});

function Drafts({ portal, drafts }: { portal: PortalKind; drafts: PortalDraft[] }) {
  return (
    <>
      {drafts.map((d) => (
        <DraftCard key={d.proposal_id} portal={portal} draft={d} />
      ))}
    </>
  );
}

/** Draft card (B1): Confirm / Edit / Discard; "Done" with link after confirm; expired drafts ask again. */
export function DraftCard({ portal, draft }: { portal: PortalKind; draft: PortalDraft }) {
  const styles = useStyles();
  const api = useMemo(() => portalCopilotApi(portal), [portal]);
  const [state, setState] = useState<"idle" | "busy" | "done" | "discarded" | "error">("idle");
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textFields = draft.editable_fields.filter((f) => ["text", "question", "comment", "title", "description", "headline", "reason"].includes(f));
  if (isExpired(draft)) {
    return (
      <MessageBar intent="warning">
        <MessageBarBody>{PC_COPY.expired}</MessageBarBody>
      </MessageBar>
    );
  }
  const confirm = async () => {
    setState("busy");
    setError(null);
    try {
      const out = await api.confirm(draft.proposal_id, editing && Object.keys(edits).length ? edits : null);
      setOpenUrl(out.open_url);
      setState(out.status === "executed" ? "done" : "error");
      if (out.status !== "executed") setError(out.error_code ?? "Couldn't complete the draft.");
    } catch (e) {
      setState("error");
      setError(isApiError(e) && e.status === 409 ? PC_COPY.expired : "Couldn't complete the draft.");
    }
  };
  const discard = async () => {
    setState("busy");
    try {
      await api.discard(draft.proposal_id);
      setState("discarded");
    } catch {
      setState("error");
    }
  };
  return (
    <Card size="small" aria-label={draftTitle(draft)}>
      <CardHeader header={<Text weight="semibold">{draftTitle(draft)}</Text>} />
      {draft.preview?.summary && <Body1>{draft.preview.summary}</Body1>}
      {!!draft.preview?.fields.length && (
        <div className={styles.fields}>
          {draft.preview.fields.map(([k, v]) => (
            <span key={k} style={{ display: "contents" }}>
              <Caption1 className={styles.muted}>{k}</Caption1>
              <Caption1>{v}</Caption1>
            </span>
          ))}
        </div>
      )}
      {editing &&
        textFields.map((f) => (
          <Field key={f} label={f.replace(/_/g, " ")}>
            <Textarea value={edits[f] ?? ""} onChange={(_, d) => setEdits((x) => ({ ...x, [f]: d.value }))} />
          </Field>
        ))}
      {state === "done" ? (
        <div className={styles.row}>
          <Text>{PC_COPY.done}</Text>
          {openUrl && allowedLink(portal, openUrl) && (
            <Button as="a" href={openUrl} appearance="primary" size="small" icon={<Open20Regular />}>
              {linkLabel(openUrl)}
            </Button>
          )}
        </div>
      ) : state === "discarded" ? (
        <Caption1 className={styles.muted}>Discarded.</Caption1>
      ) : (
        <div className={styles.row}>
          <Button appearance="primary" size="small" disabled={state === "busy"} onClick={confirm}>
            {PC_COPY.confirm}
          </Button>
          {textFields.length > 0 && (
            <Button size="small" disabled={state === "busy"} onClick={() => setEditing((v) => !v)}>
              {PC_COPY.edit}
            </Button>
          )}
          <Button size="small" appearance="subtle" disabled={state === "busy"} onClick={discard}>
            {PC_COPY.discard}
          </Button>
        </div>
      )}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
    </Card>
  );
}

function Feedback({ portal, runId }: { portal: PortalKind; runId: string }) {
  const styles = useStyles();
  const api = useMemo(() => portalCopilotApi(portal), [portal]);
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const send = (r: "up" | "down", reason?: string) => {
    setRating(r);
    void api.feedback(runId, r, reason).catch(() => undefined);
  };
  return (
    <div className={styles.row}>
      <Button size="small" appearance={rating === "up" ? "primary" : "subtle"} icon={<ThumbLike20Regular />} aria-label={PC_COPY.helpful} onClick={() => send("up")} />
      <Button size="small" appearance={rating === "down" ? "primary" : "subtle"} icon={<ThumbDislike20Regular />} aria-label={PC_COPY.notHelpful} onClick={() => send("down")} />
      {rating === "down" && (
        <Dropdown size="small" placeholder="Why?" aria-label="Why?" onOptionSelect={(_, d) => send("down", d.optionValue)}>
          {FEEDBACK_REASONS.map((r) => (
            <Option key={r.value} value={r.value}>
              {r.label}
            </Option>
          ))}
        </Dropdown>
      )}
    </div>
  );
}

function Message({ portal, m }: { portal: PortalKind; m: PortalMessage }) {
  const styles = useStyles();
  if (m.role === "user") return <Body1 className={styles.user}>{m.content.text}</Body1>;
  if (m.role === "event") return <Caption1 className={styles.muted}>{m.content.message}</Caption1>;
  const links = (m.content.links ?? []).filter((l) => allowedLink(portal, l));
  return (
    <div className={styles.assistant}>
      <AnswerMarkdown text={m.content.text ?? ""} refs={[]} />
      {links.length > 0 && (
        <div className={styles.row}>
          {links.map((l) => (
            <Button key={l} as="a" href={l} size="small" icon={<Open20Regular />}>
              {linkLabel(l)}
            </Button>
          ))}
        </div>
      )}
      <Drafts portal={portal} drafts={m.content.drafts ?? []} />
      {m.run_id && <Feedback portal={portal} runId={m.run_id} />}
    </div>
  );
}

/** The panel itself (exported for tests). */
export function PortalCopilotPanel({ portal, onClose }: { portal: PortalKind; onClose: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const api = useMemo(() => portalCopilotApi(portal), [portal]);
  const status = useQuery({ queryKey: portalCopilotKeys.status(portal), queryFn: ({ signal }) => api.status(signal), retry: false });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [target, setTarget] = useState<StreamTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const conversation = useQuery({
    queryKey: portalCopilotKeys.conversation(portal, conversationId ?? "none"),
    queryFn: ({ signal }) => api.conversation(conversationId as string, signal),
    enabled: conversationId !== null,
  });
  const history = useQuery({ queryKey: portalCopilotKeys.conversations(portal), queryFn: ({ signal }) => api.conversations(signal), enabled: showHistory });
  const stream = useCopilotStream(
    target,
    { onDone: () => void qc.invalidateQueries({ queryKey: portalCopilotKeys.conversation(portal, conversationId ?? "none") }) },
    {
      apiBase: api.base,
      pollAnswer: async (t) => {
        const conv = await api.conversation(t.conversationId);
        const answer = conv.messages.find((m) => m.role === "assistant" && m.run_id === t.runId);
        return answer
          ? { text: answer.content.text ?? "", tools: [], drafts: [], done: true, status: "completed", reasonCode: null, lastId: null, mode: "poll" }
          : null;
      },
    },
  );
  const s = status.data;
  const tenant = s?.tenant_name ?? "";

  const ask = async (text: string) => {
    setNotice(null);
    try {
      let id = conversationId;
      if (!id) {
        id = (await api.create()).id;
        setConversationId(id);
      }
      const turn = await api.ask(id, text);
      await qc.invalidateQueries({ queryKey: portalCopilotKeys.conversation(portal, id) });
      if (turn.run_id && turn.stream_url) setTarget({ runId: turn.run_id, streamUrl: turn.stream_url, conversationId: id, afterSeq: turn.message.seq });
    } catch (e) {
      if (isApiError(e) && e.status === 429) {
        const retry = Number(e.details.retry_after_s ?? 3600);
        setNotice(rateLimitText(retry));
      } else if (isApiError(e) && (e.status === 403 || e.status === 409)) {
        setNotice("Your access changed. Refresh the page.");
      } else {
        setNotice("Copilot couldn't answer right now. Try again.");
      }
    }
  };

  const consent = async () => {
    if (!s?.consent_notice_id) return;
    await api.consent(s.consent_notice_id);
    await qc.invalidateQueries({ queryKey: portalCopilotKeys.status(portal) });
  };

  const streaming = target !== null && !stream.done;
  const messages = conversation.data?.messages ?? [];
  const blocked = s ? unavailableText(s.reason, tenant) : null;

  return (
    <>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <div className={styles.row}>
              <Button appearance="subtle" icon={<History20Regular />} aria-label={PC_COPY.history} onClick={() => setShowHistory((v) => !v)} />
              <Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="Close" onClick={onClose} />
            </div>
          }
        >
          {PC_COPY.title}
        </DrawerHeaderTitle>
        {tenant && <Caption1 className={styles.subtitle}>{PC_COPY.subtitle(tenant)}</Caption1>}
      </DrawerHeader>
      <DrawerBody className={styles.body}>
        {status.isPending && <Spinner size="small" label="Loading" />}
        {s && (
          <MessageBar intent="info">
            <MessageBarBody>
              {PC_COPY.disclosure(tenant)}
              {s.disclosure_extra ? ` ${s.disclosure_extra}` : ""}{" "}
              <Button appearance="transparent" size="small" disabled={!s.available} onClick={() => void ask(TALK_TO_PERSON[portal])}>
                {PC_COPY.talkToPerson}
              </Button>
            </MessageBarBody>
          </MessageBar>
        )}
        {s?.reason === "consent_required" && (
          <Card aria-label={PC_COPY.consentTitle}>
            <CardHeader header={<Text weight="semibold">{PC_COPY.consentTitle}</Text>} />
            <Body1>{s.consent_notice_text}</Body1>
            <NextLink href="/portal/privacy">{PC_COPY.privacyNotice}</NextLink>
            <div className={styles.row}>
              <Button appearance="primary" onClick={() => void consent()}>
                {PC_COPY.consentAllow}
              </Button>
              <Button onClick={onClose}>{PC_COPY.consentLater}</Button>
            </div>
          </Card>
        )}
        {blocked && (
          <MessageBar intent="warning">
            <MessageBarBody>{blocked}</MessageBarBody>
          </MessageBar>
        )}
        {notice && (
          <MessageBar intent="warning">
            <MessageBarBody>{notice}</MessageBarBody>
          </MessageBar>
        )}
        {showHistory && (
          <div className={styles.list} aria-label={PC_COPY.history}>
            <Button
              appearance="primary"
              size="small"
              onClick={() => {
                setConversationId(null);
                setTarget(null);
                setShowHistory(false);
              }}
            >
              {PC_COPY.newChat}
            </Button>
            {(history.data?.items ?? []).map((c) => (
              <Button
                key={c.id}
                appearance="subtle"
                onClick={() => {
                  setConversationId(c.id);
                  setShowHistory(false);
                }}
              >
                {c.title ?? "Conversation"}
              </Button>
            ))}
            {s && <Caption1 className={styles.muted}>{PC_COPY.keptFor(s.retention_days)}</Caption1>}
          </div>
        )}
        {!showHistory && s?.available && (
          <>
            <div className={styles.list} aria-live="polite">
              {messages.length === 0 && (
                <div className={styles.row}>
                  {STARTERS[portal].map((q) => (
                    <Button key={q} size="small" shape="circular" onClick={() => void ask(q)}>
                      {q}
                    </Button>
                  ))}
                </div>
              )}
              {messages.map((m) => (
                <Message key={m.id} portal={portal} m={m} />
              ))}
              {streaming && stream.text && <AnswerMarkdown text={stream.text} refs={[]} />}
              {streaming && !stream.text && <Spinner size="tiny" label="Thinking" />}
            </div>
            <Composer
              placeholder={PLACEHOLDER[portal]}
              streaming={streaming}
              onSend={(t) => void ask(t)}
              onStop={() => {
                if (target) void api.cancel(target.runId).catch(() => undefined);
              }}
            />
          </>
        )}
      </DrawerBody>
    </>
  );
}

/** Mount point used by the portal layouts: hidden on sign-in pages and until the status call answers. */
export function PortalCopilot({ portal }: { portal: PortalKind }) {
  const styles = useStyles();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const narrow = useMediaQuery("(max-width: 480px)");
  const isPublic = isPublicPath(portal, pathname);
  const api = useMemo(() => portalCopilotApi(portal), [portal]);
  const status = useQuery({
    queryKey: portalCopilotKeys.status(portal),
    queryFn: ({ signal }) => api.status(signal),
    enabled: !isPublic,
    retry: false,
    staleTime: 60_000,
  });
  const s = status.data;
  // Mount when the portal Copilot is on for this principal (or the Candidate only needs to consent).
  const show = !isPublic && !!s && (s.available || s.reason === "consent_required");
  if (!show) return null;
  return (
    <>
      <Button className={styles.fab} appearance="primary" icon={<Sparkle20Regular />} onClick={() => setOpen(true)} aria-expanded={open}>
        {PC_COPY.toggle}
      </Button>
      <OverlayDrawer position="end" size={narrow ? "full" : "medium"} open={open} onOpenChange={(_, d) => setOpen(d.open)} aria-label={PC_COPY.title}>
        {open && <PortalCopilotPanel portal={portal} onClose={() => setOpen(false)} />}
      </OverlayDrawer>
    </>
  );
}
