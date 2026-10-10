"use client";

import { Caption1, Checkbox, Field, makeStyles, Radio, RadioGroup, Subtitle2, tokens, Tooltip } from "@fluentui/react-components";
import type { EventType } from "./api";
import { groupEventTypes } from "./logic";

const useStyles = makeStyles({
  groups: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, maxHeight: "320px", overflowY: "auto" },
  group: { display: "flex", flexDirection: "column" },
});

/** "Events" picker (Epic 68, B3): all allowed events, or a selection grouped by subject; types not allowed are disabled. */
export function EventTypePicker({
  catalogue,
  allEvents,
  selected,
  onChange,
}: {
  catalogue: EventType[];
  allEvents: boolean;
  selected: string[];
  onChange: (next: { allEvents: boolean; selected: string[] }) => void;
}) {
  const styles = useStyles();
  const toggle = (t: string, on: boolean) =>
    onChange({ allEvents, selected: on ? [...new Set([...selected, t])] : selected.filter((s) => s !== t) });
  return (
    <Field label="Events" required>
      <RadioGroup value={allEvents ? "all" : "selected"} onChange={(_, d) => onChange({ allEvents: d.value === "all", selected })}>
        <Radio value="all" label="All events I'm allowed to receive" />
        <Radio value="selected" label="Selected events" />
      </RadioGroup>
      {!allEvents && (
        <div className={styles.groups}>
          {groupEventTypes(catalogue).map((g) => (
            <div key={g.label} className={styles.group} role="group" aria-label={g.label}>
              <Subtitle2>{g.label}</Subtitle2>
              {g.types.map((t) => {
                const box = (
                  <Checkbox
                    label={t.type}
                    disabled={!t.allowed}
                    checked={selected.includes(t.type)}
                    onChange={(_, d) => toggle(t.type, Boolean(d.checked))}
                  />
                );
                if (t.allowed) return <span key={t.type}>{box}</span>;
                const tip = t.requires.includes("coming_soon") ? "Coming soon" : `Requires ${t.requires.join(" or ") || "access"}`;
                return (
                  <Tooltip key={t.type} content={tip} relationship="description">
                    <span>{box}</span>
                  </Tooltip>
                );
              })}
            </div>
          ))}
          {catalogue.length === 0 && <Caption1>No event types available.</Caption1>}
        </div>
      )}
    </Field>
  );
}
