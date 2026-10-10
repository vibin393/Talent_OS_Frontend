"use client";

import {
  Body1,
  Button,
  Caption1,
  Checkbox,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle2,
  Switch,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Globe16Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { AppLink } from "@/components/app-link";
import { hasActiveConnection } from "@/features/calendar/connections";
import { useConnections } from "@/features/calendar/use-connections";
import { useMe } from "@/features/auth/use-me";
import { isApiError } from "@/lib/api/errors";
import { browserTimeZone, timeToMinutes, minutesToTime } from "@/lib/time/zones";
import { interviewError } from "./errors";
import { FreeBusyStrip, type FreeBusyRow } from "./free-busy-strip";
import { daySlots, stripRange } from "./free-busy";
import { formatDuration, KIND_LABELS, MODE_LABELS } from "./format";
import { DateField, EmailTagsField, PeoplePicker, TimeZoneField } from "./pickers";
import {
  DURATION_OPTIONS,
  emptySchedule,
  linkFieldState,
  previewLines,
  type ScheduleErrors,
  type ScheduleValues,
  timeOptions,
  toCreatePayload,
  toReschedulePayload,
  validateSchedule,
  valuesFromInterview,
} from "./schedule-form";
import type { InterviewMode, InterviewOut } from "./types";
import { useFreeBusy } from "./use-free-busy";
import { useInterviewPlan } from "./use-interview-plan";
import { useScheduleInterview } from "./use-schedule-interview";

const useStyles = makeStyles({
  surface: { width: "min(1080px, calc(100vw - 32px))", maxWidth: "none" },
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "grid", gap: tokens.spacingHorizontalM, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" },
  wide: { gridColumn: "1 / -1" },
  preview: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  previewLine: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  muted: { color: tokens.colorNeutralForeground3 },
});

const TIMES = timeOptions(15);
const MODES: InterviewMode[] = ["video", "phone", "in_person"];

export type ScheduleTarget =
  | { kind: "create"; applicationId: string; demandId: string; candidateName: string; candidateTimezone?: string | null; stageId?: string | null }
  | { kind: "reschedule"; interview: InterviewOut; candidateTimezone?: string | null };

/**
 * Schedule (or reschedule) an interview: stage, date, 15-minute start time, duration, organiser time zone,
 * mode with Teams/Meet link or a pasted link, interviewers, the Outlook-style free/busy strip and a
 * "Candidate sees …" preview per participant time zone. The server converts the local time to UTC.
 */
export function ScheduleDialog({ target, onClose, onDone }: { target: ScheduleTarget; onClose: () => void; onDone?: (i: InterviewOut) => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const { data: me } = useMe();
  const connections = useConnections();
  const organiserConnected = hasActiveConnection(connections.data);
  const demandId = target.kind === "create" ? target.demandId : target.interview.demand_id;
  const plan = useInterviewPlan(demandId);
  const mutation = useScheduleInterview();
  const reschedule = target.kind === "reschedule";
  const candidateName = target.kind === "create" ? target.candidateName : (target.interview.candidate_name ?? "Candidate");

  const [values, setValues] = useState<ScheduleValues>(() => {
    if (target.kind === "reschedule") return valuesFromInterview(target.interview);
    const tz = me?.tenant?.timezone && browserTimeZone() === "UTC" ? me.tenant.timezone : browserTimeZone();
    return { ...emptySchedule(tz), stageId: target.stageId ?? null };
  });
  const [errors, setErrors] = useState<ScheduleErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const stages = plan.data?.stages ?? [];
  const set = <K extends keyof ScheduleValues>(key: K, value: ScheduleValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, start: key === "date" || key === "time" || key === "timezone" ? undefined : e.start }));
  };

  // Picking a stage also applies its default duration.
  const pickStage = (id: string) => {
    const stage = stages.find((s) => s.id === id);
    setValues((v) => ({ ...v, stageId: id, duration: stage && !reschedule ? stage.default_duration_minutes : v.duration }));
    setErrors((e) => ({ ...e, stageId: undefined }));
  };

  const current: ScheduleValues = !reschedule && !values.stageId && stages.length > 0 ? { ...values, stageId: stages[0].id } : values;
  const link = linkFieldState(values.mode, organiserConnected, values.createOnlineMeeting);

  // Free/busy: the organiser plus internal interviewers, for the selected day in the selected zone.
  const slots = useMemo(() => daySlots(values.date, values.timezone), [values.date, values.timezone]);
  const range = stripRange(slots);
  const people = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    if (me) list.push({ id: me.user.id, name: `${me.user.name || me.user.email} (organiser)` });
    for (const p of values.interviewers) if (!list.some((x) => x.id === p.id)) list.push(p);
    return list;
  }, [me, values.interviewers]);
  const freeBusy = useFreeBusy(
    people.map((p) => p.id),
    range?.startUtc ?? null,
    range?.endUtc ?? null,
  );
  const rows: FreeBusyRow[] = people.map((p) => {
    const item = freeBusy.data?.items.find((x) => x.user_id === p.id);
    return { id: p.id, name: p.name, status: item ? item.status : freeBusy.isError ? "unknown" : "loading", busy: item?.busy ?? [] };
  });

  const audiences = [
    { label: "Candidate", timezone: target.candidateTimezone ?? values.timezone },
    ...(target.kind === "reschedule"
      ? target.interview.participants
          .filter((p) => p.kind !== "candidate")
          .map((p) => ({ label: p.name || p.email, timezone: p.timezone }))
      : []),
    { label: "You", timezone: browserTimeZone() },
  ];
  const previews = previewLines(values, audiences);

  const submit = async () => {
    setServerError(null);
    const e = validateSchedule(current, { requireStage: !reschedule, organiserConnected });
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    try {
      const result =
        target.kind === "create"
          ? await mutation.mutateAsync({ kind: "create", applicationId: target.applicationId, body: toCreatePayload(current, organiserConnected) })
          : await mutation.mutateAsync({
              kind: "reschedule",
              id: target.interview.id,
              body: toReschedulePayload(values, organiserConnected, target.interview.version),
            });
      toast.success(
        reschedule
          ? `Rescheduled ${result.human_id}. Updated invitations are on their way.`
          : `Scheduled ${result.human_id} for ${result.display_time}.${values.sendInvites ? " Invitations are on their way." : ""}`,
      );
      onDone?.(result);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.code === "nonexistent_local_time") setErrors((x) => ({ ...x, start: interviewError(err) }));
      else if (isApiError(err) && err.code === "invalid_timezone") setErrors((x) => ({ ...x, timezone: interviewError(err) }));
      else setServerError(interviewError(err));
    }
  };

  const startMinutes = timeToMinutes(values.time);

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !mutation.isPending && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>
            {reschedule ? `Reschedule ${target.interview.human_id}` : "Schedule interview"} · {candidateName}
          </DialogTitle>
          <DialogContent className={styles.content}>
            {serverError && (
              <MessageBar intent="error" layout="multiline" role="alert">
                <MessageBarBody>{serverError}</MessageBarBody>
              </MessageBar>
            )}
            <div className={styles.row}>
              {reschedule ? (
                <Field label="Stage">
                  <Input readOnly value={target.interview.stage_name} />
                </Field>
              ) : (
                <Field label="Stage" required validationState={errors.stageId ? "error" : "none"} validationMessage={errors.stageId}>
                  <Dropdown
                    placeholder={plan.isPending ? "Loading plan…" : stages.length ? "Choose a stage" : "No stages in the plan"}
                    value={stages.find((s) => s.id === current.stageId)?.name ?? ""}
                    selectedOptions={current.stageId ? [current.stageId] : []}
                    onOptionSelect={(_, d) => d.optionValue && pickStage(d.optionValue)}
                  >
                    {stages.map((s) => (
                      <Option key={s.id} value={s.id} text={s.name}>
                        {`${s.position}. ${s.name} · ${KIND_LABELS[s.kind]}`}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              )}
              <DateField label="Date" required value={values.date} onChange={(d) => set("date", d)} validationMessage={errors.date} />
              <Field label="Start time" required validationState={errors.time ? "error" : "none"} validationMessage={errors.time}>
                <Combobox
                  freeform
                  value={values.time}
                  selectedOptions={[values.time]}
                  onOptionSelect={(_, d) => d.optionValue && set("time", d.optionValue)}
                  onChange={(e) => {
                    const t = e.target.value.trim();
                    if (/^\d{1,2}:\d{2}$/.test(t)) set("time", minutesToTime(timeToMinutes(t)));
                  }}
                  aria-label="Start time"
                >
                  {TIMES.map((t) => (
                    <Option key={t} value={t}>
                      {t}
                    </Option>
                  ))}
                </Combobox>
              </Field>
              <Field label="Duration" required validationState={errors.duration ? "error" : "none"} validationMessage={errors.duration}>
                <Dropdown
                  value={formatDuration(values.duration)}
                  selectedOptions={[String(values.duration)]}
                  onOptionSelect={(_, d) => d.optionValue && set("duration", Number(d.optionValue))}
                >
                  {[...new Set([...DURATION_OPTIONS, values.duration])]
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <Option key={m} value={String(m)}>
                        {formatDuration(m)}
                      </Option>
                    ))}
                </Dropdown>
              </Field>
              <TimeZoneField
                value={values.timezone}
                onChange={(tz) => set("timezone", tz)}
                preferred={[browserTimeZone(), me?.tenant?.timezone, target.candidateTimezone]}
                validationMessage={errors.timezone}
              />
            </div>
            {errors.start && (
              <MessageBar intent="warning" layout="multiline">
                <MessageBarBody>
                  {errors.start}
                  {!values.allowPast && errors.start.includes("past") && (
                    <>
                      {" "}
                      <Button appearance="transparent" size="small" onClick={() => set("allowPast", true)}>
                        Record a past interview
                      </Button>
                    </>
                  )}
                </MessageBarBody>
              </MessageBar>
            )}

            <div className={styles.row}>
              <PeoplePicker
                label="Interviewers"
                value={values.interviewers}
                onChange={(p) => {
                  set("interviewers", p);
                  setErrors((e) => ({ ...e, interviewers: undefined }));
                }}
                validationMessage={errors.interviewers}
              />
              <EmailTagsField
                label="External interviewers"
                value={values.externals}
                onChange={(x) => {
                  set("externals", x);
                  setErrors((e) => ({ ...e, interviewers: undefined }));
                }}
                validationMessage={errors.externals}
                hint="They get the invitation and a secure scorecard link."
              />
            </div>

            <div>
              <Subtitle2 as="h3" style={{ marginBottom: tokens.spacingVerticalXS, display: "block" }}>
                Scheduling assistant
              </Subtitle2>
              <FreeBusyStrip
                date={values.date}
                timeZone={values.timezone}
                rows={rows}
                startMinutes={startMinutes}
                durationMinutes={values.duration}
                onPickSlot={(m) => set("time", minutesToTime(m))}
                loading={freeBusy.isFetching}
              />
              {!organiserConnected && (
                <Caption1 className={styles.muted}>
                  Connect your calendar in <AppLink href="/settings/connections">Calendar connections</AppLink> to see busy times and create Teams or
                  Meet links.
                </Caption1>
              )}
            </div>

            <div className={styles.row}>
              <Field label="Mode">
                <RadioGroup layout="horizontal" value={values.mode} onChange={(_, d) => set("mode", d.value as InterviewMode)}>
                  {MODES.map((m) => (
                    <Radio key={m} value={m} label={MODE_LABELS[m]} />
                  ))}
                </RadioGroup>
              </Field>
              {link.showSwitch && (
                <Field
                  label="Online meeting"
                  hint={link.switchEnabled ? "Adds a Teams or Meet link from your connected calendar." : "Connect your calendar to create Teams or Meet links."}
                >
                  <Switch
                    label="Create Teams/Meet link"
                    checked={link.switchEnabled && values.createOnlineMeeting}
                    disabled={!link.switchEnabled}
                    onChange={(_, d) => set("createOnlineMeeting", d.checked)}
                  />
                </Field>
              )}
              {link.showLinkInput && (
                <Field label="Meeting link" hint="Paste a Zoom or other link" validationState={errors.meetingUrl ? "error" : "none"} validationMessage={errors.meetingUrl}>
                  <Input type="url" value={values.meetingUrl} placeholder="https://" onChange={(_, d) => set("meetingUrl", d.value)} />
                </Field>
              )}
              {link.showLocation && (
                <Field label="Location">
                  <Input value={values.location} placeholder="Office address and room" onChange={(_, d) => set("location", d.value)} />
                </Field>
              )}
            </div>
            <Field label="Notes for interviewers" hint="Not shown to the candidate.">
              <Textarea value={values.notes} resize="vertical" maxLength={8000} onChange={(_, d) => set("notes", d.value)} />
            </Field>

            {previews.length > 0 && (
              <div className={styles.preview} aria-live="polite">
                {previews.map((line) => (
                  <Body1 key={line} className={styles.previewLine}>
                    <Globe16Regular aria-hidden /> {line}
                  </Body1>
                ))}
              </div>
            )}
            <Checkbox
              checked={values.sendInvites && !values.allowPast}
              disabled={values.allowPast}
              onChange={(_, d) => set("sendInvites", !!d.checked)}
              label={values.allowPast ? "Past interviews are recorded without invitations" : "Send invitations"}
            />
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={mutation.isPending} icon={mutation.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              {reschedule ? "Reschedule" : values.allowPast ? "Record interview" : "Schedule"}
            </Button>
            <Button disabled={mutation.isPending} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
