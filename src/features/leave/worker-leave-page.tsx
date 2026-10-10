"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  Dropdown,
  Field,
  makeStyles,
  mergeClasses,
  Option,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { DatePicker } from "@fluentui/react-datepicker-compat";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/features/admin/ui";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { useMyHolidays } from "@/features/holidays/use-holiday-calendars";
import { errorMessage } from "@/lib/api/errors";
import type { LeaveRequestIn, WorkerLeaveRequestOut } from "./types";
import { useMyLeaveBalances } from "./use-leave-balances";
import { useLeavePreview, useMyLeaveRequests, useMyLeaveTypes } from "./use-leave-requests";
import { formatDays, fromPickerDate, halfDayError, halfLabel, previewText, STATUS_COLOR, STATUS_LABEL, toPickerDate } from "./validation";

const useStyles = makeStyles({
  balances: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: tokens.spacingHorizontalM },
  balance: { padding: tokens.spacingHorizontalM, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  big: { fontSize: tokens.fontSizeHero700, lineHeight: tokens.lineHeightHero700, fontWeight: tokens.fontWeightSemibold },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  dates: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM },
  grow: { flex: "1 1 150px", minWidth: 0 },
  preview: { color: tokens.colorNeutralForeground2 },
  previewBad: { color: tokens.colorPaletteRedForeground1 },
});

