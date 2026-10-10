"use client";

import {
  Body1,
  Button,
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
  MessageBarTitle,
  Option,
  Spinner,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { DatePicker } from "@fluentui/react-datepicker-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { adminApi, adminKeys, LOOKUP_PAGE_SIZE } from "@/features/admin/api";
import { IdSelect } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { mobilityApi } from "./api";
import {
  dateToIso,
  formatDay,
  isoToDate,
  lastWorkingDayFor,
  mobilityErrorMessage,
  type TransferForm,
  transferFormErrors,
  transferFormFrom,
} from "./logic";
import type { InternalApplicationOut, RateUnit, TransferConfirmIn, TransferContextOut } from "./types";
import { mobilityKeys, useTransferContext } from "./use-mobility";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacingHorizontalM },
  dl: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
  lwd: { fontWeight: tokens.fontWeightSemibold },
});

const RATE_UNITS: { value: RateUnit; label: string }[] = [
  { value: "hour", label: "Per hour" },
  { value: "day", label: "Per day" },
  { value: "month", label: "Per month" },
  { value: "fixed", label: "Fixed" },
];

/** "Confirm transfer" `Dialog` (behind `mobility:transfer`). Workers get a new Placement; Users a transfer record. */
export function TransferDialog({ app, onClose }: { app: InternalApplicationOut; onClose: () => void }) {
  const ctx = useTransferContext(app.id);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        {ctx.isPending ? (
          <DialogBody>
            <DialogTitle>Confirm transfer</DialogTitle>
            <DialogContent>
              <Spinner label="Loading transfer details" />
            </DialogContent>
          </DialogBody>
        ) : ctx.isError ? (
          <DialogBody>
            <DialogTitle>Confirm transfer</DialogTitle>
            <DialogContent>
              <MessageBar intent="error" role="alert" layout="multiline">
                <MessageBarBody>{isApiError(ctx.error) ? mobilityErrorMessage(ctx.error) : errorMessage(ctx.error)}</MessageBarBody>
              </MessageBar>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose}>Close</Button>
            </DialogActions>
          </DialogBody>
        ) : (
          <TransferFormBody app={app} ctx={ctx.data} onClose={onClose} />
        )}
      </DialogSurface>
    </Dialog>
  );
}

