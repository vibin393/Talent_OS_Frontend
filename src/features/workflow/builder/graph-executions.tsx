"use client";

import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Badge, Body1, makeStyles, Text, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { graphApi } from "./api";
import { NODE_LABELS } from "./graph-model";
import type { NodeType } from "./types";

const useStyles = makeStyles({
  trace: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  item: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "baseline", flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "informative" | "subtle"> = {
  succeeded: "success",
  waiting: "informative",
  partially_failed: "warning",
  failed: "danger",
  cancelled: "subtle",
  not_matched: "subtle",
};

/** Executions tab of a graph rule: `waiting` badge and the node-trace timeline (Epic 32 B1). */
export function GraphExecutions({ ruleId }: { ruleId: string }) {
  const styles = useStyles();
  const runs = useQuery({ queryKey: ["workflow", "rules", "detail", ruleId, "graph-executions"], queryFn: ({ signal }) => graphApi.executions(ruleId, signal) });
  if (runs.isPending) return <GridSkeleton rows={4} />;
  if (runs.isError) return <ErrorBar title="Could not load the runs." message={errorMessage(runs.error)} />;
  if (runs.data.items.length === 0) return <Body1 className={styles.muted}>No runs yet.</Body1>;
  return (
    <Accordion collapsible multiple>
      {runs.data.items.map((e) => (
        <AccordionItem key={e.id} value={e.id}>
          <AccordionHeader>
            <span className={styles.item}>
              <Badge appearance={e.status === "waiting" ? "filled" : "tint"} color={STATUS_COLOR[e.status] ?? "subtle"}>
                {e.status.replace(/_/g, " ")}
              </Badge>
              <Text>{formatDateTime(e.created_at)}</Text>
              <Text className={styles.muted}>
                {e.entity_type} · version {e.rule_version}
              </Text>
            </span>
          </AccordionHeader>
          <AccordionPanel>
            {(e.node_trace ?? []).length === 0 ? (
              <Body1 className={styles.muted}>This run used the Phase 1 engine (see Conditions and Actions in the simple editor).</Body1>
            ) : (
              <ol className={styles.trace} aria-label="Steps of this run">
                {(e.node_trace ?? []).map((t, i) => (
                  <li key={i} className={styles.item}>
                    <Text weight="semibold">{NODE_LABELS[t.type as NodeType] ?? t.type}</Text>
                    <Text className={styles.muted}>({t.node_id})</Text>
                    <Badge appearance="tint" color={t.status === "error" ? "danger" : t.status === "waiting" ? "informative" : "subtle"}>
                      {t.status}
                    </Badge>
                    {typeof t.detail === "string" && <Text>{t.detail}</Text>}
                    <Text size={200} className={styles.muted}>
                      {formatDateTime(t.at)}
                    </Text>
                  </li>
                ))}
              </ol>
            )}
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
