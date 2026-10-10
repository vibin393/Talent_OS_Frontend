"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  SpinButton,
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
import { ArrowSync20Regular, DataTrending20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { failureLabel, METRIC_LABELS, modelStatus, progressText, progressValue, settingsErrors } from "./logic";
import type { AnalyticsSettings, ModelCard, ModelDetail } from "./types";
import { useAnalyticsSettings, useModelCards, usePredictionPermissions, useSaveAnalyticsSettings, useTrainModel } from "./use-predictions";

const useStyles = makeStyles({
  intro: { marginBottom: tokens.spacingVerticalL },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalXL,
  },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalL },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  settings: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL, maxWidth: "880px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
  tableWrap: { overflowX: "auto" },
  section: { marginTop: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalS },
  list: { margin: 0, paddingLeft: tokens.spacingHorizontalXL },
});

const KINDS = ["time_to_fill", "offer_drop", "attrition"] as const;

/** `/admin/predictions`: model status cards, model card dialog, enable/disable and thresholds (`model:manage`). */
export function PredictionsAdmin() {
  const styles = useStyles();
  const { canManage } = usePredictionPermissions();
  const models = useModelCards(canManage);
  const settings = useAnalyticsSettings(canManage);
  const [edited, setDraft] = useState<AnalyticsSettings | null>(null);
  const draft = edited ?? settings.data ?? null;
  const [open, setOpen] = useState<ModelCard | null>(null);

  if (!canManage) return <NoAccess what="predictive analytics settings" />;

  return (
    <>
      <PageHeader
        title="Predictions"
        subtitle="Time to fill, offer drop and attrition risk, trained only on your organization's own history."
      />
      <MessageBar intent="info" className={styles.intro} layout="multiline">
        <MessageBarBody>
          Predictions are a supporting signal, never a decision. Models use explainable features only: no protected attributes,
          location below city level or free text. A model becomes active only when it beats a simple baseline.
        </MessageBarBody>
      </MessageBar>

      {models.isPending ? (
        <GridSkeleton rows={4} />
      ) : models.isError ? (
        <ErrorBar title="Could not load the models." message={errorMessage(models.error)} />
      ) : (
        <div className={styles.cards}>
          {KINDS.map((kind) => {
            const card = models.data.cards.find((c) => c.kind === kind);
            return card ? (
              <KindCard
                key={kind}
                card={card}
                enabled={draft ? draft.enabled_kinds[kind] : card.enabled}
                onToggle={(on) => draft && setDraft({ ...draft, enabled_kinds: { ...draft.enabled_kinds, [kind]: on } })}
                onOpen={() => setOpen(card)}
              />
            ) : null;
          })}
        </div>
      )}

      {settings.isPending ? (
        <GridSkeleton rows={3} />
      ) : settings.isError ? (
        <ErrorBar title="Could not load the settings." message={errorMessage(settings.error)} />
      ) : (
        draft && <SettingsForm draft={draft} saved={settings.data} onChange={setDraft} />
      )}

      {open && <ModelCardDialog card={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function KindCard({ card, enabled, onToggle, onOpen }: { card: ModelCard; enabled: boolean; onToggle: (on: boolean) => void; onOpen: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const train = useTrainModel();
  const status = modelStatus(card.status);
  const failed = card.latest && card.latest.status === "failed" ? card.latest : null;
  return (
    <Card className={styles.card}>
      <CardHeader
        image={<DataTrending20Regular aria-hidden />}
        header={<Subtitle2 as="h2">{card.kind_label}</Subtitle2>}
        action={
          <Badge appearance="tint" color={status.color}>
            {status.label}
          </Badge>
        }
      />
      <Switch
        checked={enabled}
        onChange={(_, d) => onToggle(d.checked)}
        label={enabled ? "On" : "Off"}
        aria-label={`${card.kind_label} predictions`}
      />
      {card.progress && (card.status === "insufficient_data" || !card.active) && (
        <div>
          <Body1>{progressText(card.progress)}</Body1>
          <ProgressBar value={progressValue(card.progress)} thickness="large" aria-label={progressText(card.progress)} />
        </div>
      )}
      {card.active ? (
        <Caption1>
          Active model v{card.active.version} · trained {formatDateTime(card.active.trained_at)} · {card.active.n_samples} records
        </Caption1>
      ) : (
        <Caption1 className={styles.muted}>No active model.</Caption1>
      )}
      {failed && (
        <Caption1 className={styles.muted}>
          Last run v{failed.version} failed: {failureLabel(failed.failure_code)}. The previous active model is kept.
        </Caption1>
      )}
      <div className={styles.row}>
        <Button onClick={onOpen} disabled={!card.active && card.history.length === 0}>
          Model card
        </Button>
        <Button
          appearance="subtle"
          icon={train.isPending ? <Spinner size="tiny" /> : <ArrowSync20Regular />}
          disabled={train.isPending || !card.enabled || card.status === "training"}
          onClick={async () => {
            try {
              await train.mutateAsync(card.kind);
              toast.success(`${card.kind_label}: retraining queued.`);
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Retrain now
        </Button>
      </div>
    </Card>
  );
}

function numberFrom(value: number | null | undefined, displayValue: string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(displayValue);
  return Number.isFinite(n) ? n : null;
}

function SettingsForm({ draft, saved, onChange }: { draft: AnalyticsSettings; saved: AnalyticsSettings; onChange: (s: AnalyticsSettings) => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const save = useSaveAnalyticsSettings();
  const [serverError, setServerError] = useState<string | null>(null);
  const errors = settingsErrors(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const setThreshold = (kind: "offer_drop" | "attrition", level: "medium" | "high", value: string) =>
    onChange({ ...draft, band_thresholds: { ...draft.band_thresholds, [kind]: { ...draft.band_thresholds[kind], [level]: value } } });

  const submit = async () => {
    setServerError(null);
    try {
      await save.mutateAsync({
        enabled_kinds: draft.enabled_kinds,
        min_samples: draft.min_samples,
        min_minority: draft.min_minority,
        band_thresholds: draft.band_thresholds,
        history_months: draft.history_months,
      });
      toast.success("Prediction settings saved.");
    } catch (e) {
      if (isApiError(e) && e.code === "threshold_below_platform") {
        setServerError(`Minimums cannot go below ${draft.platform_min_samples} records and ${draft.platform_min_minority} in the minority class.`);
      } else setServerError(errorMessage(e));
    }
  };

  return (
    <Card className={styles.settings}>
      <CardHeader
        header={<Subtitle2 as="h2">Settings</Subtitle2>}
        description={<Caption1 className={styles.muted}>Turning a kind off stops training and scoring; existing predictions are hidden.</Caption1>}
      />
      <div className={styles.grid}>
        <Field
          label="Minimum labelled records"
          hint={`At least ${draft.platform_min_samples}. Higher values wait for more data.`}
        >
          <SpinButton
            min={draft.platform_min_samples}
            max={100000}
            step={10}
            value={draft.min_samples}
            onChange={(_, d) => {
              const n = numberFrom(d.value, d.displayValue);
              if (n !== null) onChange({ ...draft, min_samples: Math.max(draft.platform_min_samples, Math.round(n)) });
            }}
          />
        </Field>
        <Field label="Minimum minority-class records" hint={`At least ${draft.platform_min_minority} (e.g. drops or exits).`}>
          <SpinButton
            min={draft.platform_min_minority}
            max={100000}
            step={5}
            value={draft.min_minority}
            onChange={(_, d) => {
              const n = numberFrom(d.value, d.displayValue);
              if (n !== null) onChange({ ...draft, min_minority: Math.max(draft.platform_min_minority, Math.round(n)) });
            }}
          />
        </Field>
        <Field label="History used for training (months)">
          <SpinButton
            min={6}
            max={120}
            value={draft.history_months}
            onChange={(_, d) => {
              const n = numberFrom(d.value, d.displayValue);
              if (n !== null) onChange({ ...draft, history_months: Math.max(6, Math.round(n)) });
            }}
          />
        </Field>
      </div>
      <div className={styles.grid}>
        {(["offer_drop", "attrition"] as const).map((kind) => (
          <fieldset key={kind} className={styles.group}>
            <legend>
              <Text weight="semibold">{kind === "offer_drop" ? "Offer drop risk bands" : "Attrition risk bands"}</Text>
            </legend>
            <Field label="Medium from probability" hint="Between 0 and 1">
              <Input type="number" min={0} max={1} step={0.01} value={draft.band_thresholds[kind].medium} onChange={(_, d) => setThreshold(kind, "medium", d.value)} />
            </Field>
            <Field label="High from probability">
              <Input type="number" min={0} max={1} step={0.01} value={draft.band_thresholds[kind].high} onChange={(_, d) => setThreshold(kind, "high", d.value)} />
            </Field>
          </fieldset>
        ))}
      </div>
      {errors.length > 0 && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>{errors.join(" ")}</MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar title="Could not save." message={serverError} />
      <div className={styles.footer}>
        <Button disabled={!dirty || save.isPending} onClick={() => onChange(saved)}>
          Discard
        </Button>
        <Button appearance="primary" disabled={!dirty || errors.length > 0 || save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
          Save
        </Button>
      </div>
    </Card>
  );
}

function ModelCardDialog({ card, onClose }: { card: ModelCard; onClose: () => void }) {
  const styles = useStyles();
  const m = card.active;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface style={{ maxWidth: 860 }}>
        <DialogBody>
          <DialogTitle>{card.kind_label} – model card</DialogTitle>
          <DialogContent>
            {m ? (
              <>
                <Body1>
                  Active model v{m.version}, trained {formatDateTime(m.trained_at)} on {m.n_samples} records
                  {m.n_minority !== null ? ` (${m.n_minority} in the minority class)` : ""}.
                </Body1>
                {card.reduced ? (
                  <Caption1 className={styles.muted}>Metrics are shown to model administrators only.</Caption1>
                ) : (
                  <ModelMetrics model={m} />
                )}
              </>
            ) : (
              <Body1>No active model yet.</Body1>
            )}

            <Subtitle2 as="h3" className={styles.section} block>
              Excluded by design
            </Subtitle2>
            {card.excluded_features.length === 0 ? (
              <Caption1 className={styles.muted}>—</Caption1>
            ) : (
              <ul className={styles.list}>
                {card.excluded_features.map((f) => (
                  <li key={f}>
                    <Body1>{f}</Body1>
                  </li>
                ))}
              </ul>
            )}

            <Subtitle2 as="h3" className={styles.section} block>
              Training history
            </Subtitle2>
            <div className={styles.tableWrap}>
              <Table size="small" aria-label="Training history">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Version</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Trained</TableHeaderCell>
                    <TableHeaderCell>Records</TableHeaderCell>
                    <TableHeaderCell>Note</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {card.history.map((h) => {
                    const s = modelStatus(h.status);
                    return (
                      <TableRow key={h.id}>
                        <TableCell>v{h.version}</TableCell>
                        <TableCell>
                          <Badge appearance="tint" color={s.color}>
                            {s.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(h.trained_at)}</TableCell>
                        <TableCell>{h.n_samples}</TableCell>
                        <TableCell>{failureLabel(h.failure_code) || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={onClose}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function ModelMetrics({ model }: { model: ModelDetail }) {
  const styles = useStyles();
  const metricKeys = [...new Set([...Object.keys(model.metrics), ...Object.keys(model.baseline)])];
  const calibration = model.calibration
    .map((c) => ({ predicted: Number(c.predicted), observed: Number(c.observed), ideal: Number(c.predicted), n: c.n }))
    .sort((a, b) => a.predicted - b.predicted);
  const features = [...model.features].sort((a, b) => a.rank - b.rank);
  return (
    <>
      <Subtitle2 as="h3" className={styles.section} block>
        Model vs baseline
      </Subtitle2>
      <div className={styles.tableWrap}>
        <Table size="small" aria-label="Metrics compared with the baseline">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Metric</TableHeaderCell>
              <TableHeaderCell>Model</TableHeaderCell>
              <TableHeaderCell>Baseline</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metricKeys.map((k) => (
              <TableRow key={k}>
                <TableCell>{METRIC_LABELS[k] ?? k}</TableCell>
                <TableCell>{model.metrics[k] ?? "—"}</TableCell>
                <TableCell>{model.baseline[k] ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {calibration.length > 0 && (
        <>
          <Subtitle2 as="h3" className={styles.section} block>
            Calibration
          </Subtitle2>
          <Caption1 className={styles.muted}>Predicted probability against the observed rate per bin; the dashed line is perfect calibration.</Caption1>
          <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 480, height: 240 }}>
            <LineChart data={calibration} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} />
              <XAxis type="number" dataKey="predicted" domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} fontSize={12} />
              <YAxis type="number" domain={[0, 1]} width={36} tickFormatter={(v: number) => v.toFixed(1)} fontSize={12} />
              <ChartTooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))} />
              <Legend verticalAlign="bottom" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Line
                dataKey="observed"
                name="Observed"
                stroke={tokens.colorBrandForeground1}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                dataKey="ideal"
                name="Perfect calibration"
                stroke={tokens.colorNeutralStroke1}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {features.length > 0 && (
        <>
          <Subtitle2 as="h3" className={styles.section} block>
            Features
          </Subtitle2>
          <div className={styles.tableWrap}>
            <Table size="small" aria-label="Model features by importance">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Rank</TableHeaderCell>
                  <TableHeaderCell>Feature</TableHeaderCell>
                  <TableHeaderCell>Effect</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((f) => (
                  <TableRow key={f.key}>
                    <TableCell>{f.rank}</TableCell>
                    <TableCell>{f.label}</TableCell>
                    <TableCell>{f.sign === "+" ? "+ increases" : "− decreases"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
