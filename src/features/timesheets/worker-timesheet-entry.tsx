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
  Field,
  Input,
  Link as FluentLink,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Spinner,
  Text,
  Textarea,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowClockwise20Regular,
  ArrowLeft20Regular,
  ArrowUndo20Regular,
  CalendarStar16Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Copy20Regular,
  Note20Regular,
  Send20Regular,
} from "@fluentui/react-icons";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { workerTimesheetsApi } from "./api";
import { formatDelta, formatHundredths, isValidHoursInput, normalizeHours, toHundredths } from "./decimal";
import {
  categoryLabel,
  cellKey,
  chunkWeeks,
  codeLabel,
  datesBetween,
  dayLabel,
  formatDay,
  formatPeriod,
  overtimeDays,
  splitDisplay,
  statusColor,
  statusLabel,
} from "./format";
import type { DayEntryIn, TimeCategory, WorkerEntry, WorkerSplitPreview, WorkerTimesheetOut } from "./types";
import { useMyTimesheet } from "./use-my-timesheets";

const useStyles = makeStyles({
  toolbar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  grow: { flex: 1 },
  gridWrap: { overflowX: "auto" },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    "& th, & td": {
      padding: tokens.spacingHorizontalXS,
      borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
      textAlign: "center",
      verticalAlign: "middle",
    },
    "& th:first-child, & td:first-child": { textAlign: "start", whiteSpace: "nowrap" },
  },
  cellInput: { width: "72px", minHeight: "44px", "& input": { textAlign: "end" } },
  cellPrefilled: { backgroundColor: tokens.colorPaletteMarigoldBackground1 },
  cellError: { outline: `2px solid ${tokens.colorPaletteRedBorder2}` },
  dayHead: { display: "flex", flexDirection: "column", alignItems: "center", gap: tokens.spacingVerticalXXS },
  footer: {
    position: "sticky",
    bottom: 0,
    zIndex: 1,
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `${tokens.strokeWidthThick} solid ${tokens.colorNeutralStroke2}`,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalL,
    alignItems: "center",
    boxShadow: tokens.shadow8,
  },
  total: { fontWeight: tokens.fontWeightSemibold },
  dayCard: { padding: tokens.spacingHorizontalM, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  dayCardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  dayRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  live: { color: tokens.colorNeutralForeground3, minHeight: "20px" },
  popover: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, maxWidth: "280px" },
  splitTable: { borderCollapse: "collapse", "& td, & th": { padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalM}`, textAlign: "start" } },
  num: { textAlign: "end", fontVariantNumeric: "tabular-nums" },
});

// ---------------------------------------------------------------- narrow-screen detection
function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia("(max-width: 480px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia("(max-width: 480px)").matches,
    () => false,
  );
}

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

/** Category rows of the grid: editable categories, plus any non-computed category already holding entries. */
function rowCategories(ts: WorkerTimesheetOut): string[] {
  const rows = [...ts.editable_categories.filter((c) => c !== "ot" && c !== "double_time")];
  for (const e of ts.entries) if (!rows.includes(e.category) && e.category !== "ot" && e.category !== "double_time") rows.push(e.category);
  return rows;
}

function entryValue(e: WorkerEntry | undefined, mode: string): string {
  if (!e) return "";
  return normalizeHours(mode === "days" ? (e.entered_hours ?? e.hours) : e.hours);
}

/** `/portal/work/timesheets/[id]`: the Worker's timesheet entry (week grid on desktop, day cards on phones). */
export function WorkerTimesheetEntry({ id }: { id: string }) {
  const portal = usePortalStyles();
  const { query } = useMyTimesheet(id);
  if (query.isPending) return <LoadingBlock label="Loading timesheet" />;
  if (query.isError) return <ErrorBlock error={query.error} onRetry={() => query.refetch()} />;
  return (
    <div className={portal.page}>
      <EntryBody ts={query.data} />
    </div>
  );
}

function EntryBody({ ts }: { ts: WorkerTimesheetOut }) {
  const styles = useStyles();
  const portal = usePortalStyles();
  const narrow = useNarrow();
  const { save, copyPrevious, refreshPrefill, previewSplit, submit, recall } = useMyTimesheet(ts.id);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [weekIdx, setWeekIdx] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pending = useRef<Map<string, DayEntryIn>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Flush unsaved edits if the Worker navigates away within the debounce window.
  useEffect(() => {
    const map = pending.current;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (map.size) void workerTimesheetsApi.saveEntries(ts.id, [...map.values()]).catch(() => undefined);
    };
  }, [ts.id]);

  const isAdjustment = ts.kind === "adjustment";
  const editable = ts.editable && !isAdjustment;
  const mode = ts.entry_mode;
  const byKey = new Map(ts.entries.map((e) => [cellKey(e.entry_date, e.category), e]));
  const dates = datesBetween(ts.period_start, ts.period_end);
  const weeks = chunkWeeks(dates);
  const week = weeks[Math.min(weekIdx, weeks.length - 1)] ?? [];
  const rows = rowCategories(ts);

  const valueOf = (date: string, cat: string) => draft[cellKey(date, cat)] ?? entryValue(byKey.get(cellKey(date, cat)), mode);
  const noteOf = (date: string) => ts.entries.find((e) => e.entry_date === date && e.note)?.note ?? "";
  const inRange = (date: string) => date >= ts.min_date && date <= ts.max_date;
  const cellReadOnly = (date: string, cat: string) => {
    const e = byKey.get(cellKey(date, cat));
    return !editable || !inRange(date) || !ts.editable_categories.includes(cat) || (!!e?.prefilled && !e.deletable);
  };

  async function flush() {
    timer.current = null;
    if (pending.current.size === 0) return;
    const batch = [...pending.current.values()];
    pending.current.clear();
    setSaveState("saving");
    try {
      await save.mutateAsync(batch);
      const keys = batch.map((b) => cellKey(b.date, b.category));
      setDraft((d) => {
        const next = { ...d };
        for (const b of batch) {
          const k = cellKey(b.date, b.category);
          const sent = b.hours ?? b.days ?? "";
          if (next[k] !== undefined && (next[k] === sent || (next[k] === "" && sent === "0"))) delete next[k];
        }
        return next;
      });
      setCellErrors((e) => {
        const next = { ...e };
        for (const k of keys) delete next[k];
        return next;
      });
      setSaveState(pending.current.size ? "pending" : "saved");
    } catch (e) {
      setSaveState("error");
      if (isApiError(e) && e.code === "entry_invalid" && Array.isArray(e.details.rows)) {
        const errs: Record<string, string> = {};
        for (const r of e.details.rows as { date: string; category: string; code: string }[]) errs[cellKey(r.date, r.category)] = codeLabel(r.code);
        setCellErrors((c) => ({ ...c, ...errs }));
      } else {
        setActionError(errorMessage(e));
      }
    }
  }

  function queue(entry: DayEntryIn) {
    pending.current.set(cellKey(entry.date, entry.category), entry);
    setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  }

  function changeCell(date: string, cat: string, value: string) {
    const k = cellKey(date, cat);
    setDraft((d) => ({ ...d, [k]: value }));
    if (!isValidHoursInput(value)) {
      setCellErrors((c) => ({ ...c, [k]: "Use hours like 8 or 7.5 (max 24, 2 decimals)" }));
      return;
    }
    setCellErrors((c) => {
      const next = { ...c };
      delete next[k];
      return next;
    });
    const v = value.trim() === "" ? "0" : value.trim();
    const note = byKey.get(k)?.note ?? null;
    queue({ date, category: cat as TimeCategory, ...(mode === "days" ? { days: v } : { hours: v }), note });
  }

  function saveSpan(date: string, cat: string, start: string, end: string, breakMinutes: number) {
    const note = byKey.get(cellKey(date, cat))?.note ?? null;
    if (!start || !end) queue({ date, category: cat as TimeCategory, hours: "0", note });
    else queue({ date, category: cat as TimeCategory, spans: [{ start, end, break_minutes: breakMinutes }], note });
  }

  function saveNote(date: string, note: string) {
    const cat = rows.find((c) => (toHundredths(valueOf(date, c)) ?? 0) > 0);
    if (!cat) return;
    const e = byKey.get(cellKey(date, cat));
    const base: DayEntryIn = { date, category: cat as TimeCategory, note: note.trim() || null };
    if (mode === "start_end" && e?.start_time && e.end_time)
      queue({ ...base, spans: [{ start: e.start_time, end: e.end_time, break_minutes: e.break_minutes ?? 0 }] });
    else queue({ ...base, ...(mode === "days" ? { days: valueOf(date, cat) } : { hours: valueOf(date, cat) }) });
  }

  function onGridKey(ev: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    const input = ev.currentTarget;
    let nr = r;
    let nc = c;
    if (ev.key === "ArrowUp") nr = r - 1;
    else if (ev.key === "ArrowDown" || ev.key === "Enter") nr = r + 1;
    else if (ev.key === "ArrowLeft" && input.selectionStart === 0 && input.selectionEnd === 0) nc = c - 1;
    else if (ev.key === "ArrowRight" && input.selectionStart === input.value.length) nc = c + 1;
    else return;
    const target = inputs.current.get(`${nr}:${nc}`);
    if (target) {
      ev.preventDefault();
      target.focus();
      target.select();
    }
  }

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      setDraft({});
      setCellErrors({});
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  // live totals per category (hours mode: from the visible values via hundredths; other modes: server totals)
  const serverTotal = (cat: string) => ts.totals.find((t) => t.category === cat)?.hours ?? "0";
  const rowTotal = (cat: string) =>
    mode === "hours" ? formatHundredths(dates.reduce((a, d) => a + (toHundredths(valueOf(d, cat)) ?? 0), 0)) : normalizeHours(serverTotal(cat)) || "0.00";
  const grandTotal = formatHundredths(rows.reduce((a, c) => a + (toHundredths(rowTotal(c)) ?? 0), 0));
  const liveText = { idle: "", pending: "Unsaved changes…", saving: "Saving…", saved: "Saved", error: "Not saved" }[saveState];

  const renderCell = (date: string, cat: string, r: number, c: number, label: string) => {
    const k = cellKey(date, cat);
    const e = byKey.get(k);
    const readOnly = cellReadOnly(date, cat);
    const err = cellErrors[k];
    const prefilled = !!e?.prefilled;
    if (mode === "start_end" && cat === "regular") {
      return <SpanCell entry={e} disabled={readOnly} label={label} onSave={(s, en, b) => saveSpan(date, cat, s, en, b)} />;
    }
    const input = (
      <Input
        aria-label={label}
        aria-invalid={!!err || undefined}
        inputMode="decimal"
        className={mergeClasses(styles.cellInput, prefilled && styles.cellPrefilled, err && styles.cellError)}
        value={valueOf(date, cat)}
        readOnly={readOnly}
        disabled={!inRange(date)}
        contentAfter={prefilled ? <CalendarStar16Regular aria-label="Prefilled" /> : undefined}
        input={{
          ref: (el: HTMLInputElement | null) => {
            if (el) inputs.current.set(`${r}:${c}`, el);
            else inputs.current.delete(`${r}:${c}`);
          },
          onKeyDown: (ev: React.KeyboardEvent<HTMLInputElement>) => onGridKey(ev, r, c),
          onBlur: () => {
            if (pending.current.size && timer.current) {
              clearTimeout(timer.current);
              void flush();
            }
          },
        }}
        onChange={(_, d) => changeCell(date, cat, d.value)}
      />
    );
    return err ? (
      <Tooltip content={err} relationship="description">
        {input}
      </Tooltip>
    ) : (
      input
    );
  };

  return (
    <>
      <FluentLink href="/portal/work/timesheets" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}>
        <ArrowLeft20Regular aria-hidden /> My timesheets
      </FluentLink>
      <PortalPageHeader
        title={isAdjustment ? `Adjustment ${ts.human_id}` : `Timesheet ${formatPeriod(ts.period_start, ts.period_end)}`}
        subtitle={
          <>
            {[ts.client_name, ts.role_title, ts.human_id].filter(Boolean).join(" · ")}{" "}
            <Badge appearance="tint" color={statusColor(ts.status)}>
              {statusLabel(ts.status)}
            </Badge>
          </>
        }
      />
      {ts.status === "rejected" && ts.rejection_comment && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Returned for changes</MessageBarTitle>
            {ts.rejection_comment}
          </MessageBarBody>
        </MessageBar>
      )}

      {isAdjustment ? (
        <Card className={portal.card}>
          <Text weight="semibold">Adjusted hours</Text>
          {ts.adjustment_entries.length === 0 ? (
            <Body1 className={portal.empty}>No adjustments.</Body1>
          ) : (
            <ul className={portal.list}>
              {ts.adjustment_entries.map((a, i) => (
                <li key={`${a.entry_date}-${a.category}-${i}`} className={portal.row}>
                  <span>
                    {formatDay(a.entry_date)} · {categoryLabel(a.category)}
                    {a.note ? <Caption1> — {a.note}</Caption1> : null}
                  </span>
                  <Text weight="semibold" className={styles.num}>
                    {formatDelta(a.delta_hours)} h
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <>
          <div className={styles.toolbar}>
            {editable && ts.can_copy_previous && (
              <Button className={portal.button} icon={<Copy20Regular />} disabled={copyPrevious.isPending} onClick={() => runAction(() => copyPrevious.mutateAsync())}>
                Copy previous
              </Button>
            )}
            {editable && (
              <Button
                className={portal.button}
                icon={<ArrowClockwise20Regular />}
                disabled={refreshPrefill.isPending}
                onClick={() => runAction(() => refreshPrefill.mutateAsync())}
              >
                Refresh holidays & leave
              </Button>
            )}
            <span className={styles.grow} />
            {weeks.length > 1 && (
              <span className={styles.toolbar}>
                <Button
                  className={portal.button}
                  appearance="subtle"
                  aria-label="Previous week"
                  icon={<ChevronLeft20Regular />}
                  disabled={weekIdx === 0}
                  onClick={() => setWeekIdx((w) => w - 1)}
                />
                <Caption1>
                  Week {weekIdx + 1} of {weeks.length}
                </Caption1>
                <Button
                  className={portal.button}
                  appearance="subtle"
                  aria-label="Next week"
                  icon={<ChevronRight20Regular />}
                  disabled={weekIdx >= weeks.length - 1}
                  onClick={() => setWeekIdx((w) => w + 1)}
                />
              </span>
            )}
          </div>

          {narrow ? (
            <div className={portal.list}>
              {week.map((date) => (
                <Card key={date} className={styles.dayCard}>
                  <div className={styles.dayCardHead}>
                    <Text weight="semibold">{dayLabel(date)}</Text>
                    <NoteButton date={date} note={noteOf(date)} disabled={!editable || !rows.some((c) => (toHundredths(valueOf(date, c)) ?? 0) > 0)} onSave={saveNote} />
                  </div>
                  {rows.map((cat, r) => (
                    <div key={cat} className={styles.dayRow}>
                      <span>
                        {categoryLabel(cat)}{" "}
                        {byKey.get(cellKey(date, cat))?.prefilled && (
                          <Badge appearance="tint" color="warning" size="small" icon={<CalendarStar16Regular />}>
                            Prefilled
                          </Badge>
                        )}
                      </span>
                      {renderCell(date, cat, r, week.indexOf(date), `${categoryLabel(cat)}, ${dayLabel(date)}`)}
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          ) : (
            <div className={styles.gridWrap}>
              <table className={styles.table} aria-label="Hours by category and day">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    {week.map((date) => (
                      <th key={date} scope="col">
                        <span className={styles.dayHead}>
                          {dayLabel(date)}
                          <NoteButton
                            date={date}
                            note={noteOf(date)}
                            disabled={!editable || !rows.some((c) => (toHundredths(valueOf(date, c)) ?? 0) > 0)}
                            onSave={saveNote}
                          />
                        </span>
                      </th>
                    ))}
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((cat, r) => (
                    <tr key={cat}>
                      <th scope="row">
                        {categoryLabel(cat)}{" "}
                        {ts.entries.some((e) => e.category === cat && e.prefilled) && (
                          <Badge appearance="tint" color="warning" size="small" icon={<CalendarStar16Regular />}>
                            Prefilled
                          </Badge>
                        )}
                      </th>
                      {week.map((date, c) => (
                        <td key={date}>{renderCell(date, cat, r, c, `${categoryLabel(cat)}, ${dayLabel(date)}`)}</td>
                      ))}
                      <td className={styles.num}>{rowTotal(cat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {Object.keys(cellErrors).length > 0 && (
        <MessageBar intent="error" layout="multiline" role="alert">
          <MessageBarBody>
            {Object.entries(cellErrors)
              .map(([k, msg]) => {
                const [date, cat] = k.split("|");
                return `${dayLabel(date)} ${categoryLabel(cat)}: ${msg}`;
              })
              .join(" · ")}
          </MessageBarBody>
        </MessageBar>
      )}
      <InlineError message={actionError} />

      <div className={styles.footer} role="region" aria-label="Totals">
        {!isAdjustment &&
          rows.map((cat) => (
            <Caption1 key={cat}>
              {categoryLabel(cat)}: <span className={styles.num}>{rowTotal(cat)}</span>
            </Caption1>
          ))}
        <Text className={styles.total}>Total {isAdjustment ? normalizeHours(ts.total_hours) : grandTotal} h</Text>
        <span className={styles.grow} />
        <span className={styles.live} aria-live="polite" role="status">
          {liveText}
        </span>
        {ts.can_recall && (
          <Button className={portal.button} icon={<ArrowUndo20Regular />} disabled={recall.isPending} onClick={() => runAction(() => recall.mutateAsync())}>
            Recall
          </Button>
        )}
        {ts.editable && (
          <Button
            className={portal.button}
            appearance="primary"
            icon={<Send20Regular />}
            disabled={saveState === "saving" || Object.keys(cellErrors).length > 0}
            onClick={async () => {
              if (timer.current) {
                clearTimeout(timer.current);
                await flush();
              }
              previewSplit.reset();
              setSubmitOpen(true);
              previewSplit.mutate();
            }}
          >
            Submit
          </Button>
        )}
      </div>

      {submitOpen && (
        <SubmitDialog
          preview={previewSplit.data}
          previewError={previewSplit.error}
          loading={previewSplit.isPending}
          busy={submit.isPending}
          onClose={() => setSubmitOpen(false)}
          onSubmit={(confirmZero) => submit.mutateAsync(confirmZero)}
        />
      )}
    </>
  );
}

function NoteButton({ date, note, disabled, onSave }: { date: string; note: string; disabled: boolean; onSave: (date: string, note: string) => void }) {
  const styles = useStyles();
  const portal = usePortalStyles();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note);
  return (
    <Popover
      open={open}
      onOpenChange={(_, d) => {
        setOpen(d.open);
        if (d.open) setText(note);
      }}
      withArrow
    >
      <PopoverTrigger disableButtonEnhancement>
        <Button
          className={portal.button}
          appearance={note ? "primary" : "subtle"}
          size="small"
          icon={<Note20Regular />}
          aria-label={note ? `Note for ${dayLabel(date)}: ${note}` : `Add note for ${dayLabel(date)}`}
          disabled={disabled && !note}
        />
      </PopoverTrigger>
      <PopoverSurface className={styles.popover}>
        <Field label={`Note for ${dayLabel(date)}`}>
          <Textarea value={text} maxLength={1000} readOnly={disabled} onChange={(_, d) => setText(d.value)} />
        </Field>
        {!disabled && (
          <Button
            appearance="primary"
            className={portal.button}
            onClick={() => {
              onSave(date, text);
              setOpen(false);
            }}
          >
            Save note
          </Button>
        )}
      </PopoverSurface>
    </Popover>
  );
}

function SpanCell({
  entry,
  disabled,
  label,
  onSave,
}: {
  entry: WorkerEntry | undefined;
  disabled: boolean;
  label: string;
  onSave: (start: string, end: string, breakMinutes: number) => void;
}) {
  const styles = useStyles();
  const portal = usePortalStyles();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [brk, setBrk] = useState("0");
  return (
    <Popover
      open={open}
      onOpenChange={(_, d) => {
        setOpen(d.open);
        if (d.open) {
          setStart(entry?.start_time?.slice(0, 5) ?? "");
          setEnd(entry?.end_time?.slice(0, 5) ?? "");
          setBrk(String(entry?.break_minutes ?? 0));
        }
      }}
      withArrow
    >
      <PopoverTrigger disableButtonEnhancement>
        <Button className={portal.button} aria-label={`${label}: ${entry ? normalizeHours(entry.hours) : "empty"}`} disabled={disabled}>
          {entry ? normalizeHours(entry.hours) : "—"}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.popover}>
        <Field label="Start">
          <Input type="time" value={start} onChange={(_, d) => setStart(d.value)} className={portal.input} />
        </Field>
        <Field label="End">
          <Input type="time" value={end} onChange={(_, d) => setEnd(d.value)} className={portal.input} />
        </Field>
        <Field label="Break (minutes)">
          <Input type="number" min={0} max={1440} value={brk} onChange={(_, d) => setBrk(d.value)} className={portal.input} />
        </Field>
        <Button
          appearance="primary"
          className={portal.button}
          onClick={() => {
            onSave(start, end, Math.max(0, Math.min(1440, Number.parseInt(brk || "0", 10) || 0)));
            setOpen(false);
          }}
        >
          Apply
        </Button>
      </PopoverSurface>
    </Popover>
  );
}

function SubmitDialog({
  preview,
  previewError,
  loading,
  busy,
  onClose,
  onSubmit,
}: {
  preview: WorkerSplitPreview | undefined;
  previewError: unknown;
  loading: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (confirmZero: boolean) => Promise<unknown>;
}) {
  const styles = useStyles();
  const portal = usePortalStyles();
  const [confirmZero, setConfirmZero] = useState(false);
  const [needZero, setNeedZero] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const split = preview ? splitDisplay(preview) : null;
  const zero = split?.total === "0.00";
  const otDays = preview ? overtimeDays(preview.days) : [];
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Submit timesheet</DialogTitle>
          <DialogContent>
            {loading && <Spinner size="small" label="Calculating hours…" />}
            {previewError ? <InlineError message={errorMessage(previewError)} /> : null}
            {split && (
              <>
                <Body1>Overtime is calculated automatically from your hours. Please check the totals before submitting.</Body1>
                <table className={styles.splitTable} aria-label="Hours to submit">
                  <tbody>
                    {split.rows.map((r) => (
                      <tr key={r.label}>
                        <th scope="row">{r.label}</th>
                        <td className={styles.num}>{r.hours}</td>
                      </tr>
                    ))}
                    <tr>
                      <th scope="row">Total</th>
                      <td className={mergeClasses(styles.num, styles.total)}>{split.total}</td>
                    </tr>
                  </tbody>
                </table>
                {otDays.length > 0 && (
                  <Caption1>
                    Overtime on:{" "}
                    {otDays
                      .map((d) => `${dayLabel(d.date)} (${normalizeHours(d.ot)}${(toHundredths(d.double_time) ?? 0) > 0 ? ` + ${normalizeHours(d.double_time)} double` : ""})`)
                      .join(", ")}
                  </Caption1>
                )}
                {(zero || needZero) && (
                  <Checkbox checked={confirmZero} onChange={(_, d) => setConfirmZero(!!d.checked)} label="I confirm I worked zero hours in this period" />
                )}
              </>
            )}
            <InlineError message={error} />
          </DialogContent>
          <DialogActions>
            <Button className={portal.button} disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              className={portal.button}
              appearance="primary"
              disabled={busy || loading || !split || ((zero || needZero) && !confirmZero)}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setError(null);
                try {
                  await onSubmit(confirmZero);
                  onClose();
                } catch (e) {
                  if (isApiError(e) && e.code === "zero_hours_confirm_required") setNeedZero(true);
                  setError(errorMessage(e));
                }
              }}
            >
              Submit
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
