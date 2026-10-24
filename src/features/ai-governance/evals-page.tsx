"use client";

import { Badge, Caption1, createTableColumn, type TableColumnDefinition, Tooltip } from "@fluentui/react-components";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import type { EvalRowOut } from "@/lib/api/governance-types";
import { useEvals } from "./api";
import { ConsoleShell } from "./console-shell";
import { EVAL_STATUS, EVALS_FOOTNOTE, formatScore } from "./logic";

/** `/admin/ai/evals`: latest evaluation and red-team results per agent. */
export function EvalsPage() {
  return (
    <ConsoleShell anyOf={["ai:agent_configure"]}>
      <EvalsTable />
    </ConsoleShell>
  );
}

/** The evaluations grid; `agentKey` narrows it to one agent (agent settings "Evaluation" tab). */
export function EvalsTable({ agentKey }: { agentKey?: string }) {
  const evals = useEvals();
  const items = agentKey ? evals.data?.filter((e) => e.agent_key === agentKey) : evals.data;
  const columns: TableColumnDefinition<EvalRowOut>[] = [
    createTableColumn({ columnId: "agent", renderHeaderCell: () => "Agent", renderCell: (e) => e.agent_name }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (e) => String(e.agent_version) }),
    createTableColumn({ columnId: "prompt", renderHeaderCell: () => "Prompt", renderCell: (e) => e.prompt_ref ?? "—" }),
    createTableColumn({ columnId: "model", renderHeaderCell: () => "Model", renderCell: (e) => e.model ?? "—" }),
    createTableColumn({ columnId: "offline", renderHeaderCell: () => "Offline score", renderCell: (e) => formatScore(e.offline?.score) }),
    createTableColumn({
      columnId: "redteam",
      renderHeaderCell: () => "Red-team",
      renderCell: (e) => (e.redteam ? `${e.redteam.cases_passed}/${e.redteam.cases_total}` : "—"),
    }),
    createTableColumn({ columnId: "live", renderHeaderCell: () => "Live score", renderCell: (e) => formatScore(e.live?.score) }),
    createTableColumn({ columnId: "threshold", renderHeaderCell: () => "Threshold", renderCell: (e) => formatScore(e.threshold) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (e) => {
        const s = EVAL_STATUS[e.status] ?? EVAL_STATUS.not_run;
        const badge = (
          <Badge appearance="tint" color={s.color}>
            {s.label}
          </Badge>
        );
        return e.failing_case_ids.length ? (
          <Tooltip content={`Failing cases: ${e.failing_case_ids.join(", ")}`} relationship="description">
            <span/* NOSONAR */ tabIndex={0}>{badge}</span>
          </Tooltip>
        ) : (
          badge
        );
      },
    }),
    createTableColumn({ columnId: "last", renderHeaderCell: () => "Last run", renderCell: (e) => formatDateTime(e.last_run_at) }),
  ];
  return (
    <>
      <AdminGrid
        items={items}
        columns={columns}
        getRowId={(e) => e.agent_key}
        loading={evals.isPending}
        error={evals.error}
        emptyText="No evaluation results yet."
        label="Evaluation results"
      />
      <Caption1>{EVALS_FOOTNOTE}</Caption1>
    </>
  );
}
