"use client";

import {
  Body1,
  Button,
  Caption1,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle1,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { linkErrorCopy } from "@/features/public-links/logic";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { browserTimeZone, formatInZone, listTimeZones } from "@/lib/time/zones";
import { newIdempotencyKey, type SlotPickSource } from "./api";
import { type CounterRow, MODE_LABELS, slotLabel, validateCounter } from "./logic";
import type { SlotPickView } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "640px", width: "100%", minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  rowField: { minWidth: "120px", flex: "1 1 120px" },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "center" },
  fieldset: { border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

const EMPTY_ROWS: CounterRow[] = [
  { date: "", from: "", to: "" },
  { date: "", from: "", to: "" },
  { date: "", from: "", to: "" },
];

/** The candidate's "pick a time" view (Secure Link page and Candidate Portal card). WCAG 2.1 AA, 360 px, keyboard only. */
export function SlotPicker({ source, initial }: { source: SlotPickSource; initial?: SlotPickView }) {
  const styles = useStyles();
  const query = useQuery({ queryKey: source.key, queryFn: ({ signal }) => source.get(signal), initialData: initial, refetchInterval: (q) => (q.state.data?.status === "picked" ? 3000 : false) });
  if (query.isPending) return <Spinner label="Loading…" />;
  if (query.isError) {
    const e = query.error;
    const copy = isApiError(e) ? linkErrorCopy(e.status, e.code) : linkErrorCopy(500, undefined);
    return (
      <div role="alert" className={styles.root}>
        <Subtitle1 as="h1">{isApiError(e) && e.status === 410 ? "This link has expired." : copy.title}</Subtitle1>
        <Body1>{copy.body}</Body1>
      </div>
    );
  }
  return <PickerBody key={`${query.data.status}:${query.data.slots.map((s) => s.start).join(",")}`} source={source} view={query.data} />;
}

function PickerBody({ source, view }: { source: SlotPickSource; view: SlotPickView }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [tz, setTz] = useState(view.candidate_timezone || browserTimeZone());
  const [choice, setChoice] = useState<string>("");
  const [countering, setCountering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickId = useMemo(() => newIdempotencyKey(), []);
  const zones = useMemo(() => listTimeZones(view.candidate_timezone, browserTimeZone()), [view.candidate_timezone]);
  const set = (v: SlotPickView) => queryClient.setQueryData(source.key, v);
  const pick = useMutation({
    mutationFn: () => source.pick(Number(choice), pickId),
    onSuccess: (r) => set(r.view),
    onError: (e) => {
      setError(errorMessage(e));
      void queryClient.invalidateQueries({ queryKey: source.key });
    },
  });
  const changeTz = useMutation({
    mutationFn: (zone: string) => (source.timezone ? source.timezone(zone) : Promise.resolve({ ...view, candidate_timezone: zone })),
    onSuccess: (v) => set(v),
  });
  const title = `Pick a time for your ${view.stage_name ?? "interview"} interview`;
  const subtitle = [
    [view.demand_title, view.tenant].filter(Boolean).join(" at "),
    `${view.duration} min`,
    view.mode ? (MODE_LABELS[view.mode] ?? view.mode) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (view.status === "booked") {
    return (
      <div className={styles.root} role="status">
        <Subtitle1 as="h1">You&apos;re booked. A calendar invite is on its way.</Subtitle1>
        {view.booked_start && <Body1>{formatInZone(view.booked_start, tz, { withYear: true })}</Body1>}
        <Caption1 className={styles.muted}>{subtitle}</Caption1>
      </div>
    );
  }
  if (view.status === "picked") {
    return (
      <div className={styles.root} role="status">
        <Subtitle1 as="h1">Thanks. We&apos;re confirming your time.</Subtitle1>
        <Spinner size="small" label="Checking the interviewers' calendars…" />
      </div>
    );
  }
  if (view.status === "counter_proposed") {
    return (
      <div className={styles.root} role="status">
        <Subtitle1 as="h1">Thanks. We&apos;ll get back to you with a time.</Subtitle1>
        <Body1>We received the times you suggested.</Body1>
      </div>
    );
  }
  if (view.status === "expired" || view.status === "closed") {
    return (
      <div className={styles.root} role="status">
        <Subtitle1 as="h1">{view.status === "expired" ? "This link has expired." : "This scheduling request is closed."}</Subtitle1>
        <Body1>If you still need to schedule, reply to the email you received.</Body1>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div>
        <Subtitle1 as="h1">{title}</Subtitle1>
        <Body1 as="p" className={styles.muted}>
          {subtitle}
        </Body1>
      </div>
      {view.notice === "slot_taken" && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>That time was just taken. Here are new options.</MessageBarBody>
        </MessageBar>
      )}
      <Field label="Times shown in">
        <Dropdown
          value={tz}
          selectedOptions={[tz]}
          onOptionSelect={(_, d) => {
            if (!d.optionValue) return;
            setTz(d.optionValue);
            changeTz.mutate(d.optionValue);
          }}
        >
          {zones.map((z) => (
            <Option key={z} value={z}>
              {z}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {!countering ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (choice !== "") pick.mutate();
          }}
        >
          <fieldset className={styles.fieldset}>
            <Field label="Available times" required validationState={error ? "error" : "none"} validationMessage={error ?? undefined}>
              <RadioGroup value={choice} onChange={(_, d) => setChoice(d.value)} aria-label="Available times">
                {view.slots.map((s) => (
                  <Radio key={s.index} value={String(s.index)} label={slotLabel(s.start, s.end, tz)} />
                ))}
              </RadioGroup>
            </Field>
            <div className={styles.actions}>
              <Button type="submit" appearance="primary" disabled={choice === "" || pick.isPending} icon={pick.isPending ? <Spinner size="tiny" /> : undefined}>
                Confirm this time
              </Button>
              <Link as="button" type="button" onClick={() => setCountering(true)}>
                None of these work
              </Link>
            </div>
          </fieldset>
        </form>
      ) : (
        <CounterForm source={source} view={view} tz={tz} onCancel={() => setCountering(false)} onDone={set} />
      )}
      {view.expires_at && <Caption1 className={styles.muted}>This link works until {formatInZone(view.expires_at, tz)}.</Caption1>}
    </div>
  );
}

function CounterForm({
  source,
  view,
  tz,
  onCancel,
  onDone,
}: {
  source: SlotPickSource;
  view: SlotPickView;
  tz: string;
  onCancel: () => void;
  onDone: (v: SlotPickView) => void;
}) {
  const styles = useStyles();
  const [rows, setRows] = useState<CounterRow[]>(EMPTY_ROWS);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const send = useMutation({
    mutationFn: (windows: { start: string; end: string }[]) => source.counter(windows, note.trim() || null),
    onSuccess: onDone,
    onError: (e) => setErrors([errorMessage(e)]),
  });
  const update = (i: number, patch: Partial<CounterRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = validateCounter(rows, tz, view.duration);
        setErrors(v.errors);
        if (v.errors.length === 0) send.mutate(v.windows);
      }}
    >
      <fieldset className={styles.fieldset}>
        <Text as="h2" weight="semibold">
          Suggest up to 3 times
        </Text>
        {rows.map((r, i) => (
          <div key={i} className={styles.row} role="group" aria-label={`Time ${i + 1}`}>
            <Field label={`Date ${i + 1}`} className={styles.rowField}>
              <Input type="date" value={r.date} onChange={(_, d) => update(i, { date: d.value })} />
            </Field>
            <Field label="From" className={styles.rowField}>
              <Input type="time" value={r.from} onChange={(_, d) => update(i, { from: d.value })} />
            </Field>
            <Field label="To" className={styles.rowField}>
              <Input type="time" value={r.to} onChange={(_, d) => update(i, { to: d.value })} />
            </Field>
          </div>
        ))}
        <Field label="Anything we should know? (optional)">
          <Textarea value={note} maxLength={500} onChange={(_, d) => setNote(d.value)} resize="vertical" />
        </Field>
        {errors.length > 0 && (
          <MessageBar intent="error" layout="multiline" role="alert">
            <MessageBarBody>
              {errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </MessageBarBody>
          </MessageBar>
        )}
        <div className={styles.actions}>
          <Button type="submit" appearance="primary" disabled={send.isPending} icon={send.isPending ? <Spinner size="tiny" /> : undefined}>
            Send
          </Button>
          <Button type="button" onClick={onCancel} disabled={send.isPending}>
            Back to the offered times
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
