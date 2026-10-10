"use client";

import {
  Button,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  type TableColumnDefinition,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminGrid } from "@/features/admin/admin-grid";
import { errorMessage } from "@/lib/api/errors";
import { jobBoardsApi } from "./api";
import { BOARD_LABELS } from "./logic";
import type { BoardReportLine, BoardReportRow } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, padding: tokens.spacingHorizontalXL },
  row: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "flex-end", flexWrap: "wrap" },
});

type Line = (BoardReportRow | BoardReportLine) & { _key: string; _label: string; _child: boolean };

const num = (key: keyof BoardReportRow & keyof BoardReportLine, header: string) =>
  createTableColumn<Line>({ columnId: key, renderHeaderCell: () => header, renderCell: (r) => String(r[key] ?? "") });

/** `/reports/job-boards` "Job board performance" (Epic 70, story 70.5). */
export function JobBoardsReportPage() {
  const styles = useStyles();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [board, setBoard] = useState("");
  const [open, setOpen] = useState<string[]>([]);
  const q = useQuery({
    queryKey: ["job-boards", "report", from, to, board],
    queryFn: () => jobBoardsApi.report({ from, to, board_key: board }),
  });
  const lines: Line[] = [];
  for (const b of q.data ?? []) {
    lines.push({ ...b, _key: b.board_key, _label: b.label, _child: false });
    if (open.includes(b.board_key))
      for (const r of b.rows) lines.push({ ...r, _key: r.board_posting_id, _label: `  ${r.human_id} ${r.title}`, _child: true });
  }
  const columns: TableColumnDefinition<Line>[] = [
    createTableColumn<Line>({
      columnId: "board",
      renderHeaderCell: () => "Board",
      renderCell: (r) =>
        r._child ? (
          r._label
        ) : (
          <Button
            appearance="transparent"
            onClick={() => setOpen((o) => (o.includes(r._key) ? o.filter((k) => k !== r._key) : [...o, r._key]))}
          >
            {r._label}
          </Button>
        ),
    }),
    createTableColumn<Line>({
      columnId: "postings",
      renderHeaderCell: () => "Postings",
      renderCell: (r) => ("postings" in r ? String(r.postings) : ""),
    }),
    num("applications", "Applications"),
    num("submissions", "Submissions"),
    num("interviews", "Interviews"),
    num("offers", "Offers"),
    num("placements", "Placements"),
    createTableColumn<Line>({ columnId: "cost", renderHeaderCell: () => "Cost note", renderCell: (r) => r.cost_note ?? "" }),
  ];
  return (
    <div className={styles.root}>
      <Title2>Job board performance</Title2>
      <div className={styles.row}>
        <Field label="From">
          <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(_, d) => setTo(d.value)} />
        </Field>
        <Field label="Board">
          <Dropdown
            value={board ? (BOARD_LABELS[board] ?? board) : "All boards"}
            selectedOptions={[board]}
            onOptionSelect={(_, d) => setBoard(d.optionValue ?? "")}
          >
            <Option value="">All boards</Option>
            {Object.entries(BOARD_LABELS).map(([k, v]) => (
              <Option key={k} value={k}>
                {v}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      <AdminGrid
        items={lines}
        columns={columns}
        getRowId={(r) => r._key}
        loading={q.isLoading}
        error={q.error ? errorMessage(q.error) : null}
        emptyText="No board postings in this period."
        label="Job board performance"
      />
    </div>
  );
}
