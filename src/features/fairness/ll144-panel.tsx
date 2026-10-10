"use client";

import { Badge, Body1, Caption1, Card, CardHeader, makeStyles, MessageBar, MessageBarBody, Spinner, Subtitle2, Switch, tokens } from "@fluentui/react-components";
import { Gavel20Regular } from "@fluentui/react-icons";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime } from "@/features/admin/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useFairnessPermissions, useLl144, useSetLl144 } from "./use-fairness";

const useStyles = makeStyles({
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL, maxWidth: "720px" },
  muted: { color: tokens.colorNeutralForeground3 },
  dl: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0 },
  },
});

/** Demand tab "NYC LL144": flag the Demand for NYC and see when the 10-business-day notice period ends. */
export function Ll144Panel({ demandId }: { demandId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const { canRead, canConfigure } = useFairnessPermissions();
  const q = useLl144(demandId, canRead || canConfigure);
  const set = useSetLl144(demandId);
  if (q.isPending) return <Spinner size="tiny" label="Loading NYC LL144 status" />;
  if (q.isError) {
    if (isApiError(q.error) && (q.error.status === 403 || q.error.status === 404)) return null;
    return <ErrorBar title="Could not load the NYC LL144 status." message={errorMessage(q.error)} />;
  }
  const flag = q.data;
  return (
    <Card className={styles.card} aria-label="NYC Local Law 144">
      <CardHeader
        image={<Gavel20Regular aria-hidden />}
        header={<Subtitle2 as="h2">NYC Local Law 144</Subtitle2>}
        description={
          <Caption1 className={styles.muted}>
            Flag Demands filled in New York City. Candidates then see the AEDT notice, and automated scores stay hidden until the
            notice period ends.
          </Caption1>
        }
      />
      {!flag.ll144_enabled && (
        <MessageBar intent="info">
          <MessageBarBody>NYC LL144 support is turned off in Fairness settings.</MessageBarBody>
        </MessageBar>
      )}
      <Switch
        label={flag.flagged ? "Flagged for NYC" : "Not flagged"}
        checked={flag.flagged}
        disabled={!canConfigure || !flag.ll144_enabled || set.isPending}
        onChange={(_, d) =>
          set.mutate(d.checked, {
            onSuccess: () => toast.success(d.checked ? "Demand flagged for NYC LL144." : "NYC LL144 flag removed."),
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
      {flag.flagged && (
        <dl className={styles.dl}>
          <dt>Notice published</dt>
          <dd>{formatDateTime(flag.notice_published_at)}</dd>
          <dt>Notice period ends</dt>
          <dd>
            {formatDateTime(flag.notice_period_ends_at)}{" "}
            {flag.in_notice_period ? (
              <Badge appearance="tint" color="warning">
                In notice period – scores hidden
              </Badge>
            ) : (
              <Badge appearance="tint" color="success">
                Notice period over
              </Badge>
            )}
          </dd>
        </dl>
      )}
      {!canConfigure && <Body1 className={styles.muted}>You need the fairness:configure permission to change this flag.</Body1>}
    </Card>
  );
}
