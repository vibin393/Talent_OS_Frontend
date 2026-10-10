"use client";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowUpload20Regular, CheckmarkCircle20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { timeApi } from "./api";
import { categoryLabel, codeLabel, formatDay, newIdempotencyKey } from "./format";
import type { ImportApplyOut, ImportPreviewOut } from "./types";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginBottom: tokens.spacingVerticalL },
  errorRow: { backgroundColor: tokens.colorPaletteRedBackground1 },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "center" },
});

/** `/timesheets/imports`: CSV upload -> preview with row errors -> apply (idempotent). */
export function TimesheetImports() {
  const admin = useAdminStyles();
  const styles = useStyles();
  const canAdmin = usePermission("timesheet:admin");
  const [file, setFile] = useState<File | null>(null);
  const [markClientApproved, setMarkClientApproved] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewOut | null>(null);
  const [applied, setApplied] = useState<ImportApplyOut | null>(null);
  const keyRef = useRef("");
  const upload = useMutation({
    mutationFn: () => timeApi.uploadImport(file as File, markClientApproved),
    onSuccess: (p) => {
      setPreview(p);
      setApplied(null);
      keyRef.current = newIdempotencyKey();
    },
  });
  const apply = useMutation({
    mutationFn: () => timeApi.applyImport((preview as ImportPreviewOut).batch_id, keyRef.current),
    onSuccess: setApplied,
  });
  if (!canAdmin) return <NoAccess what="timesheet imports" />;

  return (
    <>
      <PageHeader title="Import timesheets" subtitle="Upload hours from a client system as CSV" />
      <Card className={styles.card}>
        <Text>
          CSV header: <code>worker_human_id</code> or <code>placement_id</code>, <code>date</code>, <code>category</code>, <code>hours</code>.
        </Text>
        <div className={styles.row}>
          <Field label="CSV file">
            <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Checkbox
            checked={markClientApproved}
            onChange={(_, d) => setMarkClientApproved(!!d.checked)}
            label="Hours are already client-approved"
          />
          <Button
            appearance="primary"
            icon={upload.isPending ? <Spinner size="tiny" /> : <ArrowUpload20Regular />}
            disabled={!file || upload.isPending}
            onClick={() => upload.mutate()}
          >
            Upload and preview
          </Button>
        </div>
        <ErrorBar message={upload.isError ? errorMessage(upload.error) : null} />
      </Card>

      {preview && (
        <Card className={styles.card}>
          <div className={styles.row}>
            <Text weight="semibold">Batch preview</Text>
            <Badge appearance="tint">{preview.row_count} rows</Badge>
            <Badge appearance="tint" color={preview.error_count ? "danger" : "success"}>
              {preview.error_count} errors
            </Badge>
            {preview.mark_client_approved && <Badge appearance="tint" color="informative">Client approved</Badge>}
            <span className={admin.grow} />
            <Button
              appearance="primary"
              icon={apply.isPending ? <Spinner size="tiny" /> : <CheckmarkCircle20Regular />}
              disabled={preview.error_count > 0 || preview.row_count === 0 || apply.isPending || !!applied}
              onClick={() => apply.mutate()}
            >
              Apply import
            </Button>
          </div>
          {preview.error_count > 0 && (
            <MessageBar intent="warning">
              <MessageBarBody>Fix the rows with errors and upload the file again. Nothing is applied while errors remain.</MessageBarBody>
            </MessageBar>
          )}
          <ErrorBar message={apply.isError ? errorMessage(apply.error) : null} />
          {applied && (
            <MessageBar intent="success">
              <MessageBarBody>
                Applied {applied.applied_rows} rows; {applied.submitted_timesheet_ids.length} timesheets submitted.
              </MessageBarBody>
            </MessageBar>
          )}
          <div className={admin.surface}>
            <Table aria-label="Import rows" size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Row</TableHeaderCell>
                  <TableHeaderCell>Worker</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell>Hours</TableHeaderCell>
                  <TableHeaderCell>Errors</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((r) => (
                  <TableRow key={r.row} className={r.errors.length ? styles.errorRow : undefined}>
                    <TableCell>{r.row}</TableCell>
                    <TableCell>{r.worker ?? r.placement_id ?? "—"}</TableCell>
                    <TableCell>{formatDay(r.date)}</TableCell>
                    <TableCell>{r.category ? categoryLabel(r.category) : "—"}</TableCell>
                    <TableCell>{r.hours ?? "—"}</TableCell>
                    <TableCell>
                      <span className={admin.badges}>
                        {r.errors.map((e) => (
                          <Badge key={e} appearance="tint" color="danger">
                            {codeLabel(e)}
                          </Badge>
                        ))}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </>
  );
}
