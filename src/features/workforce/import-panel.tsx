"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, ArrowUpload20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { workforceApi } from "./api";
import type { ImportRowError, LineImportOut, PlanOut } from "./types";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "960px" },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "center" },
  hidden: { display: "none" },
  num: { fontVariantNumeric: "tabular-nums" },
});

const errorColumns: TableColumnDefinition<ImportRowError & { i: number }>[] = [
  createTableColumn({ columnId: "row", renderHeaderCell: () => "Row", renderCell: (e) => e.row }),
  createTableColumn({ columnId: "field", renderHeaderCell: () => "Column", renderCell: (e) => e.field ?? "—" }),
  createTableColumn({ columnId: "message", renderHeaderCell: () => "Problem", renderCell: (e) => e.message }),
];

/** Import lines from CSV / XLSX: preview (row errors) first, then apply the valid rows. */
export function ImportPanel({ plan, onImported }: { plan: PlanOut; onImported: () => Promise<unknown> }) {
  const styles = useStyles();
  const toast = useAppToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LineImportOut | null>(null);
  const check = useMutation({
    mutationFn: (f: File) => workforceApi.importLines(plan.id, f, false),
    onSuccess: setPreview,
  });
  const apply = useMutation({
    mutationFn: () => workforceApi.importLines(plan.id, file!, true),
    onSuccess: async (r) => {
      toast.success(`${r.created} line${r.created === 1 ? "" : "s"} imported`);
      setPreview(null);
      setFile(null);
      await onImported();
    },
  });
  const template = useMutation({ mutationFn: () => workforceApi.downloadTemplate(), onError: (e) => toast.error(errorMessage(e)) });

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Import lines</Subtitle2>}
        description={<Body1>CSV or Excel with the columns role, skills (e.g. &quot;Java:4; Spring:3&quot;), headcount, type, location, start_month (YYYY-MM), budget, bill_rate, unit, notes.</Body1>}
      />
      <div className={styles.row}>
        <Button icon={<ArrowDownload20Regular />} disabled={template.isPending} onClick={() => template.mutate()}>
          Download template
        </Button>
        <input
          ref={input}
          className={styles.hidden}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Choose a file"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(null);
            apply.reset();
            if (f) check.mutate(f);
            e.target.value = "";
          }}
        />
        <Button appearance="primary" icon={<ArrowUpload20Regular />} disabled={check.isPending || apply.isPending} onClick={() => input.current?.click()}>
          {file ? "Choose another file" : "Choose file"}
        </Button>
        {file && <Text>{file.name}</Text>}
      </div>
      <ErrorBar message={check.error ? errorMessage(check.error) : apply.error ? errorMessage(apply.error) : null} />
      {check.isPending && <Text>Checking the file…</Text>}
      {preview && (
        <>
          <MessageBar intent={preview.error_count ? "warning" : "success"}>
            <MessageBarBody>
              <span className={styles.num}>
                {`${preview.row_count} rows: ${preview.valid_count} valid, ${preview.error_count} with errors.`}
              </span>
              {preview.error_count > 0 && " Rows with errors are skipped."}
            </MessageBarBody>
          </MessageBar>
          {preview.errors.length > 0 && (
            <Field label="Row errors">
              <AdminGrid
                items={preview.errors.map((e, i) => ({ ...e, i }))}
                columns={errorColumns}
                getRowId={(e) => String(e.i)}
                loading={false}
                error={null}
                emptyText=""
                label="Import errors"
              />
            </Field>
          )}
          <div className={styles.row}>
            <Button appearance="primary" disabled={preview.valid_count === 0 || apply.isPending} onClick={() => apply.mutate()}>
              {`Import ${preview.valid_count} valid row${preview.valid_count === 1 ? "" : "s"}`}
            </Button>
            <Button
              onClick={() => {
                setPreview(null);
                setFile(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