/** `/portal/work/leave`: balances, request form with live day count, my requests and holidays (360 px first). */
export function WorkerLeavePage() {
  const portal = usePortalStyles();
  const styles = useStyles();
  const types = useMyLeaveTypes();
  const balances = useMyLeaveBalances();
  const { query, create, withdraw, cancel } = useMyLeaveRequests();
  const year = new Date().getFullYear();
  const hol = useMyHolidays(year);

  const [typeId, setTypeId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [startHalf, setStartHalf] = useState(false);
  const [endHalf, setEndHalf] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "withdraw" | "cancel"; req: WorkerLeaveRequestOut } | null>(null);

  const type = types.data?.find((t) => t.id === typeId);
  const formError = typeId ? halfDayError({ start_date: start, end_date: end, start_half: startHalf, end_half: endHalf, allow_half_day: type?.allow_half_day ?? true }) : null;
  const body: LeaveRequestIn | null = useMemo(
    () =>
      typeId && start && end && !formError
        ? { leave_type_id: typeId, start_date: start, end_date: end, start_half: startHalf ? "pm" : null, end_half: endHalf ? "am" : null }
        : null,
    [typeId, start, end, startHalf, endHalf, formError],
  );
  const preview = useLeavePreview(body);

  if (query.isPending || types.isPending) return <LoadingBlock label="Loading leave" />;
  if (query.isError) return <ErrorBlock error={query.error} onRetry={() => query.refetch()} />;

  const submit = () => {
    if (!body) return;
    create.mutate(
      { ...body, reason: reason.trim() || null },
      {
        onSuccess: () => {
          setStart("");
          setEnd("");
          setStartHalf(false);
          setEndHalf(false);
          setReason("");
        },
      },
    );
  };

  return (
    <div className={portal.page}>
      <PortalPageHeader title="My leave" subtitle="Request leave, see your balances and choose optional holidays." />
      <div className={styles.balances}>
        {(balances.data ?? []).map((b) => (
          <Card key={b.leave_type_id} className={styles.balance}>
            <Caption1>{b.leave_type_name}</Caption1>
            <Text className={styles.big}>{b.available}</Text>
            <Caption1>available · {b.pending} pending</Caption1>
          </Card>
        ))}
      </div>

      <Card className={portal.card}>
        <Text weight="semibold">Request leave</Text>
        <div className={styles.form}>
          <Field label="Leave type" required>
            <Dropdown
              placeholder="Choose a leave type"
              selectedOptions={typeId ? [typeId] : []}
              value={type?.name ?? ""}
              onOptionSelect={(_, d) => setTypeId(d.optionValue ?? "")}
            >
              {(types.data ?? []).map((t) => (
                <Option key={t.id} value={t.id}>
                  {t.name}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <div className={styles.dates}>
            <Field label="From" required className={styles.grow}>
              <DatePicker value={start ? toPickerDate(start) : null} onSelectDate={(d) => setStart(d ? fromPickerDate(d) : "")} placeholder="Start date" />
            </Field>
            <Field label="To" required className={styles.grow}>
              <DatePicker value={end ? toPickerDate(end) : null} onSelectDate={(d) => setEnd(d ? fromPickerDate(d) : "")} placeholder="End date" />
            </Field>
          </div>
          {type?.allow_half_day !== false && (
            <div className={styles.dates}>
              <Checkbox label="Start in the afternoon (half day)" checked={startHalf} onChange={(_, d) => setStartHalf(!!d.checked)} />
              <Checkbox label="End at noon (half day)" checked={endHalf} onChange={(_, d) => setEndHalf(!!d.checked)} />
            </div>
          )}
          <Field label="Reason (optional)">
            <Textarea value={reason} onChange={(_, d) => setReason(d.value)} maxLength={2000} />
          </Field>
          {formError ? (
            <InlineError message={formError} />
          ) : preview.data ? (
            <Body1 className={mergeClasses(styles.preview, !!(!preview.data.sufficient || preview.data.error_code) && styles.previewBad)}>
              {previewText(preview.data.days, preview.data.error_code)}
            </Body1>
          ) : null}
          <InlineError message={create.isError ? errorMessage(create.error) : null} />
          <div>
            <Button appearance="primary" disabled={!body || create.isPending || preview.data?.sufficient === false} onClick={submit}>
              Request leave
            </Button>
          </div>
        </div>
      </Card>

      <Card className={portal.card}>
        <Text weight="semibold">My requests</Text>
        {query.data.length === 0 ? (
          <Body1 className={portal.empty}>You have no leave requests yet.</Body1>
        ) : (
          <ul className={portal.list}>
            {query.data.map((r) => (
              <li key={r.id} className={portal.row}>
                <span className={portal.rowMain}>
                  <Text weight="semibold">
                    {r.leave_type_name ?? "Leave"} · {formatDays(r.days)}
                  </Text>
                  <Caption1>
                    {r.start_date}
                    {halfLabel(r.start_half)} to {r.end_date}
                    {halfLabel(r.end_half)} · {r.human_id}
                  </Caption1>
                  {r.decision_comment && <Caption1>“{r.decision_comment}”</Caption1>}
                </span>
                <span className={portal.actions}>
                  <Badge appearance="tint" color={STATUS_COLOR[r.status]}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                  {r.status === "requested" && <Button size="small" onClick={() => setConfirm({ kind: "withdraw", req: r })}>Withdraw</Button>}
                  {r.status === "approved" && <Button size="small" onClick={() => setConfirm({ kind: "cancel", req: r })}>Cancel</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <InlineError message={withdraw.isError ? errorMessage(withdraw.error) : cancel.isError ? errorMessage(cancel.error) : null} />
      </Card>

      <Card className={portal.card}>
        <Text weight="semibold">Holidays {year}</Text>
        {hol.query.data && hol.query.data.optional_allowance > 0 && (
          <Caption1>
            Optional holidays: {hol.query.data.optional_selected} of {hol.query.data.optional_allowance} chosen
          </Caption1>
        )}
        {(hol.query.data?.holidays ?? []).length === 0 ? (
          <Body1 className={portal.empty}>No holidays published for your placement yet.</Body1>
        ) : (
          <ul className={portal.list}>
            {hol.query.data?.holidays.map((h) => (
              <li key={h.holiday_id} className={portal.row}>
                <span className={portal.rowMain}>
                  <Text>{h.name}</Text>
                  <Caption1>{h.date}</Caption1>
                </span>
                {h.optional ? (
                  <Checkbox
                    label="Take this day"
                    checked={h.selected}
                    disabled={hol.toggle.isPending}
                    onChange={(_, d) => hol.toggle.mutate({ id: h.holiday_id, selected: !!d.checked })}
                  />
                ) : (
                  <Badge appearance="outline">Holiday</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <InlineError message={hol.toggle.isError ? errorMessage(hol.toggle.error) : null} />
      </Card>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "cancel" ? "Cancel approved leave?" : "Withdraw this request?"}
        confirmLabel={confirm?.kind === "cancel" ? "Request cancellation" : "Withdraw"}
        onConfirm={async () => {
          if (!confirm) return;
          await (confirm.kind === "cancel" ? cancel : withdraw).mutateAsync(confirm.req.id).catch(() => undefined);
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      >
        {confirm?.kind === "cancel"
          ? "Your approver must approve the cancellation. Leave already on a submitted timesheet must be recalled first."
          : "The request is withdrawn and the days return to your balance."}
      </ConfirmDialog>
    </div>
  );
}
