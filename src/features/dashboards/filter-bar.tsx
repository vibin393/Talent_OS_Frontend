"use client";

import {
  Button,
  Caption1,
  Combobox,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Popover,
  PopoverSurface,
  Text,
  Toolbar,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import { DatePicker } from "@fluentui/react-datepicker-compat";
import { ArrowClockwise20Regular, CalendarLtr20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { DATE_PRESETS, type DatePreset, type DateRange, PRESET_LABELS, rangeError } from "./date-range";

const useStyles = makeStyles({
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingInline: 0,
    marginBottom: tokens.spacingVerticalL,
  },
  range: { minWidth: "170px" },
  bu: { minWidth: "220px" },
  muted: { color: tokens.colorNeutralForeground3 },
  grow: { flex: 1 },
  popover: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: "260px" },
  actions: { display: "flex", justifyContent: "flex-end", gap: tokens.spacingHorizontalS },
  error: { color: tokens.colorPaletteRedForeground1 },
});

/** `YYYY-MM-DD` <-> a local `Date` for the date picker. */
export function isoToLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

export function localDateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatRange(range: DateRange): string {
  const f = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return range.from === range.to ? f(range.from) : `${f(range.from)} – ${f(range.to)}`;
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export type BuOption = { id: string; name: string };

/** Dashboard filters: date-range preset (or custom range), business units, refresh, "Updated hh:mm". */
export function FilterBar({
  preset,
  range,
  onRangeChange,
  businessUnits,
  selectedBusinessUnits,
  onBusinessUnitsChange,
  onRefresh,
  refreshing,
  computedAt,
}: {
  preset: DatePreset;
  range: DateRange;
  onRangeChange: (preset: DatePreset, custom?: DateRange) => void;
  /** null hides the business-unit filter (recruiters, users without BU scope). */
  businessUnits: BuOption[] | null;
  selectedBusinessUnits: string[];
  onBusinessUnitsChange: (ids: string[]) => void;
  onRefresh: () => void;
  refreshing: boolean;
  computedAt: string | null;
}) {
  const styles = useStyles();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(range);
  const [draftError, setDraftError] = useState<string | null>(null);

  const openCustom = () => {
    setDraft(range);
    setDraftError(null);
    setCustomOpen(true);
  };
  const applyCustom = () => {
    const error = rangeError(draft);
    if (error) {
      setDraftError(error);
      return;
    }
    setCustomOpen(false);
    onRangeChange("custom", draft);
  };

  const buText = businessUnits
    ? selectedBusinessUnits.map((id) => businessUnits.find((b) => b.id === id)?.name ?? "Unknown").join(", ")
    : "";
  const updated = formatTime(computedAt);

  return (
    <Toolbar aria-label="Dashboard filters" className={styles.toolbar}>
      <div ref={setAnchor}>
        <Dropdown
          aria-label="Date range"
          className={styles.range}
          value={PRESET_LABELS[preset]}
          selectedOptions={[preset]}
          onOptionSelect={(_, d) => {
            const next = d.optionValue as DatePreset | undefined;
            if (!next) return;
            if (next === "custom") openCustom();
            else onRangeChange(next);
          }}
        >
          {DATE_PRESETS.map((p) => (
            <Option key={p} value={p}>
              {PRESET_LABELS[p]}
            </Option>
          ))}
        </Dropdown>
      </div>
      <Button appearance="subtle" icon={<CalendarLtr20Regular />} onClick={openCustom} aria-label={`Date range ${formatRange(range)}. Change`}>
        {formatRange(range)}
      </Button>
      <Popover
        open={customOpen}
        onOpenChange={(_, d) => setCustomOpen(d.open)}
        positioning={{ target: anchor, position: "below", align: "start" }}
        trapFocus
      >
        <PopoverSurface aria-label="Custom date range">
          <div className={styles.popover}>
            <Text weight="semibold">Custom range</Text>
            <Field label="From">
              <DatePicker
                value={isoToLocalDate(draft.from)}
                onSelectDate={(d) => d && setDraft((r) => ({ ...r, from: localDateToIso(d) }))}
                allowTextInput
              />
            </Field>
            <Field label="To">
              <DatePicker
                value={isoToLocalDate(draft.to)}
                onSelectDate={(d) => d && setDraft((r) => ({ ...r, to: localDateToIso(d) }))}
                allowTextInput
              />
            </Field>
            {draftError && (
              <Caption1 className={styles.error} role="alert">
                {draftError}
              </Caption1>
            )}
            <div className={styles.actions}>
              <Button onClick={() => setCustomOpen(false)}>Cancel</Button>
              <Button appearance="primary" onClick={applyCustom}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverSurface>
      </Popover>
      {businessUnits && (
        <Combobox
          aria-label="Business units"
          className={styles.bu}
          multiselect
          placeholder="All business units"
          value={buText}
          selectedOptions={selectedBusinessUnits}
          onOptionSelect={(_, d) => onBusinessUnitsChange(d.selectedOptions)}
        >
          {businessUnits.map((b) => (
            <Option key={b.id} value={b.id}>
              {b.name}
            </Option>
          ))}
        </Combobox>
      )}
      <div className={styles.grow} />
      {updated && <Caption1 className={styles.muted}>Updated {updated}</Caption1>}
      <ToolbarButton icon={<ArrowClockwise20Regular />} onClick={onRefresh} disabled={refreshing}>
        Refresh
      </ToolbarButton>
    </Toolbar>
  );
}
