"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  ProgressBar,
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
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { PersonPicker } from "@/features/activity/person-picker";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage } from "@/lib/api/errors";
import { crmApi } from "../api";
import type { LeadImportOut } from "../types";
import { invalidateCrm, useLeadSources } from "../use-leads";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  errors: { maxHeight: "240px", overflow: "auto" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const POLL_MS = 1500;

/** Import leads from CSV: options, upload, progress polling, result summary and errors. */
export function ImportLeadsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const sources = useLeadSources();
  const [file, setFile] = useState<File | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<LeadImportOut | null>(null);

  const finished = (b: LeadImportOut | null | undefined) => b?.status === "completed" || b?.status === "failed";
  const status = useQuery({
    queryKey: ["lead", "import", batch?.batch_id],
    queryFn: async ({ signal }) => {
      const b = await crmApi.importStatus(batch!.batch_id, signal);
      if (finished(b)) void invalidateCrm(qc);
      return b;
    },
    enabled: !!batch && !finished(batch),
    refetchInterval: (q) => (finished(q.state.data) ? false : POLL_MS),
  });
  const current = status.data ?? batch;

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (ownerId) form.append("owner_id", ownerId);
      if (source) form.append("default_source", source);
      form.append("skip_duplicates", String(skipDuplicates));
      const b = await crmApi.importLeads(form);
      setBatch(b);
      if (b.duplicate_of) toast.info("This file was already imported; showing the earlier result.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function close() {
    setFile(null);
    setBatch(null);
    setError(null);
    onClose();
  }

  const done = finished(current);

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !uploading && close()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Import leads</DialogTitle>
          <DialogContent className={styles.form}>
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            {!current && (
              <>
                <Text>
                  Upload a CSV with up to 5,000 rows.{" "}
                  <Link
                    onClick={() =>
                      downloadApiFile(crmApi.importTemplateUrl, "leads-import-template.csv").catch((e) =>
                        toast.error(errorMessage(e)),
                      )
                    }
                  >
                    Download the template
                  </Link>
                </Text>
                <Field label="CSV file" required>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    aria-label="CSV file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Field>
                <PersonPicker
                  label="Owner for imported leads"
                  value={ownerId}
                  valueLabel={ownerName}
                  placeholder="Me"
                  clearLabel="Me"
                  onChange={(p) => {
                    setOwnerId(p?.id ?? null);
                    setOwnerName(p?.name ?? "");
                  }}
                />
                <Field label="Default source">
                  <Dropdown
                    placeholder="None"
                    value={sources.data?.find((s) => s.code === source)?.label ?? ""}
                    selectedOptions={source ? [source] : []}
                    onOptionSelect={(_, d) => setSource(d.optionValue ?? null)}
                  >
                    {(sources.data ?? [])
                      .filter((s) => !s.archived_at)
                      .map((s) => (
                        <Option key={s.id} value={s.code}>
                          {s.label}
                        </Option>
                      ))}
                  </Dropdown>
                </Field>
                <Checkbox
                  label="Skip rows that duplicate an existing client or lead"
                  checked={skipDuplicates}
                  onChange={(_, d) => setSkipDuplicates(!!d.checked)}
                />
              </>
            )}
            {current && !done && (
              <Field label={`Importing ${current.row_count} rows…`} validationState="none">
                <ProgressBar />
              </Field>
            )}
            {current && done && (
              <>
                <MessageBar intent={current.status === "failed" ? "error" : current.errors.length ? "warning" : "success"}>
                  <MessageBarBody>
                    {current.status === "failed"
                      ? "The import failed."
                      : `${current.created} created, ${current.skipped_duplicates} skipped as duplicates, ${current.errors.length} rows with errors (of ${current.row_count}).`}
                  </MessageBarBody>
                </MessageBar>
                {current.errors.length > 0 && (
                  <>
                    <div className={styles.errors}>
                      <Table size="small" aria-label="Import errors">
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell>Row</TableHeaderCell>
                            <TableHeaderCell>Field</TableHeaderCell>
                            <TableHeaderCell>Error</TableHeaderCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {current.errors.slice(0, 200).map((e, i) => (
                            <TableRow key={i}>
                              <TableCell>{e.row}</TableCell>
                              <TableCell>{e.field ?? "—"}</TableCell>
                              <TableCell>{e.code}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div>
                      <Button
                        icon={<ArrowDownload20Regular />}
                        onClick={() =>
                          downloadApiFile(crmApi.importErrorsUrl(current.batch_id), "lead-import-errors.csv").catch((e) =>
                            toast.error(errorMessage(e)),
                          )
                        }
                      >
                        Download errors CSV
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            {!current ? (
              <>
                <Button appearance="secondary" onClick={close} disabled={uploading}>
                  Cancel
                </Button>
                <Button
                  appearance="primary"
                  disabled={!file || uploading}
                  icon={uploading ? <Spinner size="tiny" /> : undefined}
                  onClick={upload}
                >
                  Import
                </Button>
              </>
            ) : (
              <Button appearance="primary" onClick={close}>
                {done ? "Done" : "Close (continues in background)"}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