function TransferFormBody({ app, ctx, onClose }: { app: InternalApplicationOut; ctx: TransferContextOut; onClose: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const canReadTeams = usePermission("team:read");
  const [form, setForm] = useState<TransferForm>(() => transferFormFrom(ctx));
  const [touched, setTouched] = useState(false);
  const errors = transferFormErrors(form, ctx);
  const isWorker = ctx.employee_kind === "worker";
  const p = ctx.current_placement;
  const lwd = lastWorkingDayFor(form.effectiveDate);

  const teams = useQuery({
    queryKey: [...adminKeys.teams, "lookup"],
    queryFn: ({ signal }) => adminApi.listTeams(1, LOOKUP_PAGE_SIZE, signal),
    enabled: !isWorker && canReadTeams,
    staleTime: 5 * 60_000,
  });

  const confirm = useMutation({
    mutationFn: () => {
      const body: TransferConfirmIn = {
        effective_date: form.effectiveDate,
        note: form.note.trim() || null,
        to_role_title: form.roleTitle.trim() || null,
      };
      if (isWorker) {
        if (form.currency) body.currency = form.currency;
        if (form.rateUnit) body.rate_unit = form.rateUnit as RateUnit;
        if (form.payRate) body.pay_rate = form.payRate;
        if (form.billRate) body.bill_rate = form.billRate;
        if (form.burdenPct) body.burden_pct = form.burdenPct;
      } else if (form.teamId) {
        body.to_team_id = form.teamId;
      }
      return mobilityApi.confirmTransfer(app.id, body);
    },
    onSuccess: (out) => {
      qc.setQueryData(mobilityKeys.byApplication(app.application_id), out);
      void qc.invalidateQueries({ queryKey: mobilityKeys.all });
      void qc.invalidateQueries({ queryKey: ["pipeline"] });
      toast.success(
        out.transfer?.to_placement_human_id ? `Transfer confirmed. New placement ${out.transfer.to_placement_human_id}.` : "Transfer confirmed.",
      );
      onClose();
    },
  });
  const err = isApiError(confirm.error) ? confirm.error : null;
  const set = (k: keyof TransferForm) => (_: unknown, d: { value: string }) => setForm((f) => ({ ...f, [k]: d.value }));
  const show = (k: keyof TransferForm) => (touched ? errors[k] : undefined);
  const ready = ctx.can_confirm && Object.keys(errors).length === 0;

  return (
    <DialogBody>
      <DialogTitle>{`Confirm transfer${app.candidate_name ? ` for ${app.candidate_name}` : ""}`}</DialogTitle>
      <DialogContent>
        <form
          id="mobility-transfer"
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (ready) confirm.mutate();
          }}
        >
          {!ctx.can_confirm && (
            <MessageBar intent="warning" layout="multiline">
              <MessageBarBody>
                <MessageBarTitle>The transfer cannot be confirmed yet</MessageBarTitle>
                {ctx.blocking_reason ? mobilityErrorMessage({ code: ctx.blocking_reason, message: ctx.blocking_reason }) : "Check the application status."}
              </MessageBarBody>
            </MessageBar>
          )}
          {err && (
            <MessageBar intent="error" layout="multiline" role="alert">
              <MessageBarBody>
                <MessageBarTitle>{err.status === 403 && err.code !== "human_only_action" ? "You cannot confirm this transfer" : "Transfer not confirmed"}</MessageBarTitle>
                {mobilityErrorMessage(err)}
              </MessageBarBody>
            </MessageBar>
          )}
          <Body1>{`Moves ${app.candidate_name ?? "the employee"} to ${ctx.demand_title ?? app.demand_title ?? "the new role"}.`}</Body1>

          <Field
            label="Effective date"
            required
            validationState={show("effectiveDate") ? "error" : "none"}
            validationMessage={show("effectiveDate")}
            hint={`Earliest: ${formatDay(ctx.earliest_effective_date)}`}
          >
            <DatePicker
              value={isoToDate(form.effectiveDate)}
              minDate={isoToDate(ctx.earliest_effective_date) ?? undefined}
              allowTextInput
              placeholder="Choose a date"
              onSelectDate={(d) => setForm((f) => ({ ...f, effectiveDate: dateToIso(d) ?? "" }))}
            />
          </Field>

          {isWorker ? (
            <>
              <section aria-labelledby="transfer-current">
                <Subtitle2 as="h3" id="transfer-current">
                  Current assignment
                </Subtitle2>
                {p ? (
                  <dl className={styles.dl}>
                    <dt>Placement</dt>
                    <dd>{p.human_id}</dd>
                    <dt>Role</dt>
                    <dd>{p.role_title ?? "—"}</dd>
                    <dt>Started</dt>
                    <dd>{formatDay(p.actual_start_date ?? p.planned_start_date)}</dd>
                    <dt>Planned end</dt>
                    <dd>{formatDay(p.end_date)}</dd>
                  </dl>
                ) : (
                  <Text>No active placement found.</Text>
                )}
                {lwd && (
                  <Text as="p" className={styles.lwd} aria-live="polite">
                    {`Current assignment ends on ${formatDay(lwd)}`}
                  </Text>
                )}
              </section>
              <section aria-labelledby="transfer-new" className={styles.form}>
                <Subtitle2 as="h3" id="transfer-new">
                  New placement
                </Subtitle2>
                <Field label="Role title">
                  <Input value={form.roleTitle} maxLength={300} onChange={set("roleTitle")} />
                </Field>
                <div className={styles.grid}>
                  <Field label="Currency" validationState={show("currency") ? "error" : "none"} validationMessage={show("currency")}>
                    <Input value={form.currency} maxLength={3} onChange={(_, d) => setForm((f) => ({ ...f, currency: d.value.toUpperCase() }))} />
                  </Field>
                  <Field label="Rate unit">
                    <Dropdown
                      value={RATE_UNITS.find((u) => u.value === form.rateUnit)?.label ?? ""}
                      selectedOptions={form.rateUnit ? [form.rateUnit] : []}
                      placeholder="Same as current"
                      onOptionSelect={(_, d) => setForm((f) => ({ ...f, rateUnit: d.optionValue ?? "" }))}
                    >
                      {RATE_UNITS.map((u) => (
                        <Option key={u.value} value={u.value}>
                          {u.label}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <Field label="Pay rate" validationState={show("payRate") ? "error" : "none"} validationMessage={show("payRate")}>
                    <Input inputMode="decimal" value={form.payRate} onChange={set("payRate")} />
                  </Field>
                  <Field label="Bill rate" validationState={show("billRate") ? "error" : "none"} validationMessage={show("billRate")}>
                    <Input inputMode="decimal" value={form.billRate} onChange={set("billRate")} />
                  </Field>
                  <Field label="Burden %" validationState={show("burdenPct") ? "error" : "none"} validationMessage={show("burdenPct")}>
                    <Input inputMode="decimal" value={form.burdenPct} onChange={set("burdenPct")} />
                  </Field>
                </div>
                {p && p.pay_rate == null && (
                  <Text size={200}>Rates you leave empty are copied from the current placement.</Text>
                )}
              </section>
            </>
          ) : (
            <div className={styles.grid}>
              <Field label="New role title">
                <Input value={form.roleTitle} maxLength={300} onChange={set("roleTitle")} />
              </Field>
              {canReadTeams && (
                <IdSelect
                  label="Team (optional)"
                  options={(teams.data?.items ?? []).map((t) => ({ id: t.id, label: t.name }))}
                  value={form.teamId || null}
                  noneLabel="No change"
                  onChange={(v) => setForm((f) => ({ ...f, teamId: v ?? "" }))}
                />
              )}
            </div>
          )}

          <Field label="Note (optional)">
            <Textarea value={form.note} maxLength={2000} resize="vertical" onChange={set("note")} />
          </Field>
        </form>
      </DialogContent>
      <DialogActions>
        <Button disabled={confirm.isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="mobility-transfer"
          appearance="primary"
          disabled={!ctx.can_confirm || confirm.isPending}
          icon={confirm.isPending ? <Spinner size="tiny" /> : undefined}
        >
          Confirm transfer
        </Button>
      </DialogActions>
    </DialogBody>
  );
}
