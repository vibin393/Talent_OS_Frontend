"use client";

import {
  Badge,
  Button,
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
  mergeClasses,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowSync20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { formatMoney } from "@/features/commercials/format";
import { errorMessage } from "@/lib/api/errors";
import { projectsApi } from "./api";
import { BUDGET_DIMENSION_LABELS, BUDGET_DIMENSIONS, burnScale } from "./logic";
import type { BudgetDimension, BudgetOut, BurnOut } from "./types";

const useStyles = makeStyles({
  grid: { display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" },
  card: { padding: tokens.spacingHorizontalL },
  row: { display: "flex", justifyContent: "space-between", gap: tokens.spacingHorizontalM, fontVariantNumeric: "tabular-nums" },
  muted: { color: tokens.colorNeutralForeground3 },
  track: {
    position: "relative",
    height: "10px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground5,
    marginTop: tokens.spacingVerticalL,
    marginBottom: tokens.spacingVerticalL,
  },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: tokens.borderRadiusMedium, backgroundColor: tokens.colorBrandBackground },
  warn: { backgroundColor: tokens.colorStatusWarningBackground3 },
  danger: { backgroundColor: tokens.colorStatusDangerBackground3 },
  tick: { position: "absolute", top: "-6px", bottom: "-6px", width: "2px", backgroundColor: tokens.colorNeutralForeground3 },
  tickLabel: { position: "absolute", top: "-22px", transform: "translateX(-50%)", fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3 },
  forecast: { position: "absolute", top: "-4px", bottom: "-4px", width: "0", borderLeft: `2px dashed ${tokens.colorPaletteBerryForeground1}` },
});

function fmt(dim: BudgetDimension, v: string | null | undefined, currency: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  if (dim === "hours") return `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })} h`;
  return formatMoney(v, currency ?? "INR");
}

/** One dimension: actual vs budget bar with 80 % / 100 % markers and the forecast-at-completion marker. */
function DimensionCard({ dim, burn, budget, currency }: { dim: BudgetDimension; burn?: BurnOut; budget?: BudgetOut; currency: string }) {
  const s = useStyles();
  const budgetAmount = burn?.budget ?? budget?.amount ?? null;
  const cur = burn?.currency ?? budget?.currency ?? currency;
  const scale = burnScale(burn?.actual ?? "0", budgetAmount, burn?.forecast_at_completion ?? null);
  const pct = Number(burn?.pct ?? 0);
  return (
    <Card className={s.card}>
      <CardHeader
        header={<Subtitle2 as="h3">{BUDGET_DIMENSION_LABELS[dim]}</Subtitle2>}
        action={
          burn?.pct != null ? (
            <Badge appearance="tint" color={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "success"}>
              {Math.round(pct)}%
            </Badge>
          ) : undefined
        }
      />
      {scale ? (
        <div className={s.track} role="img" aria-label={`${BUDGET_DIMENSION_LABELS[dim]}: ${Math.round(pct)}% of budget used`}>
          <div className={mergeClasses(s.fill, pct >= 100 ? s.danger : pct >= 80 ? s.warn : undefined)} style={{ width: `${scale.actual * 100}%` }} />
          {scale.mark80 !== null && (
            <>
              <div className={s.tick} style={{ left: `${scale.mark80 * 100}%` }} />
              <span className={s.tickLabel} style={{ left: `${scale.mark80 * 100}%` }}>
                80%
              </span>
            </>
          )}
          {scale.mark100 !== null && (
            <>
              <div className={s.tick} style={{ left: `${scale.mark100 * 100}%` }} />
              <span className={s.tickLabel} style={{ left: `${scale.mark100 * 100}%` }}>
                100%
              </span>
            </>
          )}
          {scale.forecast !== null && <div className={s.forecast} style={{ left: `${scale.forecast * 100}%` }} title="Forecast at completion" />}
        </div>
      ) : (
        <Text className={s.muted}>No budget or burn yet.</Text>
      )}
      <div className={s.row}>
        <Text className={s.muted}>Actual</Text>
        <Text>{fmt(dim, burn?.actual, cur)}</Text>
      </div>
      <div className={s.row}>
        <Text className={s.muted}>Budget</Text>
        <Text>{fmt(dim, budgetAmount, cur)}</Text>
      </div>
      <div className={s.row}>
        <Text className={s.muted}>Forecast at completion</Text>
        <Text>{fmt(dim, burn?.forecast_at_completion, cur)}</Text>
      </div>
      {burn?.burn_rate_per_day && (
        <div className={s.row}>
          <Text className={s.muted}>Burn rate / day</Text>
          <Text>{fmt(dim, burn.burn_rate_per_day, cur)}</Text>
        </div>
      )}
    </Card>
  );
}

/** Budget & burn: the three dimensions, a budget editor and a burn rebuild. */
export function BudgetCard({
  projectId,
  currency,
  budgets,
  burn,
  canWrite,
  onChanged,
}: {
  projectId: string;
  currency: string;
  budgets: BudgetOut[];
  burn: BurnOut[];
  canWrite: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const s = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const [editing, setEditing] = useState(false);
  const rebuild = useMutation({
    mutationFn: () => projectsApi.rebuildBurn(projectId),
    onSuccess: async () => {
      toast.success("Burn recalculated");
      await onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const asOf = burn.find((b) => b.as_of)?.as_of;
  return (
    <>
      <div className={admin.toolbar}>
        <Text className={admin.muted}>{asOf ? `As of ${formatDateTime(asOf)}` : "Burn not computed yet"}</Text>
        <span className={admin.grow} />
        {canWrite && (
          <>
            <Button icon={<ArrowSync20Regular />} disabled={rebuild.isPending} onClick={() => rebuild.mutate()}>
              Recalculate
            </Button>
            <Button appearance="primary" icon={<Edit20Regular />} onClick={() => setEditing(true)}>
              Edit budget
            </Button>
          </>
        )}
      </div>
      <div className={s.grid}>
        {BUDGET_DIMENSIONS.map((dim) => (
          <DimensionCard
            key={dim}
            dim={dim}
            burn={burn.find((b) => b.dimension === dim)}
            budget={budgets.find((b) => b.dimension === dim)}
            currency={currency}
          />
        ))}
      </div>
      {editing && <BudgetDialog projectId={projectId} currency={currency} budgets={budgets} onClose={() => setEditing(false)} onSaved={onChanged} />}
    </>
  );
}

function BudgetDialog({
  projectId,
  currency,
  budgets,
  onClose,
  onSaved,
}: {
  projectId: string;
  currency: string;
  budgets: BudgetOut[];
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const admin = useAdminStyles();
  const [values, setValues] = useState<Record<BudgetDimension, string>>(() => ({
    hours: budgets.find((b) => b.dimension === "hours")?.amount ?? "",
    cost: budgets.find((b) => b.dimension === "cost")?.amount ?? "",
    revenue: budgets.find((b) => b.dimension === "revenue")?.amount ?? "",
  }));
  const save = useMutation({
    mutationFn: () =>
      projectsApi.putBudgets(
        projectId,
        BUDGET_DIMENSIONS.filter((d) => values[d].trim() !== "").map((d) => ({ dimension: d, amount: values[d].trim() })),
      ),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const invalid = BUDGET_DIMENSIONS.some((d) => values[d].trim() !== "" && !(Number(values[d]) >= 0));
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Edit budget</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <ErrorBar message={save.error ? errorMessage(save.error) : null} />
              {BUDGET_DIMENSIONS.map((d) => (
                <Field key={d} label={BUDGET_DIMENSION_LABELS[d]}>
                  <Input
                    value={values[d]}
                    inputMode="decimal"
                    contentAfter={d === "hours" ? "h" : currency}
                    onChange={(_, v) => setValues((x) => ({ ...x, [d]: v.value }))}
                  />
                </Field>
              ))}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={invalid || save.isPending} onClick={() => save.mutate()}>
              Save budget
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
