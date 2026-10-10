"use client";

import { Badge, Body1, Caption1, Card, CardHeader, LargeTitle, makeStyles, Subtitle2, Tooltip, tokens } from "@fluentui/react-components";
import { Open16Regular } from "@fluentui/react-icons";
import { AppLink } from "@/components/app-link";
import { P2TileCard } from "../p2/p2-tile";
import type { P2TileDef, P2TileOut } from "../p2/types";
import type { TileState } from "../tile-card";
import { BIAS_AUDIT_LINK_TEXT, isLinkOnlyTile, linkOnlyHref, p4Badges, usdTile } from "./tile-model";

const useStyles = makeStyles({
  card: { minWidth: 0, height: "100%", boxSizing: "border-box" },
  title: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Phase 4 tile: the P2 shell (charts with "View as table") plus "Estimate", USD cost and the link-only SM-C16 card. */
export function P4TileCard({ def, state, onRetry, span = 1 }: { def: P2TileDef; state: TileState; onRetry?: () => void; span?: number }) {
  const styles = useStyles();
  const raw = state.status === "ok" ? (state.tile as unknown as P2TileOut) : null;
  const badges = p4Badges(def.key, raw);
  const headingId = `p4-tile-${def.key}`;

  if (isLinkOnlyTile(def.key, raw)) {
    if (def.available === false) return null;
    return (
      <Card className={styles.card} style={{ gridColumn: `span ${span}` }} role="region" aria-labelledby={headingId}>
        <CardHeader header={<Subtitle2 as="h2" id={headingId}>{def.title}</Subtitle2>} description={<Caption1 className={styles.muted}>{def.description}</Caption1>} />
        <Body1>Adverse-impact results are shown in the bias audit only.</Body1>
        <AppLink href={linkOnlyHref(raw?.link ?? null)}>
          <Open16Regular aria-hidden /> {BIAS_AUDIT_LINK_TEXT}
        </AppLink>
      </Card>
    );
  }

  if (raw && state.status === "ok") {
    const { tile, headline } = usdTile(raw);
    if (headline && tile.kind === "kpi" && tile.status === "ok") {
      return (
        <Card className={styles.card} style={{ gridColumn: `span ${span}` }} role="region" aria-labelledby={headingId}>
          <CardHeader
            header={
              <div className={styles.title}>
                <Subtitle2 as="h2" id={headingId}>
                  {def.title}
                </Subtitle2>
                {badges.map((b) => (
                  <Tooltip key={b.key} content={b.tooltip} relationship="description" withArrow>
                    <Badge appearance="tint" color={b.color} data-testid={`badge-${b.key}`}>
                      {b.label}
                    </Badge>
                  </Tooltip>
                ))}
              </div>
            }
            description={<Caption1 className={styles.muted}>{def.description}</Caption1>}
          />
          <LargeTitle as="p" style={{ margin: 0 }}>
            {headline}
          </LargeTitle>
        </Card>
      );
    }
    const shown: TileState = { status: "ok", tile: tile as unknown as typeof state.tile };
    return <P2TileCard def={{ ...def, estimate: false }} state={shown} onRetry={onRetry} span={span} extraBadges={badges} />;
  }
  return <P2TileCard def={{ ...def, estimate: false }} state={state} onRetry={onRetry} span={span} extraBadges={badges} />;
}
