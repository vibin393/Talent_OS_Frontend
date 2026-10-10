"use client";

import { Button, Card, CardHeader, makeStyles, Spinner, Subtitle1, Text, tokens } from "@fluentui/react-components";
import { Open16Regular, PinOff16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { reportBuilderApi, reportBuilderKeys } from "./api";
import { NeedsRepairBadge } from "./reports-list-view";
import { ReportChart } from "./report-chart";
import type { PinOut } from "./types";

const useStyles = makeStyles({
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginTop: tokens.spacingVerticalXL },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: tokens.spacingHorizontalL },
  card: { minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
});

function PinnedCard({ pin }: { pin: PinOut }) {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  // A normal viewer-scoped run of the saved report (server cache: 5 minutes per user, report and version).
  const run = useQuery({
    queryKey: reportBuilderKeys.run(pin.report_id, pin.definition_version),
    queryFn: ({ signal }) => reportBuilderApi.run(pin.report_id, { cached: true }, signal),
    enabled: pin.status === "ok",
    staleTime: 5 * 60_000,
    retry: false,
  });
  const unpin = useMutation({ mutationFn: () => reportBuilderApi.unpin(pin.report_id), onSuccess: () => queryClient.invalidateQueries({ queryKey: reportBuilderKeys.all }) });
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Text weight="semibold">{pin.name}</Text>}
        action={
          <span>
            <Button appearance="subtle" size="small" icon={<Open16Regular />} aria-label="Open report" onClick={() => router.push(`/reports/custom/${pin.report_id}`)} />
            <Button appearance="subtle" size="small" icon={<PinOff16Regular />} aria-label="Unpin" onClick={() => unpin.mutate()} />
          </span>
        }
      />
      {pin.status !== "ok" ? (
        <NeedsRepairBadge />
      ) : run.isPending ? (
        <Spinner size="tiny" label="Loading" />
      ) : run.error ? (
        <ErrorBar message={errorMessage(run.error)} />
      ) : run.data ? (
        <ReportChart result={run.data} viz={run.data.viz ?? pin.viz} fields={new Map()} compact />
      ) : null}
    </Card>
  );
}

/** "Pinned reports" section of the dashboard (coordinator decision 12): one card per pin, in the user's order. */
export function PinnedReports() {
  const styles = useStyles();
  const canRead = usePermission("report:read");
  const canBuild = usePermission("report:build");
  const pins = useQuery({ queryKey: reportBuilderKeys.pins(), queryFn: ({ signal }) => reportBuilderApi.pins(signal), enabled: canRead || canBuild });
  if (!(canRead || canBuild) || !pins.data?.length) return null;
  return (
    <section className={styles.section} aria-label="Pinned reports">
      <Subtitle1 as="h2">Pinned reports</Subtitle1>
      <div className={styles.grid}>
        {pins.data.map((p) => (
          <PinnedCard key={p.report_id} pin={p} />
        ))}
      </div>
    </section>
  );
}
