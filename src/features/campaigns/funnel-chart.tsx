"use client";

import { Caption1, makeStyles, Text, tokens } from "@fluentui/react-components";
import { formatRate, funnelBars } from "./logic";
import type { FunnelCounts, FunnelRates } from "./types";

const useStyles = makeStyles({
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: {
    display: "grid",
    gridTemplateColumns: "96px 1fr 120px",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    "@media (max-width: 480px)": { gridTemplateColumns: "72px 1fr 88px" },
  },
  track: { height: "20px", backgroundColor: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusSmall, overflow: "hidden" },
  bar: { height: "100%", backgroundColor: tokens.colorBrandBackground, borderRadius: tokens.borderRadiusSmall, minWidth: "2px" },
  value: { fontVariantNumeric: "tabular-nums", textAlign: "end" },
  muted: { color: tokens.colorNeutralForeground3 },
  caption: { display: "block", marginTop: tokens.spacingVerticalS, color: tokens.colorNeutralForeground3 },
});

/** Horizontal-bar funnel (Audience → Hired) with visible labels and values; the list is the accessible form. */
export function FunnelChart({
  counts,
  rates,
  label = "Campaign funnel",
  opensApproximate = true,
}: {
  counts: FunnelCounts;
  rates?: FunnelRates | null;
  label?: string;
  opensApproximate?: boolean;
}) {
  const styles = useStyles();
  const bars = funnelBars(counts, rates);
  return (
    <figure style={{ margin: 0 }}>
      <ul className={styles.list} aria-label={label}>
        {bars.map((b) => (
          <li key={b.key} className={styles.row}>
            <Text size={200}>{b.label}</Text>
            <div className={styles.track} aria-hidden>
              <div className={styles.bar} style={{ width: `${b.pct}%`, display: b.value ? undefined : "none" }} />
            </div>
            <Text size={200} className={styles.value}>
              {b.value.toLocaleString()}
              {b.rate !== null && <span className={styles.muted}> · {formatRate(b.rate)}</span>}
            </Text>
          </li>
        ))}
      </ul>
      {opensApproximate && (
        <figcaption>
          <Caption1 className={styles.caption}>Opens are approximate: some mail apps block or preload images.</Caption1>
        </figcaption>
      )}
    </figure>
  );
}
