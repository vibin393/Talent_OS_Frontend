"use client";

import {
  Button,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import type { BusinessCalendarIn, BusinessCalendarOut, DemandPriority, SlaMilestone, SlaTargetIn, SlaTargetOut } from "@/lib/api/types";
import { demandKeys, demandsApi } from "./api";
import { demandErrorMessage } from "./errors";
import { formatDate } from "./format";
import { MILESTONE_LABELS, PRIORITIES, PRIORITY_LABELS } from "./status";
import {
  calendarDraft,
  type CalendarDraft,
  calendarIn,
  DAY_LABELS,
  DAYS,
  type TargetRow,
  targetRows,
  targetsIn,
  validateCalendar,
  validateTargets,
} from "./sla-form";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXL, maxWidth: "980px" },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  tableWrap: { overflowX: "auto" },
  day: { display: "grid", gridTemplateColumns: "140px 120px 120px", gap: tokens.spacingHorizontalM, alignItems: "center" },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  holidays: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  error: { color: tokens.colorPaletteRedForeground1 },
  muted: { color: tokens.colorNeutralForeground3 },
});

const MILESTONES: readonly SlaMilestone[] = ["assignment", "first_submission", "first_interview", "client_feedback"];
const ANY = "__any__";

function TargetsCard({ initial }: { initial: SlaTargetOut[] }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<TargetRow[]>(() => targetRows(initial));
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (targets: SlaTargetIn[]) => demandsApi.putSlaTargets(targets),
    onSuccess: (data) => queryClient.setQueryData(demandKeys.slaTargets, data),
  });
  const set = (i: number, patch: Partial<TargetRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Targets</Subtitle2>}
        description="How long each milestone may take after the demand opens. A priority-specific target overrides the “Any priority” one."
      />
      <ErrorBar message={formError} />
      <div className={styles.tableWrap}>
        <Table aria-label="SLA targets" style={{ minWidth: 760 }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Milestone</TableHeaderCell>
              <TableHeaderCell>Priority</TableHeaderCell>
              <TableHeaderCell>Target (hours)</TableHeaderCell>
              <TableHeaderCell>Clock</TableHeaderCell>
              <TableHeaderCell>At risk at %</TableHeaderCell>
              <TableHeaderCell aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Dropdown
                    aria-label="Milestone"
                    size="small"
                    value={MILESTONE_LABELS[r.milestone]}
                    selectedOptions={[r.milestone]}
                    onOptionSelect={(_, d) => set(i, { milestone: d.optionValue as SlaMilestone })}
                  >
                    {MILESTONES.map((m) => (
                      <Option key={m} value={m}>
                        {MILESTONE_LABELS[m]}
                      </Option>
                    ))}
                  </Dropdown>
                </TableCell>
                <TableCell>
                  <Dropdown
                    aria-label="Priority"
                    size="small"
                    value={r.priority ? PRIORITY_LABELS[r.priority] : "Any priority"}
                    selectedOptions={[r.priority ?? ANY]}
                    onOptionSelect={(_, d) => set(i, { priority: d.optionValue === ANY ? null : (d.optionValue as DemandPriority) })}
                  >
                    <Option value={ANY}>Any priority</Option>
                    {PRIORITIES.map((p) => (
                      <Option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </Option>
                    ))}
                  </Dropdown>
                </TableCell>
                <TableCell>
                  <Input aria-label="Target hours" size="small" inputMode="decimal" value={r.targetHours} onChange={(_, d) => set(i, { targetHours: d.value })} />
                </TableCell>
                <TableCell>
                  <Dropdown
                    aria-label="Clock"
                    size="small"
                    value={r.clock === "business" ? "Business hours" : "Calendar hours"}
                    selectedOptions={[r.clock]}
                    onOptionSelect={(_, d) => set(i, { clock: d.optionValue === "calendar" ? "calendar" : "business" })}
                  >
                    <Option value="business">Business hours</Option>
                    <Option value="calendar">Calendar hours</Option>
                  </Dropdown>
                </TableCell>
                <TableCell>
                  <Input aria-label="At risk percent" size="small" inputMode="numeric" value={r.atRisk} onChange={(_, d) => set(i, { atRisk: d.value })} />
                  {errors[i] && (
                    <Text size={200} className={styles.error} role="alert" block>
                      {errors[i]}
                    </Text>
                  )}
                </TableCell>
                <TableCell>
                  <Button appearance="subtle" icon={<Delete20Regular />} aria-label="Remove target" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length === 0 && <Text className={styles.muted}>No targets: SLA clocks are not started.</Text>}
      <div className={admin.footer} style={{ justifyContent: "space-between" }}>
        <Button
          icon={<Add20Regular />}
          disabled={rows.length >= 40}
          onClick={() => setRows((r) => [...r, { milestone: "assignment", priority: null, targetHours: "8", clock: "business", atRisk: "75" }])}
        >
          Add target
        </Button>
        <Button
          appearance="primary"
          disabled={save.isPending}
          icon={save.isPending ? <Spinner size="tiny" /> : undefined}
          onClick={async () => {
            setFormError(null);
            const e = validateTargets(rows);
            setErrors(e);
            if (Object.keys(e).length) return;
            try {
              const saved = await save.mutateAsync(targetsIn(rows));
              setRows(targetRows(saved));
              toast.success("SLA targets saved");
            } catch (err) {
              setFormError(demandErrorMessage(err));
            }
          }}
        >
          Save targets
        </Button>
      </div>
    </Card>
  );
}

