"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  mergeClasses,
  Spinner,
  Text,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular, Clock20Regular, ErrorCircle48Regular, Timer48Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useMediaQuery } from "@/lib/use-media-query";
import { portalTakingAdapter, publicTakingAdapter, type TakingAdapter, takingApi } from "./api";
import { ItemResponse } from "./item-renderers";
import {
  AutosaveQueue,
  type ClockSync,
  dueWarning,
  formatClock,
  isAnswered,
  isCodeKind,
  remainingSeconds,
  SignalBatcher,
  signalLabel,
  syncClock,
  takingErrorState,
} from "./logic";
import type { AttemptView, ClientSignalKind, DeliveryItem, PreStartOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, width: "100%", maxWidth: "880px", marginInline: "auto", boxSizing: "border-box" },
  card: {
    padding: tokens.spacingHorizontalXL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    "@media (max-width: 480px)": { padding: tokens.spacingHorizontalM },
  },
  heading: { ...typographyStyles.title2, margin: 0, overflowWrap: "anywhere", ":focus": { outlineStyle: "none" }, ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` } },
  h2: { ...typographyStyles.subtitle1, margin: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  notice: {
    maxHeight: "280px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  list: { margin: 0, paddingInlineStart: tokens.spacingHorizontalXL },
  agree: { minHeight: "44px", alignItems: "center" },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    "& button": { minHeight: "44px", minWidth: "120px" },
    "@media (max-width: 480px)": { flexDirection: "column", "& button": { width: "100%" } },
  },
  bar: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    borderRadius: tokens.borderRadiusMedium,
  },
  timer: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS, ...typographyStyles.subtitle1, fontVariantNumeric: "tabular-nums" },
  timerLow: { color: tokens.colorPaletteRedForeground1 },
  grow: { flex: 1 },
  nav: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, listStyleType: "none", margin: 0, padding: 0 },
  navBtn: { minHeight: "44px" },
  question: {
    padding: tokens.spacingHorizontalL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    "@media (max-width: 480px)": { padding: tokens.spacingHorizontalM },
  },
  qHead: { display: "flex", justifyContent: "space-between", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  state: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalM },
  success: { color: tokens.colorPaletteGreenForeground1 },
  danger: { color: tokens.colorPaletteRedForeground1 },
});

const AUTOSAVE_MS = 15_000;
const CHANGE_DEBOUNCE_MS = 1_200;
const SIGNAL_MS = 10_000;
const RETRY_MS = 5_000;

type End = "submitted" | "time_up" | "replaced" | "already";

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function storedSession(key: string): string | null {
  try {
    return sessionStorage.getItem(`asm-session:${key}`);
  } catch {
    return null;
  }
}
function storeSession(key: string, id: string | null) {
  try {
    if (id) sessionStorage.setItem(`asm-session:${key}`, id);
    else sessionStorage.removeItem(`asm-session:${key}`);
  } catch {
    // storage unavailable: the session lives in memory only
  }
}

/** Heading that takes focus when the screen changes, so screen readers announce the new state. */
function Heading({ children, level = 1 }: { children: React.ReactNode; level?: 1 | 2 }) {
  const styles = useStyles();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <Tag ref={ref} tabIndex={-1} className={styles.heading}>
      {children}
    </Tag>
  );
}

function EndState({ end }: { end: End }) {
  const styles = useStyles();
  const copy: Record<End, { title: string; body: string; ok: boolean }> = {
    submitted: { title: "Your answers were submitted", body: "Thank you. The recruiter will be in touch about the next steps.", ok: true },
    time_up: { title: "Time is up — your answers were submitted.", body: "Everything you saved before the deadline was submitted. You can close this page.", ok: true },
    already: { title: "This test is already submitted", body: "There is nothing more to do here.", ok: true },
    replaced: {
      title: "This test was opened in another window",
      body: "To protect your answers, only one window can be used at a time. Continue in the other window, or reload this page to continue here.",
      ok: false,
    },
  };
  const c = copy[end];
  return (
    <Card className={styles.card}>
      <div className={styles.state} role="status">
        {end === "time_up" ? <Timer48Regular aria-hidden /> : c.ok ? <CheckmarkCircle48Regular aria-hidden className={styles.success} /> : <ErrorCircle48Regular aria-hidden className={styles.danger} />}
        <Heading>{c.title}</Heading>
        <Body1>{c.body}</Body1>
        {end === "replaced" && <Button onClick={() => window.location.reload()}>Continue in this window</Button>}
      </div>
    </Card>
  );
}

/** Candidate test-taking UI, shared by the candidate portal and the public link; `adapter` picks the base URL. */
export function AssessmentTaking({ adapter }: { adapter: TakingAdapter }) {
  const styles = useStyles();
  const api = useMemo(() => takingApi(adapter), [adapter]);
  const [attempt, setAttempt] = useState<{ view: AttemptView; session: string | null } | null>(null);
  const [end, setEnd] = useState<End | null>(null);
  const pre = useQuery({
    queryKey: ["assessment-taking", adapter.key],
    queryFn: ({ signal }) => api.preStart(signal),
    retry: (n, e) => n < 1 && (!isApiError(e) || e.status === 0 || e.status >= 500),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const begin = (view: AttemptView, fallbackSession: string | null) => {
    const session = view.session_id ?? fallbackSession;
    storeSession(adapter.key, session);
    if (view.status !== "in_progress") setEnd("already");
    else setAttempt({ view, session });
  };

  if (end) return <div className={styles.root}><EndState end={end} /></div>;
  if (attempt)
    return (
      <AttemptRunner
        api={api}
        initial={attempt.view}
        session={attempt.session}
        onSession={(id) => storeSession(adapter.key, id)}
        onEnd={(e) => {
          storeSession(adapter.key, null);
          setEnd(e);
        }}
      />
    );
  if (pre.isPending)
    return (
      <Card className={styles.card}>
        <Spinner label="Loading your test…" />
      </Card>
    );
  if (pre.isError)
    return (
      <Card className={styles.card}>
        <div className={styles.state} role="alert">
          <ErrorCircle48Regular aria-hidden className={styles.danger} />
          <Heading>{isApiError(pre.error) && (pre.error.status === 404 || pre.error.status === 410) ? "This test link is not available" : "Something went wrong"}</Heading>
          <Body1>{isApiError(pre.error) && (pre.error.status === 404 || pre.error.status === 410) ? "It may have expired or been cancelled. Contact the recruiter for help." : errorMessage(pre.error)}</Body1>
        </div>
      </Card>
    );
  return <PreStart pre={pre.data} api={api} adapterKey={adapter.key} onBegin={begin} />;
}

type Api = ReturnType<typeof takingApi>;

function PreStart({ pre, api, adapterKey, onBegin }: { pre: PreStartOut; api: Api; adapterKey: string; onBegin: (v: AttemptView, session: string | null) => void }) {
  const styles = useStyles();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = ["completed", "reviewed", "passed", "failed"].includes(pre.status);
  const closed = pre.status === "expired" || pre.status === "cancelled";

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      if (pre.has_active_attempt) {
        const prior = storedSession(adapterKey);
        onBegin(await api.attempt(prior), prior);
      } else onBegin(await api.start(pre.notice.notice_id), null);
    } catch (e) {
      const state = isApiError(e) ? takingErrorState(e.code) : null;
      setError(state === "time_up" ? "The deadline for this test has passed." : state === "submitted" ? "This test is already submitted." : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (done || closed)
    return (
      <Card className={styles.card}>
        <div className={styles.state} role="status">
          <Heading>{pre.assessment_name}</Heading>
          <Body1>{done ? "You have already completed this test. Thank you." : pre.status === "expired" ? "The deadline for this test has passed. Contact the recruiter if you need more time." : "This test was cancelled."}</Body1>
        </div>
      </Card>
    );

  if (pre.delivery === "provider")
    return (
      <Card className={styles.card}>
        <Heading>{pre.assessment_name}</Heading>
        {pre.instructions && <MarkdownView source={pre.instructions} />}
        <Body1>This test is taken on our assessment partner&apos;s site{pre.deadline_at ? ` before ${fmtDateTime(pre.deadline_at)}` : ""}.</Body1>
        {pre.take_url ? (
          <Link href={pre.take_url} target="_blank" rel="noopener noreferrer">
            Open the test
          </Link>
        ) : (
          <Body1 className={styles.muted}>You will receive the test link by email.</Body1>
        )}
      </Card>
    );

  const minutes = pre.time_limit_minutes;
  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <Heading>{pre.assessment_name}</Heading>
        <ul className={styles.list}>
          <li>{minutes ? `Time limit: ${minutes} minutes${Number(pre.accommodation_factor) > 1 ? ` (includes your ×${pre.accommodation_factor} time accommodation)` : ""}.` : "There is no time limit."}</li>
          {pre.deadline_at && <li>Finish before {fmtDateTime(pre.deadline_at)}.</li>}
          <li>Your answers are saved automatically as you go. The timer keeps running if you close the page.</li>
        </ul>
        {pre.instructions && (
          <section aria-label="Instructions">
            <MarkdownView source={pre.instructions} />
          </section>
        )}
        {pre.sections.length > 0 && (
          <section>
            <h2 className={styles.h2}>Sections</h2>
            <ol className={styles.list}>
              {pre.sections.map((s) => (
                <li key={s.key}>
                  {s.title} · {s.item_count} question{s.item_count === 1 ? "" : "s"}
                  {s.time_limit_minutes ? ` · ${s.time_limit_minutes} min` : ""}
                </li>
              ))}
            </ol>
          </section>
        )}
      </Card>
      <Card className={styles.card}>
        <h2 className={styles.h2}>{pre.notice.title || "Before you start"}</h2>
        <section className={styles.notice} tabIndex={0} aria-label="Notice">
          <MarkdownView source={pre.notice.body_md} />
        </section>
        {pre.logged_signals.length > 0 && (
          <>
            <Body1>While you take the test we record these events. They are reviewed by a person and never end your test on their own:</Body1>
            <ul className={styles.list}>
              {pre.logged_signals.map((s) => (
                <li key={s}>{signalLabel(s)}</li>
              ))}
            </ul>
          </>
        )}
        <Checkbox className={styles.agree} checked={agreed} onChange={(_, d) => setAgreed(Boolean(d.checked))} label="I have read the notice and I agree" />
        <div aria-live="assertive" role="alert">
          {error && (
            <MessageBar intent="error" layout="multiline">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
        </div>
        <div className={styles.actions}>
          <Button appearance="primary" size="large" disabled={!agreed || busy} onClick={() => void start()}>
            {busy ? <Spinner size="tiny" label="Starting…" /> : pre.has_active_attempt ? "Resume the test" : "Start the test"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "offline";

function AttemptRunner({
  api,
  initial,
  session,
  onSession,
  onEnd,
}: {
  api: Api;
  initial: AttemptView;
  session: string | null;
  onSession: (id: string) => void;
  onEnd: (end: End) => void;
}) {
  const styles = useStyles();
  const narrow = useMediaQuery("(max-width: 767px)");
  const [view, setView] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({ ...initial.answers }));
  const [remaining, setRemaining] = useState(initial.remaining_seconds);
  const [sectionLeft, setSectionLeft] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [warning, setWarning] = useState("");
  const [minuteText, setMinuteText] = useState("");
  const [current, setCurrent] = useState(initial.current_section ?? initial.sections.find((s) => !s.closed)?.key ?? initial.sections[0]?.key ?? "");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef(session);
  const syncRef = useRef<ClockSync | null>(null);
  const queueRef = useRef<AutosaveQueue | null>(null);
  const batcherRef = useRef<SignalBatcher | null>(null);
  const announcedRef = useRef(new Set<number>());
  const lastMinuteRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRef = useRef(view);
  const srMode = view.screen_reader_mode;

  const queue = () => (queueRef.current ??= new AutosaveQueue());
  const batcher = () => (batcherRef.current ??= new SignalBatcher());

  const resync = useCallback((serverNow: string, deadline: string) => {
    syncRef.current = syncClock(serverNow, deadline, Date.now());
    setRemaining(remainingSeconds(syncRef.current, Date.now()));
  }, []);

  const finish = useCallback(
    (e: End) => {
      if (endedRef.current) return;
      endedRef.current = true;
      onEnd(e);
    },
    [onEnd],
  );

  /** Terminal 409s end the attempt; returns true when handled. */
  const handleTerminal = useCallback(
    (e: unknown): boolean => {
      if (!isApiError(e)) return false;
      const state = takingErrorState(e.code);
      if (state === "time_up") finish("time_up");
      else if (state === "submitted") finish("already");
      else if (state === "replaced") finish("replaced");
      else return false;
      return true;
    },
    [finish],
  );

  const applyView = useCallback(
    (v: AttemptView) => {
      viewRef.current = v;
      setView(v);
      if (v.session_id && v.session_id !== sessionRef.current) {
        sessionRef.current = v.session_id;
        onSession(v.session_id);
      }
      resync(v.server_now, v.deadline_at);
      if (v.status !== "in_progress") finish("already");
    },
    [finish, onSession, resync],
  );

  const flush = useCallback(async (): Promise<void> => {
    const q = queue();
    // Send batches one at a time until nothing is pending (edits made while a batch is in flight go next).
    for (;;) {
      if (endedRef.current) return;
      const batch = q.take();
      if (!batch) return;
      setSaveState("saving");
      try {
        const out = await api.save(sessionRef.current, batch);
        if (q.ack(batch.client_seq)) resync(out.server_now, out.deadline_at);
        setSaveState(q.hasPending ? "saving" : "saved");
      } catch (e) {
        q.fail(batch.client_seq);
        if (handleTerminal(e)) return;
        if (isApiError(e) && e.code === "section_closed") {
          // A timed section closed under us: refresh the attempt (its answers stay as saved).
          api.attempt(sessionRef.current).then(applyView, () => undefined);
        }
        setSaveState("offline");
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => void flushRef.current(), RETRY_MS);
        return;
      }
    }
  }, [api, applyView, handleTerminal, resync]);
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const timingOutRef = useRef(false);
  const timeUp = useCallback(async () => {
    // Ticks keep firing while the final save/submit is in flight: run once.
    if (endedRef.current || timingOutRef.current) return;
    timingOutRef.current = true;
    try {
      await flush();
      await api.submit(sessionRef.current);
    } catch {
      // The server auto-submits at the deadline either way.
    }
    finish("time_up");
  }, [api, finish, flush]);

  // Initial clock sync and the 1 s tick (remaining time, warnings, minute announcements).
  useEffect(() => {
    if (!syncRef.current) syncRef.current = syncClock(initial.server_now, initial.deadline_at, Date.now());
    const tick = () => {
      if (!syncRef.current || endedRef.current) return;
      const now = Date.now();
      const r = remainingSeconds(syncRef.current, now);
      setRemaining(r);
      const w = dueWarning(r, announcedRef.current);
      if (w) setWarning(w);
      const minute = Math.ceil(r / 60);
      if (minute !== lastMinuteRef.current) {
        lastMinuteRef.current = minute;
        setMinuteText(`${minute} ${minute === 1 ? "minute" : "minutes"} remaining`);
      }
      const sec = viewRef.current.sections.find((s) => s.key === viewRef.current.current_section && s.deadline_at);
      setSectionLeft(sec?.deadline_at ? remainingSeconds({ offsetMs: syncRef.current.offsetMs, deadlineMs: Date.parse(sec.deadline_at) }, now) : null);
      if (r <= 0) void timeUp();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [initial.deadline_at, initial.server_now, timeUp]);

  // Autosave every 15 s; flush on unmount.
  useEffect(() => {
    const id = setInterval(() => void flush(), AUTOSAVE_MS);
    return () => {
      clearInterval(id);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [flush]);

  // Passive proctoring: record, batch and send every 10 s. Never blocks, prevents or warns.
  useEffect(() => {
    const push = (kind: ClientSignalKind, detail?: Record<string, unknown>) => batcher().push(kind, Date.now(), detail ?? null);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        push("tab_switch");
        void flush();
      } else {
        // Back on the page: re-sync the timer from the server.
        api.attempt(sessionRef.current).then(applyView, (e) => handleTerminal(e));
      }
    };
    const onBlur = () => push("focus_loss");
    const onCopy = () => push("copy");
    const onPaste = () => push("paste");
    const onFullscreen = () => {
      if (!document.fullscreenElement) push("fullscreen_exit");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("fullscreenchange", onFullscreen);
    const send = async () => {
      if (endedRef.current || batcher().size === 0) return;
      const batch = batcher().drain();
      try {
        await api.signals(sessionRef.current, batch);
      } catch (e) {
        if (!handleTerminal(e)) batcher().requeue(batch);
      }
    };
    const id = setInterval(() => void send(), SIGNAL_MS);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [api, applyView, flush, handleTerminal]);

  const change = (position: number, response: unknown) => {
    setAnswers((a) => ({ ...a, [String(position)]: response }));
    queue().set(position, response);
    setSaveState("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void flush(), CHANGE_DEBOUNCE_MS);
  };

  const finishSection = async (key: string) => {
    setError(null);
    try {
      await flush();
      const v = await api.finishSection(sessionRef.current, key);
      applyView(v);
      const next = v.sections.find((s) => !s.closed);
      if (next) setCurrent(next.key);
    } catch (e) {
      if (!handleTerminal(e)) setError(errorMessage(e));
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await flush();
      if (queue().hasPending || queue().busy) throw new Error("unsaved");
      const out = await api.submit(sessionRef.current);
      finish(out.status === "auto_submitted" ? "time_up" : "submitted");
    } catch (e) {
      if (!handleTerminal(e)) setError(e instanceof Error && e.message === "unsaved" ? "Some answers are not saved yet. Check your connection and try again." : errorMessage(e));
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  const items = view.items;
  const section = view.sections.find((s) => s.key === current) ?? view.sections[0];
  const sectionItems: DeliveryItem[] = section ? section.positions.map((p) => items.find((i) => i.position === p)).filter((i): i is DeliveryItem => Boolean(i)) : items;
  const unanswered = items.filter((i) => !isAnswered(answers[String(i.position)])).length;
  const low = remaining <= 300;
  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "offline" ? "Offline, retrying" : "";

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <span className={mergeClasses(styles.timer, low && styles.timerLow)} role="timer" aria-live="off" aria-label={`Time remaining ${formatClock(remaining)}`}>
          <Clock20Regular aria-hidden />
          {formatClock(remaining)}
        </span>
        {sectionLeft !== null && <Caption1>Section: {formatClock(sectionLeft)}</Caption1>}
        <span className={styles.grow} />
        <Caption1 role="status" aria-live="polite">
          {saveLabel}
        </Caption1>
        <Button appearance="primary" onClick={() => setConfirming(true)}>
          Submit
        </Button>
      </div>
      {/* Time announcements. Screen-reader mode keeps only the 5- and 1-minute warnings in the live region. */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {warning || (srMode ? "" : minuteText)}
      </div>
      {warning && (
        <MessageBar intent="warning">
          <MessageBarBody>{warning}</MessageBarBody>
        </MessageBar>
      )}
      {error && (
        <MessageBar intent="error" role="alert" layout="multiline">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {view.sections.length > 1 && (
        <nav aria-label="Sections">
          <ul className={styles.nav}>
            {view.sections.map((s) => {
              const done = s.positions.filter((p) => isAnswered(answers[String(p)])).length;
              return (
                <li key={s.key}>
                  <Button
                    className={styles.navBtn}
                    appearance={s.key === section?.key ? "primary" : "secondary"}
                    aria-current={s.key === section?.key ? "step" : undefined}
                    onClick={() => setCurrent(s.key)}
                  >
                    {s.title} ({done}/{s.positions.length}){s.closed ? " · closed" : ""}
                  </Button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {section && <h1 className={styles.heading}>{section.title}</h1>}
      {section?.closed && (
        <MessageBar intent="info">
          <MessageBarBody>This section is closed. Your saved answers are kept.</MessageBarBody>
        </MessageBar>
      )}
      {sectionItems.map((item, idx) => (
        <QuestionCard
          key={item.position}
          item={item}
          number={idx + 1}
          value={answers[String(item.position)]}
          disabled={Boolean(section?.closed)}
          narrow={narrow}
          onChange={(r) => change(item.position, r)}
        />
      ))}
      {section && section.deadline_at && !section.closed && (
        <div className={styles.actions}>
          <Button onClick={() => void finishSection(section.key)}>Finish this section</Button>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={(_, d) => !submitting && setConfirming(d.open)} modalType="alert">
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Submit your answers?</DialogTitle>
            <DialogContent>
              {unanswered > 0
                ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} not answered. You cannot change your answers after submitting.`
                : "You cannot change your answers after submitting."}
            </DialogContent>
            <DialogActions>
              <Button disabled={submitting} onClick={() => setConfirming(false)}>
                Keep working
              </Button>
              <Button appearance="primary" disabled={submitting} onClick={() => void submit()}>
                {submitting ? <Spinner size="tiny" label="Submitting…" /> : "Submit"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function QuestionCard({
  item,
  number,
  value,
  disabled,
  narrow,
  onChange,
}: {
  item: DeliveryItem;
  number: number;
  value: unknown;
  disabled: boolean;
  narrow: boolean;
  onChange: (r: unknown) => void;
}) {
  const styles = useStyles();
  const stemId = `q-${item.position}-stem`;
  return (
    <Card className={styles.question} role="group" aria-labelledby={stemId}>
      <div className={styles.qHead}>
        <Text weight="semibold">Question {number}</Text>
        <Badge appearance="outline">
          {item.points} point{item.points === "1" ? "" : "s"}
        </Badge>
      </div>
      {narrow && isCodeKind(item.kind) && (
        <MessageBar intent="info">
          <MessageBarBody>Desktop recommended: code questions are easier on a larger screen.</MessageBarBody>
        </MessageBar>
      )}
      <div id={stemId}>
        <MarkdownView source={item.stem} />
      </div>
      <ItemResponse item={item} value={value} onChange={onChange} disabled={disabled} labelId={stemId} />
    </Card>
  );
}

/** Candidate portal mount: `/portal/assessments/[invitationId]`. */
export function PortalAssessmentTaking({ invitationId }: { invitationId: string }) {
  const adapter = useMemo(() => portalTakingAdapter(invitationId), [invitationId]);
  return <AssessmentTaking adapter={adapter} />;
}

/** Public link mount: `/l/[token]` purpose `assessment_attempt`. */
export function PublicAssessmentAttempt({ token }: { token: string }) {
  const adapter = useMemo(() => publicTakingAdapter(token), [token]);
  return <AssessmentTaking adapter={adapter} />;
}
