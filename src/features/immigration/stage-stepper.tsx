"use client";

import { Button, Caption1, makeStyles, mergeClasses, Text, tokens } from "@fluentui/react-components";
import { CheckmarkCircle16Filled, Circle16Regular, RecordStop16Filled } from "@fluentui/react-icons";
import { groupStages } from "./logic";
import type { StageOut } from "./types";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: tokens.spacingHorizontalM,
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  groupCurrent: { border: `${tokens.strokeWidthThick} solid ${tokens.colorBrandStroke1}` },
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  item: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, minHeight: "32px" },
  done: { color: tokens.colorPaletteGreenForeground1 },
  current: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  todo: { color: tokens.colorNeutralForeground3 },
  muted: { color: tokens.colorNeutralForeground3 },
});

/**
 * The pinned version's stages grouped by category (Preparing / Filed / Pending decision), the current stage
 * highlighted. With `onMove`, each other stage is a button that asks to move the case there.
 */
export function StageStepper({
  stages,
  current,
  onMove,
  disabled,
}: {
  stages: StageOut[];
  current: string | null;
  onMove?: (stage: StageOut) => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const currentIndex = stages.findIndex((s) => s.key === current);
  const groups = groupStages(stages);
  return (
    <nav className={styles.root} aria-label="Case stages">
      {groups.map((g) => {
        const hasCurrent = g.stages.some((s) => s.key === current);
        return (
          <section key={g.category} className={mergeClasses(styles.group, hasCurrent && styles.groupCurrent)} aria-label={g.label}>
            <Text weight="semibold">{g.label}</Text>
            <ol className={styles.list}>
              {g.stages.map((s) => {
                const index = stages.indexOf(s);
                const state = s.key === current ? "current" : currentIndex >= 0 && index < currentIndex ? "done" : "todo";
                const Icon = state === "done" ? CheckmarkCircle16Filled : state === "current" ? RecordStop16Filled : Circle16Regular;
                const label = (
                  <>
                    {s.label}
                    {s.sla_days ? <Caption1 className={styles.muted}> · SLA {s.sla_days} d</Caption1> : null}
                  </>
                );
                return (
                  <li key={s.key} className={mergeClasses(styles.item, styles[state])} aria-current={state === "current" ? "step" : undefined}>
                    <Icon aria-hidden />
                    {onMove && state !== "current" ? (
                      <Button appearance="transparent" size="small" disabled={disabled} onClick={() => onMove(s)} aria-label={`Move to ${s.label}`}>
                        {label}
                      </Button>
                    ) : (
                      <span>
                        {label}
                        {state === "current" && <span className={styles.muted}> (current)</span>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </nav>
  );
}
