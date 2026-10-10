"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Field,
  makeStyles,
  Slider,
  SpinButton,
  Spinner,
  Subtitle2,
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
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import type { MatchingSettingsOut } from "@/lib/api/types";
import { matchingApi, matchingKeys } from "./api";
import { normalizeWeights, SUB_SCORES, WEIGHT_MAX, WEIGHT_MIN, weightErrors } from "./score";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "760px" },
  back: { marginBottom: tokens.spacingVerticalS },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  weights: {
    display: "grid",
    gridTemplateColumns: "160px minmax(0, 1fr) 3ch 5ch",
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXS,
    alignItems: "center",
    "@media (max-width: 599px)": { gridTemplateColumns: "1fr 3ch 5ch" },
  },
  sliderCell: { "@media (max-width: 599px)": { gridColumn: "1 / -1", order: 1 } },
  num: { textAlign: "end", fontVariantNumeric: "tabular-nums" },
  pct: { textAlign: "end", color: tokens.colorNeutralForeground3, fontVariantNumeric: "tabular-nums" },
  error: { gridColumn: "1 / -1", color: tokens.colorPaletteRedForeground1 },
  pair: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacingHorizontalM },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
  muted: { color: tokens.colorNeutralForeground3 },
});

type Form = {
  weights: Record<string, number>;
  strong: number;
  relevant: number;
  explainTopN: number;
  proxyFields: string[];
};

function toForm(s: MatchingSettingsOut): Form {
  return {
    weights: Object.fromEntries(SUB_SCORES.map(({ key }) => [key, s.weights[key] ?? 0])),
    strong: s.strong_threshold,
    relevant: s.relevant_threshold,
    explainTopN: s.explain_top_n,
    proxyFields: [...s.proxy_fields],
  };
}

const pretty = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

function spinValue(v: number | null | undefined, display: string | undefined, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(display);
  return Number.isFinite(n) ? n : fallback;
}

