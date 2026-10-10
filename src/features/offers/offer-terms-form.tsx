"use client";

import {
  Badge,
  Button,
  Caption1,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Text,
  Textarea,
  tokens, mergeClasses } from "@fluentui/react-components";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import { DateField } from "@/features/interviews/pickers";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useNowMs } from "@/lib/time/use-now";
import { todayInZone } from "@/lib/time/zones";
import { EMPLOYMENT_TYPES, offerErrorMessage, unitSuffix, WORK_MODES } from "./format";
import { MoneyInput } from "./money-input";
import { liveMargin, saveMode, type TermsValues, termsErrors, termsFromVersion, toUpdatePayload } from "./terms";
import type { EmploymentType, OfferDetailOut, WorkMode } from "./types";
import { RateCheckBadge } from "@/features/commercials/rate-cards/rate-check-badge";
import { useUpdateOffer } from "./use-offer-mutations";
import { useOfferTemplates } from "./use-offer-templates";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: tokens.spacingHorizontalM },
  wide: { gridColumn: "1 / -1" },
  margin: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

type Errors = Partial<Record<keyof TermsValues, string>>;

/**
 * Offer terms (validated with zod): title, employment type, pay / bill (live margin with a color badge and a
 * warning below the minimum), bonus, benefits, dates, location, work mode, expiry and template. On an Approved or
 * Released offer, editing an approval-relevant field warns that saving creates a new version needing re-approval.
 */
