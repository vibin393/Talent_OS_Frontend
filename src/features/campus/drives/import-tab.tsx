"use client";

import {
  Body1,
  Button,
  Dropdown,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from "@fluentui/react-components";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { FileDrop } from "@/features/candidates/file-drop";
import { errorMessage } from "@/lib/api/errors";
import { campusApi } from "../api";
import type { DriveOut, ImportApplyOut, ImportPreviewOut } from "../types";
import { useCampusStyles } from "../ui";
import { useCampusPermissions, useInvalidateDrive } from "../use-campus";

const ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Placement-officer list import: upload CSV / XLSX -> preview per-row errors -> send personal invitations. */
export function ImportTab({ drive }: { drive: DriveOut }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const { canManage } = useCampusPermissions();
  const invalidate = useInvalidateDrive(drive.id);
  const [diid, setDiid] = useState<string>(drive.institutions[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewOut | null>(null);
  const [result, setResult] = useState<ImportApplyOut | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return <Body1>You need campus management permission to import lists.</Body1>;
  if (drive.institutions.length === 0) return <Body1>Add an Institution to the drive first.</Body1>;

  const runPreview = async () => {
    if (!file || !diid) return;
    setBusy("preview");
    setError(null);
    setResult(null);
    try {
      setPreview(await campusApi.importPreview(drive.id, diid, file));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const apply = async () => {
    if (!preview) return;
    setBusy("apply");
    setError(null);
    try {
      const out = await campusApi.importApply(drive.id, preview.batch_id);
      setResult(out);
      setPreview(null);
      setFile(null);
      await invalidate();
      toast.success(`${out.sent} invitations sent`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const errorRows = preview?.rows.filter((r) => r.errors.length) ?? [];

  return (
    <div className={c.stack}>
      <Body1>
        Upload the list a placement officer sent you. Each valid row receives a personal registration invitation; students
        still read the notice and register themselves. Consent is never assumed for imported rows.
      </Body1>
      <Field label="Institution" style={{ maxWidth: 420 }}>
        <Dropdown
          value={drive.institutions.find((i) => i.id === diid)?.institution_name ?? ""}
          selectedOptions={[diid]}
          onOptionSelect={(_, d) => {
            setDiid(d.optionValue ?? "");
            setPreview(null);
          }}
        >
          {drive.institutions.map((i) => (
            <Option key={i.id} value={i.id}>
              {i.institution_name}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <FileDrop
        accept={ACCEPT}
        title={file ? `Selected: ${file.name}` : "Drop a CSV or Excel file here"}
        hint="Columns: email (required), name; optional program, branch, cgpa, percentage, backlogs, graduation_year. Up to 5 MB."
        buttonLabel={file ? "Choose another file" : "Choose file"}
        disabled={!!busy}
        onFiles={([f]) => {
          if (f) {
            setFile(f);
            setPreview(null);
          }
        }}
      />
      <div className={c.row}>
        <Button appearance="primary" disabled={!file || !!busy} icon={busy === "preview" ? <Spinner size="tiny" /> : undefined} onClick={() => void runPreview()}>
          Preview
        </Button>
      </div>
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {result && (
        <MessageBar intent="success">
          <MessageBarBody>
            {result.sent} invitations sent, {result.skipped} skipped.
          </MessageBarBody>
        </MessageBar>
      )}
      {preview && (
        <section className={c.stack} aria-label="Import preview">
          <Text weight="semibold" aria-live="polite">
            {preview.row_count} rows, {preview.error_count} with errors. Rows with errors are skipped.
          </Text>
          {errorRows.length > 0 && (
            <div className={c.tableWrap}>
              <Table aria-label="Rows with errors" size="small" style={{ minWidth: 480 }}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Row</TableHeaderCell>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Email</TableHeaderCell>
                    <TableHeaderCell>Errors</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorRows.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell>{r.row}</TableCell>
                      <TableCell>{r.name ?? "—"}</TableCell>
                      <TableCell>{r.email ?? "—"}</TableCell>
                      <TableCell className={c.danger}>{r.errors.join("; ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div>
            <Button
              appearance="primary"
              disabled={!!busy || preview.row_count - preview.error_count <= 0}
              icon={busy === "apply" ? <Spinner size="tiny" /> : undefined}
              onClick={() => void apply()}
            >
              Send {preview.row_count - preview.error_count} invitations
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