function CalendarCard({ initial }: { initial: BusinessCalendarOut }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CalendarDraft>(() => calendarDraft(initial));
  const [holiday, setHoliday] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: BusinessCalendarIn) => demandsApi.putCalendar(body),
    onSuccess: (data) => queryClient.setQueryData(demandKeys.calendar, data),
  });
  const setDay = (day: (typeof DAYS)[number], patch: Partial<CalendarDraft["days"][string]>) =>
    setDraft((d) => ({ ...d, days: { ...d.days, [day]: { ...d.days[day], ...patch } } }));

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Business calendar</Subtitle2>}
        description={`Working hours and holidays for business-hour SLA clocks. Times are in the workspace time zone (${initial.timezone}).`}
      />
      <ErrorBar message={error} />
      {DAYS.map((day) => {
        const d = draft.days[day];
        return (
          <div key={day} className={styles.day}>
            <Switch label={DAY_LABELS[day]} checked={d.working} onChange={(_, v) => setDay(day, { working: v.checked })} />
            <Input aria-label={`${DAY_LABELS[day]} start`} type="time" disabled={!d.working} value={d.start} onChange={(_, v) => setDay(day, { start: v.value })} />
            <Input aria-label={`${DAY_LABELS[day]} end`} type="time" disabled={!d.working} value={d.end} onChange={(_, v) => setDay(day, { end: v.value })} />
          </div>
        );
      })}
      <div className={styles.row}>
        <Field label="Add a holiday">
          <Input type="date" value={holiday} onChange={(_, v) => setHoliday(v.value)} />
        </Field>
        <Button
          icon={<Add20Regular />}
          disabled={!holiday || draft.holidays.includes(holiday)}
          onClick={() => {
            setDraft((d) => ({ ...d, holidays: [...d.holidays, holiday].sort() }));
            setHoliday("");
          }}
        >
          Add
        </Button>
      </div>
      {draft.holidays.length === 0 ? (
        <Text className={styles.muted}>No holidays.</Text>
      ) : (
        <div className={styles.holidays}>
          {draft.holidays.map((h) => (
            <Button
              key={h}
              size="small"
              icon={<Delete20Regular />}
              iconPosition="after"
              aria-label={`Remove holiday ${formatDate(h)}`}
              onClick={() => setDraft((d) => ({ ...d, holidays: d.holidays.filter((x) => x !== h) }))}
            >
              {formatDate(h)}
            </Button>
          ))}
        </div>
      )}
      <div className={admin.footer}>
        <Button
          appearance="primary"
          disabled={save.isPending}
          icon={save.isPending ? <Spinner size="tiny" /> : undefined}
          onClick={async () => {
            setError(null);
            const problem = validateCalendar(draft);
            if (problem) return setError(problem);
            try {
              const saved = await save.mutateAsync(calendarIn(draft));
              setDraft(calendarDraft(saved));
              toast.success("Business calendar saved");
            } catch (e) {
              setError(demandErrorMessage(e));
            }
          }}
        >
          Save calendar
        </Button>
      </div>
    </Card>
  );
}

function PrefixCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: demandKeys.settings, queryFn: ({ signal }) => demandsApi.settings(signal) });
  const [prefix, setPrefix] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (p: string) => demandsApi.putSettings(p),
    onSuccess: (data) => queryClient.setQueryData(demandKeys.settings, data),
  });
  const value = prefix ?? settings.data?.req_prefix ?? "";
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Demand IDs</Subtitle2>} description="Prefix of new demand IDs. Numbering continues when it changes." />
      <div className={styles.row}>
        <Field label="Prefix" validationState={error ? "error" : "none"} validationMessage={error} hint={`Next IDs look like ${value || "REQ"}-0042`}>
          <Input value={value} maxLength={10} onChange={(_, d) => setPrefix(d.value.toUpperCase())} disabled={settings.isPending} />
        </Field>
        <Button
          appearance="primary"
          disabled={save.isPending || !prefix || prefix === settings.data?.req_prefix}
          onClick={async () => {
            setError(null);
            if (!/^[A-Z][A-Z0-9]{0,9}$/.test(value)) return setError("A letter followed by up to 9 letters or digits");
            try {
              await save.mutateAsync(value);
              setPrefix(null);
              toast.success("Prefix saved");
            } catch (e) {
              setError(demandErrorMessage(e));
            }
          }}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}

/** `/admin/sla`: SLA targets per milestone and priority, the business calendar and the REQ prefix. */
export function SlaSettings() {
  const styles = useStyles();
  const canManage = usePermission("settings:manage");
  const targets = useQuery({ queryKey: demandKeys.slaTargets, queryFn: ({ signal }) => demandsApi.slaTargets(signal), enabled: canManage });
  const calendar = useQuery({ queryKey: demandKeys.calendar, queryFn: ({ signal }) => demandsApi.calendar(signal), enabled: canManage });

  if (!canManage) return <NoAccess what="demand settings" />;

  return (
    <>
      <PageHeader title="Demand SLAs" subtitle="Service levels for new demands: targets, working hours and holidays." />
      <div className={styles.root}>
        {targets.isPending ? (
          <GridSkeleton />
        ) : targets.isError ? (
          <ErrorBar title="Could not load SLA targets." message={errorMessage(targets.error)} />
        ) : (
          <TargetsCard initial={targets.data} />
        )}
        {calendar.isPending ? (
          <GridSkeleton />
        ) : calendar.isError ? (
          <ErrorBar title="Could not load the business calendar." message={errorMessage(calendar.error)} />
        ) : (
          <CalendarCard initial={calendar.data} />
        )}
        <PrefixCard />
      </div>
    </>
  );
}
