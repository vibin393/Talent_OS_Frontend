"use client";

import {
  Badge,
  Button,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { PeopleSearch20Regular } from "@fluentui/react-icons";
import { CHANNEL_LABELS } from "@/features/campaigns/logic";
import type { Channel } from "@/features/campaigns/types";
import { ErrorBar } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { suppressedRows } from "./logic";
import type { AudiencePreviewOut } from "./types";

const CHANNELS: Channel[] = ["email", "sms", "whatsapp"];

const useStyles = makeStyles({
  card: { maxWidth: "720px" },
  total: { fontSize: tokens.fontSizeHero700, lineHeight: tokens.lineHeightHero700, fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: "tabular-nums" },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginBlock: tokens.spacingVerticalS },
  num: { fontVariantNumeric: "tabular-nums", textAlign: "end" },
  muted: { color: tokens.colorNeutralForeground3 },
  scroll: { overflowX: "auto" },
});

/** Suppressed-by-reason table (one row per reason, a column per channel). */
export function SuppressedTable({ preview }: { preview: Pick<AudiencePreviewOut, "suppressed"> }) {
  const styles = useStyles();
  const rows = suppressedRows(preview);
  if (rows.length === 0) return <Text className={styles.muted}>No one is suppressed.</Text>;
  return (
    <div className={styles.scroll}>
      <Table size="small" aria-label="Suppressed by reason">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Reason</TableHeaderCell>
            {CHANNELS.map((c) => (
              <TableHeaderCell key={c}>{CHANNEL_LABELS[c]}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.reason}>
              <TableCell>{r.label}</TableCell>
              {CHANNELS.map((c) => (
                <TableCell key={c} className={styles.num}>
                  {r[c].toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Reach summary: total, reachable per channel and the suppressed table. */
export function ReachSummary({ preview }: { preview: AudiencePreviewOut }) {
  const styles = useStyles();
  return (
    <div>
      <Text as="p" className={styles.total} aria-label={`${preview.total} people in this audience`}>
        {preview.total.toLocaleString()}
      </Text>
      <Caption1 className={styles.muted}>people in this audience</Caption1>
      <div className={styles.badges}>
        {CHANNELS.map((c) => (
          <Badge key={c} appearance="tint" color="brand" size="large">
            {CHANNEL_LABELS[c]}: {(preview.reachable[c] ?? 0).toLocaleString()} reachable
          </Badge>
        ))}
      </div>
      <SuppressedTable preview={preview} />
      <Caption1 className={styles.muted}>Computed in {(preview.elapsed_ms / 1000).toFixed(1)} s. Consent is checked again at send time.</Caption1>
    </div>
  );
}

/** "Preview reach" card with a run button, Spinner while loading, and the summary. */
export function ReachPreviewCard({
  preview,
  loading,
  error,
  onRun,
  disabled,
}: {
  preview: AudiencePreviewOut | null | undefined;
  loading: boolean;
  error?: unknown;
  onRun?: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Card className={styles.card}>
      <CardHeader
        image={<PeopleSearch20Regular aria-hidden />}
        header={<Subtitle2 as="h2">Preview reach</Subtitle2>}
        action={
          onRun && (
            <Button onClick={onRun} disabled={loading || disabled}>
              {preview ? "Refresh" : "Preview reach"}
            </Button>
          )
        }
      />
      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <Spinner size="small" label="Counting reachable people..." />
        ) : error ? (
          <ErrorBar title="Could not preview this audience." message={errorMessage(error)} />
        ) : preview ? (
          <ReachSummary preview={preview} />
        ) : (
          <Text className={styles.muted}>Preview to see who can be reached on each channel.</Text>
        )}
      </div>
    </Card>
  );
}
