"use client";

import { Badge, type BadgeProps, createTableColumn, type TableColumnDefinition, Tooltip } from "@fluentui/react-components";
import { predictionBadgeView, SUPPORTING_SIGNAL } from "./logic";
import type { PredictionInterval, PredictionSubjectKind } from "./types";
import { usePredictionBatch } from "./use-predictions";

export type PredictionBadgeInput = {
  kind: string;
  status: string;
  band: string | null;
  predicted_days: string | null;
  interval: PredictionInterval | null;
  score?: string | null;
};

/**
 * Band `Badge` (Low = success, Medium = warning, High = danger) or "≈ 34 days (25–48)" for time to fill,
 * always with a "Supporting signal" tooltip. Renders nothing when there is no usable prediction.
 */
export function PredictionBadge({
  prediction,
  size = "medium",
  suffix,
}: {
  prediction: PredictionBadgeInput | null | undefined;
  size?: BadgeProps["size"];
  /** Appended to band labels, e.g. "risk" -> "High risk". */
  suffix?: string;
}) {
  const view = prediction ? predictionBadgeView(prediction) : null;
  if (!view) return null;
  const text = suffix && prediction?.kind !== "time_to_fill" ? `${view.text} ${suffix}` : view.text;
  return (
    <Tooltip content={SUPPORTING_SIGNAL} relationship="description">
      <Badge appearance="tint" color={view.color} size={size} tabIndex={0}>
        {text}
      </Badge>
    </Tooltip>
  );
}

const COLUMN_HEADERS: Record<PredictionSubjectKind, string> = {
  demand: "Time to fill",
  offer: "Drop risk",
  placement: "Prediction",
};

/**
 * Optional prediction badge column for a list page, filled through the batch endpoint. Returns no column
 * (and makes no request) without `prediction:read`. Spread the result at the end of the columns array.
 */
export function usePredictionColumn<T>(
  kind: PredictionSubjectKind,
  items: readonly T[] | undefined,
  getId: (item: T) => string,
): TableColumnDefinition<T>[] {
  const ids = items?.map(getId);
  const batch = usePredictionBatch(kind, ids);
  if (!batch.enabled) return [];
  return [
    createTableColumn<T>({
      columnId: "prediction",
      renderHeaderCell: () => COLUMN_HEADERS[kind],
      renderCell: (item) => {
        const p = batch.map.get(getId(item));
        return p ? <PredictionBadge prediction={p} size="small" suffix={p.kind === "attrition" ? "attrition" : undefined} /> : "—";
      },
    }),
  ];
}
