"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  makeStyles,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Switch,
  tokens,
} from "@fluentui/react-components";
import { AiBadge } from "@/components/ai/ai-badge";
import { formatOffset } from "./logic";
import type { DraftRating } from "./types";

const useStyles = makeStyles({
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  quote: { margin: 0, paddingLeft: tokens.spacingHorizontalS, borderLeft: `3px solid ${tokens.colorNeutralStroke1}` },
  surface: { maxWidth: "420px", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** "Show AI suggestions" switch above the competencies (default from the tenant setting; off). */
export function SuggestionsToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const styles = useStyles();
  return (
    <div className={styles.row}>
      <Switch checked={checked} onChange={(_, d) => onChange(d.checked)} label="Show AI suggestions" />
      <AiBadge agentName="Interview Assistant" />
      <Caption1 className={styles.muted}>AI-generated — for your review. You rate and submit.</Caption1>
    </div>
  );
}

/** Per competency: "AI suggests {n}", an "Evidence" popover with the transcript quotes and "Use suggestion". */
export function CompetencySuggestion({
  suggestion,
  scale,
  disabled,
  onUse,
}: {
  suggestion: DraftRating;
  scale: number;
  disabled?: boolean;
  onUse: (rating: number) => void;
}) {
  const styles = useStyles();
  return (
    <div className={styles.row}>
      <Badge appearance="tint" color="brand">
        AI suggests {suggestion.suggested_rating}
        <span aria-hidden>/{scale}</span>
      </Badge>
      <Popover withArrow>
        <PopoverTrigger disableButtonEnhancement>
          <Button size="small" appearance="subtle">
            Evidence
          </Button>
        </PopoverTrigger>
        <PopoverSurface aria-label="Evidence">
          <div className={styles.surface}>
            {suggestion.rationale && <Body1>{suggestion.rationale}</Body1>}
            {suggestion.evidence.map((e, i) => (
              <blockquote key={i} className={styles.quote}>
                <Body1>“{e.quote}”</Body1> {e.start_ms !== null && <Caption1 className={styles.muted}>▶ {formatOffset(e.start_ms)}</Caption1>}
              </blockquote>
            ))}
          </div>
        </PopoverSurface>
      </Popover>
      <Button size="small" disabled={disabled} onClick={() => onUse(suggestion.suggested_rating)}>
        Use suggestion
      </Button>
    </div>
  );
}
