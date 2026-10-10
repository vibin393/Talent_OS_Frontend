"use client";

import { Caption1, LargeTitle, makeStyles, Text, tokens } from "@fluentui/react-components";
import { AppLink } from "@/components/app-link";
import type { TileOut } from "@/lib/api/types";
import { rowHref, tileHref } from "./links";
import { formatNumber, kpiDetails, kpiItems, kpiText, kpiUnitCaption, sampleNote } from "./tile-format";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  number: { display: "flex", alignItems: "baseline", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  multi: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXXL, rowGap: tokens.spacingVerticalM },
  item: { display: "flex", flexDirection: "column", minWidth: "96px" },
  details: { margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "2px" },
});

function Number_({ text, href, label }: { text: string; href: string | null; label: string }) {
  const value = <LargeTitle as="span">{text}</LargeTitle>;
  if (!href) return value;
  return (
    <AppLink href={href}>
      <span aria-label={`${label}: ${text}. View list`}>{value}</span>
    </AppLink>
  );
}

/** KPI tile: one headline number (unit + sample size + detail lines), or sibling counts each with a link. */
export function KpiTile({ tile }: { tile: TileOut }) {
  const styles = useStyles();
  const multi = kpiItems(tile);
  if (multi) {
    return (
      <div className={styles.multi}>
        {multi.map((item, i) => (
          <div key={item.key} className={styles.item}>
            <Caption1 className={styles.muted}>{item.label}</Caption1>
            <Number_ text={formatNumber(item.value)} href={rowHref(tile.row_links, i, tile.link)} label={item.label} />
          </div>
        ))}
      </div>
    );
  }
  const unit = kpiUnitCaption(tile.unit);
  const note = sampleNote(tile);
  const details = tile.unit ? kpiDetails(tile) : [];
  const empty = tile.value === null || tile.value === undefined;
  return (
    <div className={styles.root}>
      <div className={styles.number}>
        <Number_ text={kpiText(tile.value, tile.unit)} href={tileHref(tile.link)} label={tile.title} />
        {unit && !empty && <Caption1 className={styles.muted}>{unit}</Caption1>}
      </div>
      {empty && <Caption1 className={styles.muted}>Not enough data in this range</Caption1>}
      {note && <Caption1 className={styles.muted}>{note}</Caption1>}
      {details.length > 0 && (
        <ul className={styles.details}>
          {details.map((d) => (
            <li key={d.key}>
              <Text size={200} className={styles.muted}>
                {d.label}: {d.value}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
