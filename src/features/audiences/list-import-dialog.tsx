"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
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
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { audiencesApi } from "./api";
import { IMPORT_ACCEPT, importFileError } from "./logic";
import type { ListImportOut, ListImportRow, SourceMode } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  counts: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  table: { maxHeight: "220px", overflowY: "auto", border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium },
  muted: { color: tokens.colorNeutralForeground3 },
});

function RowsTable({ rows, label }: { rows: ListImportRow[]; label: string }) {
  const styles = useStyles();
  if (rows.length === 0) return null;
  return (
    <div className={styles.table}>
      <Table size="extra-small" aria-label={label}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell style={{ width: 64 }}>Row</TableHeaderCell>
            <TableHeaderCell>Value</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 200).map((r) => (
            <TableRow key={`${r.row}-${r.value}`}>
              <TableCell>{r.row}</TableCell>
              <TableCell>{r.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Import a CSV/XLSX of emails or E.164 phones: preview the matches first, then apply. */
export function ListImportDialog({
  audienceId,
  defaultMode = "include",
  onClose,
  onApplied,
}: {
  audienceId: string;
  defaultMode?: SourceMode;
  onClose: () => void;
  onApplied: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const [mode, setMode] = useState<SourceMode>(defaultMode);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ListImportOut | null>(null);
  const [touched, setTouched] = useState(false);
  const fileError = touched ? importFileError(file) : null;

  const run = useMutation({
    mutationFn: (apply: boolean) => audiencesApi.listImport(audienceId, file as File, mode, apply),
    onSuccess: (r) => {
      if (r.applied) {
        toast.success(`${r.matched.toLocaleString()} candidates ${mode === "include" ? "added" : "excluded"}.`);
        onApplied();
        onClose();
      } else setPreview(r);
    },
    onError: (e) => toast.error(errorMessage(e, "Could not import the list.")),
  });

  const runPreview = () => {
    setTouched(true);
    if (!importFileError(file)) run.mutate(false);
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !run.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Import a list</DialogTitle>
          <DialogContent className={styles.form}>
            <Body1>Upload a CSV or XLSX with one email address or phone number (E.164, e.g. +919812345678) per row.</Body1>
            <Field label="Use the list to">
              <RadioGroup
                layout="horizontal"
                value={mode}
                onChange={(_, d) => {
                  setMode(d.value as SourceMode);
                  setPreview(null);
                }}
              >
                <Radio value="include" label="Include people" />
                <Radio value="exclude" label="Exclude people" />
              </RadioGroup>
            </Field>
            <Field label="File" required validationState={fileError ? "error" : "none"} validationMessage={fileError ?? undefined}>
              <input
                type="file"
                accept={IMPORT_ACCEPT}
                aria-label="List file"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
              />
            </Field>
            {run.isPending && <Spinner size="small" label={run.variables ? "Applying..." : "Matching rows..."} />}
            {preview && (
              <>
                <div className={styles.counts} aria-live="polite">
                  <Badge appearance="tint" color="success">
                    {preview.matched.toLocaleString()} matched
                  </Badge>
                  <Badge appearance="tint" color={preview.unmatched ? "warning" : "subtle"}>
                    {preview.unmatched.toLocaleString()} not matched
                  </Badge>
                </div>
                {preview.matched === 0 ? (
                  <MessageBar intent="warning">
                    <MessageBarBody>No rows match a candidate. Check the file and try again.</MessageBarBody>
                  </MessageBar>
                ) : (
                  <>
                    <Text weight="semibold">Matched</Text>
                    <RowsTable rows={preview.matched_rows} label="Matched rows" />
                  </>
                )}
                {preview.unmatched > 0 && (
                  <>
                    <Text weight="semibold">Not matched</Text>
                    <Caption1 className={styles.muted}>These rows are ignored.</Caption1>
                    <RowsTable rows={preview.unmatched_rows} label="Unmatched rows" />
                  </>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={run.isPending}>
              Cancel
            </Button>
            {preview && preview.matched > 0 ? (
              <Button appearance="primary" disabled={run.isPending} onClick={() => run.mutate(true)}>
                Apply {preview.matched.toLocaleString()}
              </Button>
            ) : (
              <Button appearance="primary" disabled={run.isPending} onClick={runPreview}>
                Preview
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