export function OfferTermsForm({ offer, onSaved }: { offer: OfferDetailOut; onSaved?: (o: OfferDetailOut) => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const { data: me } = useMe();
  const canWrite = usePermission("offer:write");
  const canSeeComp = usePermission("compensation:view");
  const masked = offer.compensation_masked || !canSeeComp;
  const templates = useOfferTemplates();
  const update = useUpdateOffer(offer.id);
  const now = useNowMs();
  const version = offer.current_version;
  const initial = termsFromVersion(version);
  const [values, setValues] = useState<TermsValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const today = todayInZone(me?.tenant.timezone ?? "UTC", now);

  const mode = saveMode(offer.status, initial, values);
  const editable = canWrite && mode !== "locked" && mode !== "terminal";
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const margin = masked ? null : liveMargin(values, Number(version.burden_pct ?? 0), version.min_margin_pct !== null && version.min_margin_pct !== undefined ? Number(version.min_margin_pct) : null);
  const nextVersion = Math.max(...offer.versions.map((v) => v.version_no), version.version_no) + 1;

  const set = <K extends keyof TermsValues>(key: K, v: TermsValues[K]) => {
    setValues((x) => ({ ...x, [key]: v }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    setServerError(null);
    const e = termsErrors(values, { today, masked });
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const saved = await update.mutateAsync(toUpdatePayload(initial, values, offer.lock_version, masked));
      toast.success(
        saved.current_version.version_no !== version.version_no
          ? `Saved as version ${saved.current_version.version_no}${saved.status === "draft" ? " — submit it for approval" : ""}`
          : "Offer saved",
      );
      onSaved?.(saved);
    } catch (err) {
      if (isApiError(err) && err.status === 422) {
        const f = err.details.fields;
        if (Array.isArray(f)) {
          const map: Errors = {};
          for (const item of f as { field?: string; message?: string }[]) {
            const key = (item.field ?? "").split(".").pop() as keyof TermsValues;
            if (key) map[key] = item.message ?? "Invalid value";
          }
          setErrors(map);
        }
        if (err.code === "currency_mismatch") setErrors((x) => ({ ...x, bill_currency: offerErrorMessage(err.code, err.message) }));
        else if (err.code === "expiry_in_past") setErrors((x) => ({ ...x, expiry_date: offerErrorMessage(err.code, err.message) }));
        else setServerError(offerErrorMessage(err.code, errorMessage(err)));
      } else setServerError(isApiError(err) ? offerErrorMessage(err.code, errorMessage(err)) : errorMessage(err));
    }
  };

  const contract = values.employment_type === "contract" || values.employment_type === "contract_to_hire";
  const templateOptions = (templates.data ?? []).filter(
    (t) => !t.archived_at && (t.employment_types.length === 0 || t.employment_types.includes(values.employment_type)),
  );

  return (
    <div className={styles.form}>
      {mode === "locked" && (
        <MessageBar intent="info">
          <MessageBarBody>The offer is waiting for approval, so its terms are locked.</MessageBarBody>
        </MessageBar>
      )}
      {mode === "new_version_reapproval" && dirty && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            Saving creates version {nextVersion} and requires re-approval.
            {offer.status === "released" || offer.status === "viewed" ? " The candidate's link stops working until the new version is approved and released." : ""}
          </MessageBarBody>
        </MessageBar>
      )}
      {mode === "new_version" && dirty && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>
            Saving creates version {nextVersion} without re-approval.
            {offer.status === "released" || offer.status === "viewed" ? " The candidate is emailed the updated offer." : ""}
          </MessageBarBody>
        </MessageBar>
      )}
      {serverError && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{serverError}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.grid}>
        <Field label="Job title" required className={styles.wide} validationState={errors.title ? "error" : "none"} validationMessage={errors.title}>
          <Input value={values.title} disabled={!editable} maxLength={300} onChange={(_, d) => set("title", d.value)} />
        </Field>
        <Field label="Employment type" required>
          <Dropdown
            disabled={!editable}
            value={EMPLOYMENT_TYPES.find((t) => t.value === values.employment_type)?.label ?? ""}
            selectedOptions={[values.employment_type]}
            onOptionSelect={(_, d) => d.optionValue && set("employment_type", d.optionValue as EmploymentType)}
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <Option key={t.value} value={t.value}>
                {t.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Work mode">
          <Dropdown
            disabled={!editable}
            placeholder="Not set"
            value={WORK_MODES.find((m) => m.value === values.work_mode)?.label ?? ""}
            selectedOptions={values.work_mode ? [values.work_mode] : []}
            onOptionSelect={(_, d) => d.optionValue && set("work_mode", d.optionValue as WorkMode)}
          >
            {WORK_MODES.map((m) => (
              <Option key={m.value} value={m.value}>
                {m.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <MoneyInput
          label="Pay rate"
          required
          disabled={!editable}
          amount={values.pay_amount}
          currency={values.pay_currency}
          unit={values.pay_rate_unit}
          onAmount={(v) => set("pay_amount", v)}
          onCurrency={(v) => set("pay_currency", v)}
          onUnit={(v) => set("pay_rate_unit", v)}
          validationMessage={errors.pay_amount ?? errors.pay_currency}
        />
        {masked ? (
          <Field label="Bill rate" hint="You do not have access to bill rates and margin.">
            <Input disabled value="Hidden" />
          </Field>
        ) : (
          <MoneyInput
            label="Bill rate"
            disabled={!editable}
            amount={values.bill_amount}
            currency={values.bill_currency}
            unit={values.bill_rate_unit}
            onAmount={(v) => set("bill_amount", v)}
            onCurrency={(v) => set("bill_currency", v)}
            onUnit={(v) => set("bill_rate_unit", v)}
            validationMessage={errors.bill_amount ?? errors.bill_currency}
          />
        )}
        {!masked && (
          // Epic 16: live check against the client's rate card (the release is gated on it).
          <RateCheckBadge
            input={{
              subject_kind: "offer",
              subject_id: offer.id,
              client_id: offer.client_id,
              role: offer.demand_title ?? values.title,
              location: values.location || null,
              bill_rate: values.bill_amount || null,
              currency: values.bill_currency,
              rate_unit: values.bill_rate_unit,
            }}
          />
        )}
        {!masked && (
          <div className={mergeClasses(styles.margin, styles.wide)} aria-live="polite">
            <Text weight="semibold">Margin</Text>
            {margin ? (
              <>
                <Text>
                  {margin.currency} {margin.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {unitSuffix(margin.unit)}
                </Text>
                <Badge appearance="filled" color={margin.color}>
                  {margin.pct.toFixed(1)}%
                </Badge>
                {margin.belowMin && (
                  <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>
                    Below the {Number(version.min_margin_pct).toFixed(1)}% minimum — the approval chain decides.
                  </Caption1>
                )}
                {Number(version.burden_pct ?? 0) > 0 && <Caption1 className={styles.muted}>Includes {Number(version.burden_pct)}% burden on pay.</Caption1>}
              </>
            ) : (
              <Caption1 className={styles.muted}>Enter pay and bill in the same currency to see the margin.</Caption1>
            )}
          </div>
        )}
        <MoneyInput
          label="Bonus"
          disabled={!editable}
          amount={values.bonus_amount}
          currency={values.bonus_currency}
          onAmount={(v) => set("bonus_amount", v)}
          onCurrency={(v) => set("bonus_currency", v)}
          validationMessage={errors.bonus_amount}
          hint="Optional one-time amount."
        />
        <Field label="Location">
          <Input value={values.location} disabled={!editable} maxLength={300} onChange={(_, d) => set("location", d.value)} />
        </Field>
        <DateField label="Start date" required value={values.start_date} disabled={!editable} onChange={(v) => set("start_date", v)} validationMessage={errors.start_date} />
        <DateField
          label="End date"
          required={contract}
          value={values.end_date}
          disabled={!editable}
          onChange={(v) => set("end_date", v)}
          validationMessage={errors.end_date}
          hint={contract ? undefined : "Optional for permanent roles."}
        />
        <DateField
          label="Offer expires on"
          required
          value={values.expiry_date}
          minDate={today}
          disabled={!editable}
          onChange={(v) => set("expiry_date", v)}
          validationMessage={errors.expiry_date}
          hint="The offer closes at the end of this day (tenant time zone)."
        />
        <Field label="Letter template">
          <Dropdown
            disabled={!editable}
            placeholder="Default for the employment type"
            value={templates.data?.find((t) => t.id === values.template_id)?.name ?? ""}
            selectedOptions={values.template_id ? [values.template_id] : []}
            onOptionSelect={(_, d) => d.optionValue && set("template_id", d.optionValue)}
          >
            {templateOptions.map((t) => (
              <Option key={t.id} value={t.id}>
                {t.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Benefits summary" className={styles.wide}>
          <Textarea value={values.benefits_summary} disabled={!editable} maxLength={5000} resize="vertical" onChange={(_, d) => set("benefits_summary", d.value)} />
        </Field>
      </div>

      {editable && (
        <div className={styles.actions}>
          <Button appearance="primary" disabled={!dirty || update.isPending} icon={update.isPending ? <Spinner size="tiny" /> : undefined} onClick={save}>
            {mode === "edit" ? "Save" : "Save as new version"}
          </Button>
          {dirty && (
            <Button
              appearance="subtle"
              onClick={() => {
                setValues(initial);
                setErrors({});
                setServerError(null);
              }}
            >
              Discard changes
            </Button>
          )}
          <Caption1 className={styles.muted}>Version {version.version_no}</Caption1>
        </div>
      )}
    </div>
  );
}
