"use client";

import {
  Avatar,
  Badge,
  Button,
  Caption1,
  Divider,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  OverlayDrawer,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import { adminApi } from "@/features/admin/api";
import { EMPTY_USER_FILTERS } from "@/features/admin/query";
import { errorMessage } from "@/lib/api/errors";
import { reportBuilderApi, reportBuilderKeys } from "./api";
import { nextRuns, scheduleSummary, WEEKDAYS } from "./logic";
import type { Cadence, ExportFormat, ReportOut, ScheduleIn, ScheduleOut } from "./types";

const useStyles = makeStyles({
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap" },
  grow: { flex: 1, minWidth: "140px" },
  schedule: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, padding: tokens.spacingVerticalS },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

const TIMEZONES = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"];
const FORMATS: ExportFormat[] = ["xlsx", "csv", "pdf"];
type Person = { id: string; name: string; email: string };

function RecipientsPicker({ value, onChange }: { value: Person[]; onChange: (next: Person[]) => void }) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const users = useQuery({
    queryKey: ["report-builder", "recipients", q],
    queryFn: ({ signal }) => adminApi.listUsers({ ...EMPTY_USER_FILTERS, q, status: "active" }, 1, 20, signal),
    placeholderData: (prev) => prev,
    retry: false,
  });
  const selected = value.map((p) => p.id);
  const options = (users.data?.items ?? []).filter((u) => !selected.includes(u.id));
  return (
    <Field label="Recipients" hint="Internal users only. Each recipient gets the report with their own permissions.">
      <TagPicker
        selectedOptions={selected}
        onOptionSelect={(_, d) => {
          const id = String(d.value);
          if (selected.includes(id)) onChange(value.filter((p) => p.id !== id));
          else {
            const u = options.find((o) => o.id === id);
            if (u) onChange([...value, { id: u.id, name: u.name ?? u.email, email: u.email }]);
          }
          setQuery("");
        }}
      >
        <TagPickerControl>
          <TagPickerGroup aria-label="Recipients">
            {value.map((p) => (
              <Tag key={p.id} value={p.id} shape="circular" media={<Avatar name={p.name} size={20} color="colorful" aria-hidden />}>
                {p.name}
              </Tag>
            ))}
          </TagPickerGroup>
          <TagPickerInput aria-label="Add recipient" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={value.length ? undefined : "Search people"} />
        </TagPickerControl>
        <TagPickerList>
          {options.map((u) => (
            <TagPickerOption key={u.id} value={u.id} text={u.name ?? u.email} media={<Avatar name={u.name ?? u.email} size={24} color="colorful" aria-hidden />} secondaryContent={u.email}>
              {u.name ?? u.email}
            </TagPickerOption>
          ))}
        </TagPickerList>
      </TagPicker>
    </Field>
  );
}

function ScheduleCard({ s, onChanged }: { s: ScheduleOut; onChanged: () => void }) {
  const styles = useStyles();
  const act = useMutation({
    mutationFn: async (action: "resume" | "pause" | "delete"): Promise<void> => {
      if (action === "resume") await reportBuilderApi.resumeSchedule(s.id);
      else if (action === "pause") await reportBuilderApi.updateSchedule(s.id, { status: "paused" });
      else await reportBuilderApi.deleteSchedule(s.id);
    },
    onSuccess: onChanged,
  });
  return (
    <div className={styles.schedule}>
      <div className={styles.row}>
        <Text weight="semibold">{scheduleSummary(s)}</Text>
        <Badge appearance="tint" color={s.status === "active" ? "success" : "warning"}>
          {s.status === "active" ? "Active" : `Paused${s.paused_reason ? ` (${s.paused_reason.replace(/_/g, " ")})` : ""}`}
        </Badge>
      </div>
      <Caption1 className={styles.muted}>
        {s.format.toUpperCase()} to {s.recipient_user_ids.length} recipient{s.recipient_user_ids.length === 1 ? "" : "s"}
        {s.next_run_at && s.status === "active" ? ` · next ${new Date(s.next_run_at).toLocaleString()}` : ""}
        {s.consecutive_failures ? ` · ${s.consecutive_failures} failed run${s.consecutive_failures === 1 ? "" : "s"}` : ""}
      </Caption1>
      <div className={styles.actions}>
        {s.status === "paused" ? (
          <Button size="small" onClick={() => act.mutate("resume")} disabled={act.isPending}>
            Resume
          </Button>
        ) : (
          <Button size="small" onClick={() => act.mutate("pause")} disabled={act.isPending}>
            Pause
          </Button>
        )}
        <Button size="small" appearance="subtle" onClick={() => act.mutate("delete")} disabled={act.isPending}>
          Delete
        </Button>
      </div>
      {act.error && (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(act.error)}</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}

/** Schedules of one report: list (status, resume) and a new-schedule form with a next-run preview. */
export function ScheduleDrawer({ report, open, onClose }: { report: ReportOut; open: boolean; onClose: () => void }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: reportBuilderKeys.schedules(report.id), queryFn: ({ signal }) => reportBuilderApi.schedules(report.id, signal), enabled: open });
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [weekday, setWeekday] = useState(0);
  const [monthDay, setMonthDay] = useState(1);
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [recipients, setRecipients] = useState<Person[]>([]);
  const body: ScheduleIn = {
    report_id: report.id,
    cadence,
    weekday: cadence === "weekly" ? weekday : null,
    month_day: cadence === "monthly" ? monthDay : null,
    local_time: `${time}:00`,
    timezone,
    format,
    recipient_user_ids: recipients.map((r) => r.id),
  };
  const preview = useMemo(() => nextRuns(body, new Date(), 3), [cadence, weekday, monthDay, time, timezone]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => queryClient.invalidateQueries({ queryKey: reportBuilderKeys.all });
  const create = useMutation({ mutationFn: () => reportBuilderApi.createSchedule(body), onSuccess: () => { setRecipients([]); void refresh(); } });
  return (
    <OverlayDrawer position="end" size="medium" open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss20Regular />} onClick={onClose} />}>Schedules</DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className={styles.body}>
        {report.status === "needs_repair" && (
          <MessageBar intent="warning">
            <MessageBarBody>This report needs repair. Its schedules stay paused until you fix and save it.</MessageBarBody>
          </MessageBar>
        )}
        {(list.data ?? []).map((s) => (
          <ScheduleCard key={s.id} s={s} onChanged={() => void refresh()} />
        ))}
        {list.data?.length === 0 && <Text className={styles.muted}>No schedules yet.</Text>}
        <Divider />
        <Text weight="semibold">New schedule</Text>
        <div className={styles.row}>
          <Field label="Cadence" className={styles.grow}>
            <Dropdown value={cadence[0].toUpperCase() + cadence.slice(1)} selectedOptions={[cadence]} onOptionSelect={(_, d) => setCadence(d.optionValue as Cadence)}>
              <Option value="daily">Daily</Option>
              <Option value="weekly">Weekly</Option>
              <Option value="monthly">Monthly</Option>
            </Dropdown>
          </Field>
          {cadence === "weekly" && (
            <Field label="Weekday" className={styles.grow}>
              <Dropdown value={WEEKDAYS[weekday]} selectedOptions={[String(weekday)]} onOptionSelect={(_, d) => setWeekday(Number(d.optionValue))}>
                {WEEKDAYS.map((w, i) => (
                  <Option key={w} value={String(i)}>
                    {w}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          )}
          {cadence === "monthly" && (
            <Field label="Day of month" className={styles.grow}>
              <Dropdown value={monthDay === -1 ? "Last day" : String(monthDay)} selectedOptions={[String(monthDay)]} onOptionSelect={(_, d) => setMonthDay(Number(d.optionValue))}>
                {[...Array.from({ length: 28 }, (_, i) => String(i + 1)), "-1"].map((v) => (
                  <Option key={v} value={v}>
                    {v === "-1" ? "Last day" : v}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          )}
        </div>
        <div className={styles.row}>
          <Field label="Time" className={styles.grow}>
            <Input type="time" value={time} onChange={(_, d) => setTime(d.value || "09:00")} />
          </Field>
          <Field label="Time zone" className={styles.grow}>
            <Dropdown value={timezone} selectedOptions={[timezone]} onOptionSelect={(_, d) => setTimezone(String(d.optionValue))}>
              {TIMEZONES.map((tz) => (
                <Option key={tz} value={tz}>
                  {tz}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Format" className={styles.grow}>
            <Dropdown value={format.toUpperCase()} selectedOptions={[format]} onOptionSelect={(_, d) => setFormat(d.optionValue as ExportFormat)}>
              {FORMATS.map((f) => (
                <Option key={f} value={f}>
                  {f.toUpperCase()}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>
        <RecipientsPicker value={recipients} onChange={setRecipients} />
        <Caption1 className={styles.muted}>Next runs: {preview.map((d) => d.toLocaleString()).join(" · ") || "—"}</Caption1>
        <Caption1 className={styles.muted}>Files with compensation, identity or personal columns, or larger than the attachment limit, are sent as a download link valid for 7 days.</Caption1>
        {create.error && (
          <MessageBar intent="error">
            <MessageBarBody>{errorMessage(create.error)}</MessageBarBody>
          </MessageBar>
        )}
        <div className={styles.actions}>
          <Button appearance="primary" disabled={!recipients.length || create.isPending || report.status === "needs_repair"} onClick={() => create.mutate()}>
            Create schedule
          </Button>
        </div>
      </DrawerBody>
    </OverlayDrawer>
  );
}
