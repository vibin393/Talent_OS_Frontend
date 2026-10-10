"use client";

import { Body1, Dropdown, Field, Input, MessageBar, MessageBarBody, Option, Radio, RadioGroup, Spinner, Text, Textarea } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatMoney } from "@/features/placements/format";
import { newIdempotencyKey } from "@/features/timesheets/format";
import { useDebounced } from "@/lib/use-debounced";
import { exitApi, exitKeys } from "./api";
import { SimpleDialog, useExtensionMutation } from "./extension-dialogs";
import { CASE_REASON_LABELS, isDecimalOrEmpty, shortfallPreview, shortfallText, todayIso } from "./logic";
import type { CaseReason, OffboardingCaseDetail } from "./types";

/** Contract-to-hire conversion: date, offered compensation, debounced fee preview. */
export function ConversionDialog({ placementId, currency, onClose }: { placementId: string; currency: string; onClose: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(todayIso());
  const [comp, setComp] = useState("");
  const [note, setNote] = useState("");
  const keyRef = useRef(newIdempotencyKey());
  const compOk = comp.trim() !== "" && isDecimalOrEmpty(comp);
  const debouncedComp = useDebounced(comp.trim(), 400);
  const fee = useQuery({
    queryKey: [...exitKeys.conversion(placementId), "fee", debouncedComp, date],
    queryFn: ({ signal }) => exitApi.feePreview(placementId, { offered_compensation: debouncedComp, conversion_date: date || null }, signal),
    enabled: debouncedComp !== "" && isDecimalOrEmpty(debouncedComp),
    retry: false,
  });
  const { m, error } = useExtensionMutation(
    () =>
      exitApi
        .convert(placementId, { conversion_date: date, offered_compensation: comp.trim(), currency, note: note.trim() || null }, keyRef.current)
        .then((c) => {
          if (c.offboarding_case_id) router.push(`/offboarding/${c.offboarding_case_id}`);
          return c;
        }),
    "Conversion recorded",
    onClose,
  );
  return (
    <SimpleDialog
      title="Record conversion (contract to hire)"
      primary="Record conversion"
      disabled={!date || !compOk}
      busy={m.isPending}
      error={error}
      onPrimary={() => m.mutate(undefined)}
      onClose={onClose}
    >
      <MessageBar intent="info">
        <MessageBarBody>Creates an offboarding case; no bench entry.</MessageBarBody>
      </MessageBar>
      <Field label="Conversion date" required>
        <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
      </Field>
      <Field
        label={`Offered annual compensation (${currency})`}
        required
        validationMessage={comp && !isDecimalOrEmpty(comp) ? "Enter a positive amount." : undefined}
      >
        <Input inputMode="decimal" value={comp} onChange={(_, d) => setComp(d.value)} />
      </Field>
      <Text>
        Conversion fee:{" "}
        {fee.isFetching ? (
          <Spinner size="tiny" />
        ) : fee.isError ? (
          "Unavailable"
        ) : fee.data ? (
          fee.data.fee_proposal === null ? (
            "No fee under the contract"
          ) : (
            <strong>{formatMoney(fee.data.fee_proposal, fee.data.currency)}</strong>
          )
        ) : (
          "—"
        )}
      </Text>
      <Field label="Note">
        <Textarea value={note} onChange={(_, d) => setNote(d.value)} resize="vertical" />
      </Field>
    </SimpleDialog>
  );
}

const START_REASONS: CaseReason[] = ["end_of_term", "client_termination", "worker_resignation", "misconduct", "other"];

/** Start an offboarding case (end of term or other reason). */
export function StartOffboardingDialog({
  placementId,
  defaultLwd,
  onClose,
}: {
  placementId: string;
  defaultLwd: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<CaseReason>("end_of_term");
  const [lwd, setLwd] = useState(defaultLwd ?? "");
  const [noticeDate, setNoticeDate] = useState("");
  const [note, setNote] = useState("");
  const { m, error } = useExtensionMutation(
    () =>
      exitApi
        .startOffboarding(placementId, {
          reason,
          last_working_day: lwd,
          notice_date: noticeDate || null,
          reason_note: note.trim() || null,
        })
        .then((c: OffboardingCaseDetail) => {
          router.push(`/offboarding/${c.id}`);
          return c;
        }),
    "Offboarding started",
    onClose,
  );
  return (
    <SimpleDialog
      title="Start offboarding"
      primary="Start"
      disabled={!lwd}
      busy={m.isPending}
      error={error}
      onPrimary={() => m.mutate(undefined)}
      onClose={onClose}
    >
      <Field label="Reason" required>
        <Dropdown
          value={CASE_REASON_LABELS[reason]}
          selectedOptions={[reason]}
          onOptionSelect={(_, d) => setReason((d.optionValue as CaseReason) ?? "end_of_term")}
        >
          {START_REASONS.map((r) => (
            <Option key={r} value={r}>
              {CASE_REASON_LABELS[r]}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Last working day" required>
        <Input type="date" value={lwd} onChange={(_, d) => setLwd(d.value)} />
      </Field>
      <Field label="Notice date">
        <Input type="date" value={noticeDate} onChange={(_, d) => setNoticeDate(d.value)} />
      </Field>
      <Field label="Note">
        <Textarea value={note} onChange={(_, d) => setNote(d.value)} resize="vertical" />
      </Field>
    </SimpleDialog>
  );
}

/** Early termination by the client or the worker, with a live notice-shortfall preview. */
export function EarlyTerminationDialog({
  placementId,
  noticePeriodDays,
  onClose,
}: {
  placementId: string;
  noticePeriodDays: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [by, setBy] = useState<"client" | "worker">("client");
  const [noticeDate, setNoticeDate] = useState(todayIso());
  const [lwd, setLwd] = useState("");
  const [reason, setReason] = useState("");
  const preview = shortfallPreview(noticeDate, lwd, noticePeriodDays);
  const shortfall = preview?.kind === "known" ? preview.shortfall : 0;
  const { m, error } = useExtensionMutation(
    () =>
      exitApi
        .earlyTermination(placementId, { initiated_by: by, notice_date: noticeDate, requested_lwd: lwd, reason: reason.trim() || null })
        .then((c) => {
          router.push(`/offboarding/${c.id}`);
          return c;
        }),
    "Early termination recorded",
    onClose,
  );
  return (
    <SimpleDialog
      title="Early termination"
      primary="Start offboarding"
      disabled={!noticeDate || !lwd || preview?.kind === "invalid"}
      busy={m.isPending}
      error={error}
      onPrimary={() => m.mutate(undefined)}
      onClose={onClose}
    >
      <RadioGroup value={by} onChange={(_, d) => setBy(d.value as "client" | "worker")} layout="horizontal">
        <Radio value="client" label="Client ends the assignment" />
        <Radio value="worker" label="Worker resigns" />
      </RadioGroup>
      <Field label="Notice date" required>
        <Input type="date" value={noticeDate} onChange={(_, d) => setNoticeDate(d.value)} />
      </Field>
      <Field label="Requested last working day" required>
        <Input type="date" value={lwd} onChange={(_, d) => setLwd(d.value)} />
      </Field>
      <MessageBar intent={preview?.kind === "invalid" ? "error" : shortfall > 0 ? "warning" : "info"} aria-live="polite">
        <MessageBarBody>{shortfallText(preview)}</MessageBarBody>
      </MessageBar>
      <Field label="Reason">
        <Textarea value={reason} onChange={(_, d) => setReason(d.value)} resize="vertical" />
      </Field>
      <Body1>The placement end date moves to the last working day and the offboarding checklist starts.</Body1>
    </SimpleDialog>
  );
}
