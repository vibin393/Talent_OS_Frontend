"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { formatDate, formatMoney, STATUS_COLORS, STATUS_LABELS } from "@/features/placements/format";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { workPortalApi, workPortalKeys } from "./api";
import { type BankForm, bankErrors, maskedAccount } from "./validation";

const useStyles = makeStyles({
  links: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: tokens.spacingHorizontalM },
});

/** `/portal/work`: My Work home -- placement cards and "Confirm joining". Mobile-first from 360 px. */
export function WorkHome() {
  const portal = usePortalStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: workPortalKeys.placements, queryFn: ({ signal }) => workPortalApi.placements(signal), retry: false });
  const confirm = useMutation({
    mutationFn: (id: string) => workPortalApi.confirmJoining(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workPortalKeys.placements }),
  });
  if (q.isPending) return <LoadingBlock label="Loading your work" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className={portal.page}>
      <PortalPageHeader title="My work" subtitle="Your placements, profile and payment details." />
      <nav className={styles.links} aria-label="My work">
        <NextLink href="/portal/work/onboarding">Onboarding</NextLink>
        <NextLink href="/portal/work/help">Onboarding help</NextLink>
        <NextLink href="/portal/work/profile">Profile and emergency contact</NextLink>
        <NextLink href="/portal/work/bank">Bank details</NextLink>
        <NextLink href="/portal/work/signatures">Documents to sign</NextLink>
        <NextLink href="/portal/work/timesheets">My timesheets</NextLink>
        <NextLink href="/portal/work/expenses">My expenses</NextLink>
        <NextLink href="/portal/work/leave">My leave</NextLink>
        <NextLink href="/portal/work/bgv">Background verification</NextLink>
        <NextLink href="/portal/work/credentials">My credentials</NextLink>
        <NextLink href="/portal/work/immigration">Immigration</NextLink>
        <NextLink href="/portal/work/bench">Bench</NextLink>
        <NextLink href="/portal/work/referrals">Refer a friend</NextLink>
        <NextLink href="/portal/work/opportunities">Opportunities</NextLink>
      </nav>
      {q.data.length === 0 ? (
        <Card className={portal.card}>
          <Body1 className={portal.empty}>You have no placements yet.</Body1>
        </Card>
      ) : (
        <div className={styles.cards}>
          {q.data.map((p) => (
            <Card key={p.id} className={portal.card}>
              <Text weight="semibold">{p.role_title ?? "Placement"}</Text>
              <Caption1>
                {p.client_name ?? ""} · {p.human_id}
              </Caption1>
              <Badge appearance="tint" color={STATUS_COLORS[p.status]}>
                {STATUS_LABELS[p.status]}
              </Badge>
              <dl className={portal.dl}>
                <dt>Start date</dt>
                <dd>{formatDate(p.actual_start_date ?? p.planned_start_date)}</dd>
                <dt>Location</dt>
                <dd>{p.work_location_text ?? "—"}</dd>
                {p.pay_rate && (
                  <>
                    <dt>Pay</dt>
                    <dd>
                      {formatMoney(p.pay_rate, p.currency)} / {p.rate_unit}
                    </dd>
                  </>
                )}
              </dl>
              {p.can_confirm_joining && (
                <Button
                  appearance="primary"
                  className={mergeClasses(portal.button)}
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(p.id)}
                >
                  Confirm joining
                </Button>
              )}
              {p.joining_confirmed_at && <Caption1>Joining confirmed — see you on day one.</Caption1>}
            </Card>
          ))}
        </div>
      )}
      <InlineError message={confirm.isError ? errorMessage(confirm.error) : null} />
    </div>
  );
}