function SettingsForm({ settings }: { settings: MatchingSettingsOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => toForm(settings));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const localErrors = weightErrors(form.weights);
  const errors = { ...serverErrors, ...localErrors };
  if (form.relevant > form.strong) errors.relevant_threshold = "Must not exceed the strong threshold";
  const pct = normalizeWeights(form.weights);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings));

  const save = useMutation({
    mutationFn: () =>
      matchingApi.putSettings({
        weights: form.weights,
        strong_threshold: form.strong,
        relevant_threshold: form.relevant,
        explain_top_n: form.explainTopN,
        proxy_fields: form.proxyFields,
      }),
    onSuccess: (out) => {
      queryClient.setQueryData(matchingKeys.settings, out);
      setServerErrors({});
      setForm(toForm(out));
      toast.success("Matching settings saved. Open demands are re-ranked in the background.");
    },
    onError: (e) => {
      const fe = fieldErrors(e);
      setServerErrors(fe);
      if (Object.keys(fe).length === 0) toast.error(errorMessage(e, "Could not save matching settings."));
    },
  });

  const setWeight = (key: string, value: number) => {
    setServerErrors((e) => ({ ...e, [key]: "", weights: "" }));
    setForm((f) => ({ ...f, weights: { ...f.weights, [key]: value } }));
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const available = settings.available_proxy_fields.filter((f) => !form.proxyFields.includes(f));

  return (
    <form
      className={styles.root}
      onSubmit={(e) => {
        e.preventDefault();
        if (!hasErrors) save.mutate();
      }}
    >
      <Card>
        <CardHeader
          header={<Subtitle2 as="h2">Score weights</Subtitle2>}
          description={
            <Caption1 className={styles.muted}>
              Each weight is 0–{WEIGHT_MAX} (skills at least 15). The overall score is the weighted average of the sub-scores
              that have data; the percentages show each one&apos;s share.
            </Caption1>
          }
        />
        <div className={styles.weights} role="group" aria-label="Weights">
          {SUB_SCORES.map(({ key, label }) => (
            <div key={key} style={{ display: "contents" }}>
              <Text id={`w-${key}`}>{label}</Text>
              <Slider
                className={styles.sliderCell}
                min={WEIGHT_MIN}
                max={WEIGHT_MAX}
                step={1}
                value={form.weights[key]}
                aria-labelledby={`w-${key}`}
                onChange={(_, d) => setWeight(key, d.value)}
              />
              <Text className={styles.num} aria-label={`${label} weight`}>
                {form.weights[key]}
              </Text>
              <Caption1 className={styles.pct} aria-label={`${label} share`}>
                {pct[key]}%
              </Caption1>
              {errors[key] && (
                <Caption1 className={styles.error} role="alert">
                  {label}: {errors[key]}
                </Caption1>
              )}
            </div>
          ))}
          {errors.weights && (
            <Caption1 className={styles.error} role="alert">
              {errors.weights}
            </Caption1>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader header={<Subtitle2 as="h2">Thresholds</Subtitle2>} />
        <div className={styles.pair}>
          <Field
            label="Strong match (≥)"
            validationState={errors.strong_threshold ? "error" : "none"}
            validationMessage={errors.strong_threshold}
          >
            <SpinButton
              min={0}
              max={100}
              value={form.strong}
              onChange={(_, d) => setForm((f) => ({ ...f, strong: spinValue(d.value, d.displayValue, f.strong) }))}
            />
          </Field>
          <Field
            label="Relevant match (≥)"
            validationState={errors.relevant_threshold ? "error" : "none"}
            validationMessage={errors.relevant_threshold}
          >
            <SpinButton
              min={0}
              max={100}
              value={form.relevant}
              onChange={(_, d) => setForm((f) => ({ ...f, relevant: spinValue(d.value, d.displayValue, f.relevant) }))}
            />
          </Field>
          <Field
            label="Explain top matches"
            hint="AI explanations per demand (0 turns them off)"
            validationState={errors.explain_top_n ? "error" : "none"}
            validationMessage={errors.explain_top_n}
          >
            <SpinButton
              min={0}
              max={100}
              value={form.explainTopN}
              onChange={(_, d) => setForm((f) => ({ ...f, explainTopN: spinValue(d.value, d.displayValue, f.explainTopN) }))}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          header={<Subtitle2 as="h2">Proxy fields</Subtitle2>}
          description={
            <Caption1 className={styles.muted}>
              Fields that can stand in for protected attributes (for example graduation year for age) are ignored when scoring.
              Name, age, gender and other protected attributes are never used.
            </Caption1>
          }
        />
        <Field
          label="Excluded from scoring"
          validationState={errors.proxy_fields ? "error" : "none"}
          validationMessage={errors.proxy_fields}
        >
          <TagPicker
            selectedOptions={form.proxyFields}
            onOptionSelect={(_, d) => setForm((f) => ({ ...f, proxyFields: d.selectedOptions }))}
          >
            <TagPickerControl>
              <TagPickerGroup aria-label="Excluded fields">
                {form.proxyFields.map((f) => (
                  <Tag key={f} shape="rounded" value={f}>
                    {pretty(f)}
                  </Tag>
                ))}
              </TagPickerGroup>
              <TagPickerInput aria-label="Add a proxy field" />
            </TagPickerControl>
            <TagPickerList>
              {available.length > 0 ? (
                available.map((f) => (
                  <TagPickerOption key={f} value={f} text={pretty(f)}>
                    {pretty(f)}
                  </TagPickerOption>
                ))
              ) : (
                <Caption1 className={styles.muted} style={{ padding: 8 }}>
                  No more fields
                </Caption1>
              )}
            </TagPickerList>
          </TagPicker>
        </Field>
      </Card>

      <div className={styles.actions}>
        <Button disabled={!dirty || save.isPending} onClick={() => { setForm(toForm(settings)); setServerErrors({}); }}>
          Discard
        </Button>
        <Button
          type="submit"
          appearance="primary"
          disabled={!dirty || hasErrors || save.isPending}
          icon={save.isPending ? <Spinner size="tiny" /> : undefined}
        >
          Save
        </Button>
      </div>
    </form>
  );
}

/** `/admin/settings/matching`: tenant matching weights, thresholds and proxy fields (`matching:configure`). */
export function MatchingSettings() {
  const styles = useStyles();
  const canConfigure = usePermission("matching:configure");
  const settings = useQuery({
    queryKey: matchingKeys.settings,
    queryFn: ({ signal }) => matchingApi.settings(signal),
    enabled: canConfigure,
  });

  return (
    <>
      <div className={styles.back}>
        <AppLink href="/admin/ai">
          <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> AI settings
        </AppLink>
      </div>
      <PageHeader title="Matching weights" subtitle="Tune how each sub-score contributes to the overall match score." />
      {!canConfigure ? (
        <NoAccess what="matching settings" />
      ) : settings.isPending ? (
        <GridSkeleton rows={7} />
      ) : settings.isError ? (
        <ErrorBar title="Could not load matching settings." message={errorMessage(settings.error)} />
      ) : (
        <>
          <Body1 style={{ marginBottom: 12 }}>
            Scores are computed by fixed rules; AI only writes the explanations.
          </Body1>
          <SettingsForm key={JSON.stringify(settings.data)} settings={settings.data} />
        </>
      )}
    </>
  );
}
