"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Field,
  InteractionTag,
  InteractionTagPrimary,
  InteractionTagSecondary,
  Input,
  makeStyles,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  SpinButton,
  Switch,
  TagGroup,
  Textarea,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Sparkle16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { type Chip, type ChipKey, chipsFromState, listFromText, removeChip } from "./chips";
import { NumberPair } from "./facet-panel";
import type { SearchFilters, SearchState } from "./url-state";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, marginBottom: tokens.spacingVerticalM },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  editor: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minWidth: "260px" },
  actions: { display: "flex", justifyContent: "flex-end", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Popover editor for one chip; returns the updated state (edits re-run in structured mode). */
function ChipEditor({ chip, state, onApply, onClose }: { chip: Chip; state: SearchState; onApply: (s: SearchState) => void; onClose: () => void }) {
  const styles = useStyles();
  const [draft, setDraft] = useState<SearchState>(state);
  const f = draft.filters;
  const setFilters = (patch: Partial<SearchFilters>) =>
    setDraft((d) => ({ ...d, filters: { ...d.filters, ...patch } }));
  const setText = (field: "countries" | "cities" | "workAuth" | "certifications" | "employers") => ({
    value: f[field].join(", "),
    onChange: (_: unknown, d: { value: string }) => setFilters({ [field]: listFromText(d.value) }),
  });

  let body: React.ReactNode;
  switch (chip.key as ChipKey) {
    case "keywords":
      body = (
        <Field label="Keywords (Boolean)">
          <Input
            value={draft.q}
            onChange={(_, d) => setDraft((x) => ({ ...x, q: d.value }))}
            style={{ fontFamily: tokens.fontFamilyMonospace }}
          />
        </Field>
      );
      break;
    case "semantic":
      body = (
        <Field label="Similar to">
          <Textarea
            resize="vertical"
            value={draft.sem}
            maxLength={300}
            onChange={(_, d) => setDraft((x) => ({ ...x, sem: d.value }))}
          />
        </Field>
      );
      break;
    case "skills":
      body = (
        <>
          <Body1>{chip.value}</Body1>
          <Switch
            label="Match all skills"
            checked={f.skillsMode === "all"}
            onChange={(_, d) => setFilters({ skillsMode: d.checked ? "all" : "any" })}
          />
          <Caption1 className={styles.muted}>Add or remove skills in the Skills filter.</Caption1>
        </>
      );
      break;
    case "experience":
      body = (
        <NumberPair
          label="Years"
          min={f.expMin}
          max={f.expMax}
          upper={60}
          onChange={(expMin, expMax) => setFilters({ expMin, expMax })}
        />
      );
      break;
    case "compensation":
      body = (
        <NumberPair
          label={`Amount (${f.compCurrency})`}
          min={f.compMin}
          max={f.compMax}
          step={100000}
          onChange={(compMin, compMax) => setFilters({ compMin, compMax })}
        />
      );
      break;
    case "notice":
      body = (
        <Field label="Max notice (days)">
          <SpinButton
            min={0}
            max={365}
            value={f.noticeMaxDays}
            onChange={(_, d) => {
              const v = d.value ?? (d.displayValue ? Number(d.displayValue) : null);
              setFilters({ noticeMaxDays: v !== null && Number.isFinite(v) ? v : null });
            }}
          />
        </Field>
      );
      break;
    case "availableBy":
      body = (
        <Field label="Available by">
          <Input type="date" value={f.availableBy ?? ""} onChange={(_, d) => setFilters({ availableBy: d.value || null })} />
        </Field>
      );
      break;
    case "countries":
    case "cities":
    case "workAuth":
    case "certifications":
    case "employers": {
      const field = chip.key as "countries" | "cities" | "workAuth" | "certifications" | "employers";
      body = (
        <Field label={chip.label} hint="Separate values with commas">
          <Input {...setText(field)} />
        </Field>
      );
      break;
    }
    default:
      body = (
        <>
          <Body1>{chip.value}</Body1>
          <Caption1 className={styles.muted}>Change this in the filter panel, or remove it.</Caption1>
        </>
      );
  }

  return (
    <div className={styles.editor}>
      {body}
      <div className={styles.actions}>
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="small"
          appearance="primary"
          onClick={() => {
            onApply({ ...draft, page: 1 });
            onClose();
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

function EditableChip({ chip, state, onApply }: { chip: Chip; state: SearchState; onApply: (s: SearchState) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <InteractionTag value={chip.key} size="small" appearance="brand">
      <Popover open={open} onOpenChange={(_, d) => setOpen(d.open)} positioning="below-start" withArrow trapFocus>
        <PopoverTrigger disableButtonEnhancement>
          <InteractionTagPrimary hasSecondaryAction aria-label={`${chip.label}: ${chip.value}. Edit`}>
            <strong>{chip.label}:</strong> {chip.value}
          </InteractionTagPrimary>
        </PopoverTrigger>
        <PopoverSurface aria-label={`Edit ${chip.label}`}>
          {open && <ChipEditor chip={chip} state={state} onApply={onApply} onClose={() => setOpen(false)} />}
        </PopoverSurface>
      </Popover>
      <InteractionTagSecondary aria-label={`Remove ${chip.label}`} />
    </InteractionTag>
  );
}

/** "Interpreted as" + AI badge + one editable, dismissible chip per interpreted filter. */
export function InterpretationBar({
  state,
  canViewComp,
  onChange,
}: {
  state: SearchState;
  canViewComp: boolean;
  onChange: (s: SearchState) => void;
}) {
  const styles = useStyles();
  const chips = chipsFromState(state, { canViewComp });
  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <Caption1>Interpreted as</Caption1>
        <Tooltip content="AI-interpreted; edit any filter" relationship="description">
          <Badge appearance="tint" color="brand" size="small" icon={<Sparkle16Regular />} tabIndex={0}>
            AI
          </Badge>
        </Tooltip>
      </div>
      {chips.length === 0 ? (
        <Caption1 className={styles.muted}>No filters were recognized; showing the closest matches.</Caption1>
      ) : (
        <TagGroup
          aria-label="Interpreted filters"
          onDismiss={(_, d) => onChange(removeChip(state, d.value as ChipKey))}
          style={{ flexWrap: "wrap", gap: 6 }}
        >
          {chips.map((chip) => (
            <EditableChip key={chip.key} chip={chip} state={state} onApply={onChange} />
          ))}
        </TagGroup>
      )}
    </div>
  );
}