/** `/portal/work/profile`: emergency contact (contact details live on the candidate profile). */
export function WorkProfile() {
  const portal = usePortalStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: workPortalKeys.profile, queryFn: ({ signal }) => workPortalApi.profile(signal), retry: false });
  const [draft, setDraft] = useState<{ emergency_name: string; emergency_relation: string; emergency_phone: string } | null>(null);
  const save = useMutation({
    mutationFn: () => workPortalApi.updateProfile(draft ?? {}),
    onSuccess: (data) => {
      qc.setQueryData(workPortalKeys.profile, data);
      setDraft(null);
    },
  });
  if (q.isPending) return <LoadingBlock label="Loading your profile" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const value = draft ?? {
    emergency_name: q.data.emergency_name ?? "",
    emergency_relation: q.data.emergency_relation ?? "",
    emergency_phone: q.data.emergency_phone ?? "",
  };
  const set = (k: keyof typeof value, v: string) => setDraft({ ...value, [k]: v });
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Profile" subtitle={q.data.worker_human_id ? `Worker ID ${q.data.worker_human_id}` : undefined} />
      <Card className={portal.card}>
        <dl className={portal.dl}>
          <dt>Name</dt>
          <dd>{q.data.full_name ?? "—"}</dd>
          <dt>Email</dt>
          <dd>{q.data.email ?? "—"}</dd>
          <dt>PAN</dt>
          <dd>{q.data.pan_last4 ? `•••••••${q.data.pan_last4}` : "Not provided"}</dd>
        </dl>
      </Card>
      <Card className={portal.card}>
        <Text weight="semibold">Emergency contact</Text>
        <form
          className={portal.form}
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className={portal.grid2}>
            <Field label="Name">
              <Input className={portal.input} value={value.emergency_name} onChange={(_, d) => set("emergency_name", d.value)} />
            </Field>
            <Field label="Relationship">
              <Input className={portal.input} value={value.emergency_relation} onChange={(_, d) => set("emergency_relation", d.value)} />
            </Field>
            <Field label="Phone">
              <Input className={portal.input} type="tel" value={value.emergency_phone} onChange={(_, d) => set("emergency_phone", d.value)} />
            </Field>
          </div>
          <InlineError message={save.isError ? errorMessage(save.error) : null} />
          <div>
            <Button type="submit" appearance="primary" className={portal.button} disabled={!draft || save.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

const EMPTY_BANK: BankForm = { holder_name: "", account_number: "", account_number_confirm: "", ifsc: "", bank_name: "" };

/** `/portal/work/bank`: masked current account and a change request (account entered twice; HR approval). */
export function WorkBank() {
  const portal = usePortalStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: workPortalKeys.bank, queryFn: ({ signal }) => workPortalApi.bankAccounts(signal), retry: false });
  const [form, setForm] = useState<BankForm>(EMPTY_BANK);
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      workPortalApi.requestBankChange({
        holder_name: form.holder_name.trim(),
        account_number: form.account_number.trim(),
        account_number_confirm: form.account_number_confirm.trim(),
        ifsc: form.ifsc.trim().toUpperCase(),
        bank_name: form.bank_name?.trim() || null,
      }),
    onSuccess: (row) => {
      setDone(row.account_number_last4);
      setForm(EMPTY_BANK);
      setTouched(false);
      void qc.invalidateQueries({ queryKey: workPortalKeys.bank });
    },
  });
  if (q.isPending) return <LoadingBlock label="Loading bank details" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const errors = touched ? { ...bankErrors(form), ...fieldErrors(save.error) } : {};
  const active = q.data.find((b) => b.status === "active");
  const pending = q.data.filter((b) => b.status === "pending_approval");
  const set = (k: keyof BankForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Bank details" subtitle="Where your pay is sent. Changes are checked by HR before they apply." />
      <Card className={portal.card}>
        <dl className={portal.dl}>
          <dt>Current account</dt>
          <dd>{active ? `${maskedAccount(active.account_number_last4)} · ${active.ifsc}` : "None on file"}</dd>
        </dl>
        {pending.map((b) => (
          <Badge key={b.id} appearance="tint" color="warning">
            {maskedAccount(b.account_number_last4)} pending HR approval
          </Badge>
        ))}
      </Card>
      {done && (
        <MessageBar intent="success">
          <MessageBarBody>
            Change received for the account ending {done}. It is pending HR approval; we emailed you a confirmation.
          </MessageBarBody>
        </MessageBar>
      )}
      <Card className={portal.card}>
        <Text weight="semibold">Change bank details</Text>
        <form
          className={portal.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            setDone(null);
            if (Object.keys(bankErrors(form)).length === 0) save.mutate();
          }}
        >
          <Field label="Account holder name" required validationMessage={errors.holder_name}>
            <Input className={portal.input} value={form.holder_name} onChange={(_, d) => set("holder_name", d.value)} autoComplete="name" />
          </Field>
          <div className={portal.grid2}>
            <Field label="Account number" required validationMessage={errors.account_number}>
              <Input className={portal.input} inputMode="numeric" value={form.account_number} onChange={(_, d) => set("account_number", d.value)} autoComplete="off" />
            </Field>
            <Field label="Confirm account number" required validationMessage={errors.account_number_confirm}>
              <Input
                className={portal.input}
                inputMode="numeric"
                value={form.account_number_confirm}
                onChange={(_, d) => set("account_number_confirm", d.value)}
                autoComplete="off"
                onPaste={(e) => e.preventDefault()}
              />
            </Field>
            <Field label="IFSC" required validationMessage={errors.ifsc}>
              <Input className={portal.input} value={form.ifsc} onChange={(_, d) => set("ifsc", d.value.toUpperCase())} maxLength={11} />
            </Field>
            <Field label="Bank name">
              <Input className={portal.input} value={form.bank_name ?? ""} onChange={(_, d) => set("bank_name", d.value)} />
            </Field>
          </div>
          <InlineError message={save.isError && !Object.keys(fieldErrors(save.error)).length ? errorMessage(save.error) : null} />
          <div>
            <Button type="submit" appearance="primary" className={portal.button} disabled={save.isPending}>
              Submit for HR approval
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
