"use client";

import {
  Body1,
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  OverlayDrawer,
  Radio,
  RadioGroup,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular, Play20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { graphApi } from "./api";
import { NODE_LABELS, nodeById } from "./graph-model";
import type { Graph, GraphRuleBody, NodeType, PathStep } from "./types";

const useStyles = makeStyles({
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
});

const OUTCOME_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  wait: "Waits",
  approved: "Approved (assumed)",
  rejected: "Rejected (assumed)",
  timeout: "Timed out (assumed)",
  would_run: "Would run",
  error: "Would fail",
  end: "End",
};

export function formatScheduled(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Dry run (Epic 32 B1): pick a record and an assumed approval outcome; the walked path is highlighted. */
export function DryRunDrawer({
  open,
  ruleId,
  body,
  graph,
  entityLabel,
  onClose,
  onPath,
}: {
  open: boolean;
  ruleId: string | null;
  body: GraphRuleBody;
  graph: Graph;
  entityLabel: string;
  onClose: () => void;
  onPath: (path: PathStep[] | null) => void;
}) {
  const styles = useStyles();
  const [entityId, setEntityId] = useState("");
  const [assume, setAssume] = useState<"approved" | "rejected" | "timeout">("approved");
  const run = useMutation({
    mutationFn: () => (ruleId ? graphApi.dryRun(ruleId, entityId.trim(), assume) : graphApi.dryRunDraft(body, entityId.trim(), assume)),
    onSuccess: (out) => onPath(out.path),
  });
  return (
    <OverlayDrawer open={open} position="end" size="medium" onOpenChange={(_, d) => !d.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>Dry run</DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div className={styles.body}>
          <Body1 className={styles.muted}>Nothing is executed or sent: no tasks, emails, notifications, waits or approvals.</Body1>
          <Field label={`${entityLabel} ID`} required hint="Open the record and copy its ID from the address bar.">
            <Input value={entityId} onChange={(_, d) => setEntityId(d.value)} />
          </Field>
          <Field label="Assume approvals are">
            <RadioGroup value={assume} onChange={(_, d) => setAssume(d.value as typeof assume)}>
              <Radio value="approved" label="Approved" />
              <Radio value="rejected" label="Rejected" />
              <Radio value="timeout" label="Timed out" />
            </RadioGroup>
          </Field>
          <div>
            <Button appearance="primary" icon={run.isPending ? <Spinner size="tiny" /> : <Play20Regular />} disabled={!entityId.trim() || run.isPending} onClick={() => run.mutate()}>
              Run
            </Button>
          </div>
          {run.isError && (
            <MessageBar intent="error">
              <MessageBarBody>{errorMessage(run.error)}</MessageBarBody>
            </MessageBar>
          )}
          {run.data && (
            <Table aria-label="Dry run path" size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Step</TableHeaderCell>
                  <TableHeaderCell>Outcome</TableHeaderCell>
                  <TableHeaderCell>Scheduled</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.data.path.map((p, i) => {
                  const node = nodeById(graph, p.node_id);
                  return (
                    <TableRow key={`${p.node_id}-${i}`}>
                      <TableCell>{NODE_LABELS[(node?.type ?? p.type) as NodeType] ?? p.type} ({p.node_id})</TableCell>
                      <TableCell>{OUTCOME_LABELS[p.outcome] ?? p.outcome}</TableCell>
                      <TableCell>{formatScheduled(p.scheduled_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DrawerBody>
    </OverlayDrawer>
  );
}
