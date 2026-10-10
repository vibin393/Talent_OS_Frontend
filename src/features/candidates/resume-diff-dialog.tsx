"use client";

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
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
import { useState } from "react";
import { ErrorBar } from "@/features/admin/ui";
import type { Candidate360Out, ResumeUploadOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { allDiffKeys, buildDiffPatch, diffFieldLabel, diffKey, diffValueText, isAddition } from "./diff";
import { candidateErrorMessage } from "./errors";
import { PARSE_STATUS } from "./format";
import { useCandidateMutation } from "./use-candidates";

const useStyles = makeStyles({
  table: { minWidth: "560px" },
  scroll: { maxHeight: "55vh", overflow: "auto" },
  current: { color: tokens.colorNeutralForeground3 },
  parsed: { color: tokens.colorPaletteGreenForeground1 },
});

const DECISION_TEXT: Record<string, string> = {
  accepted: "All parsed values applied.",
  edited: "Selected parsed values applied.",
  rejected: "No parsed values applied.",
};

/** Field / Current / Parsed table with per-row checkboxes and "Apply selected" (resume re-upload). */
export function ResumeDiffDialog({
  candidate,
  upload,
  onClose,
}: {
  candidate: Candidate360Out;
  upload: ResumeUploadOut;
  onClose: () => void;
}) {
  const styles = useStyles();
  const diff = upload.diff;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const status = PARSE_STATUS[upload.parse_status];

  const apply = useCandidateMutation({
    mutationFn: (keys: Set<string>) =>
      candidatesApi.applyResume(candidate.id, upload.resume.id, buildDiffPatch(diff, keys)),
    invalidate: [candidateKeys.detail(candidate.id), candidateKeys.aiActions(candidate.id), candidateKeys.lists],
    success: (r) => (r.decision ? DECISION_TEXT[r.decision] ?? "Resume applied." : "Resume applied."),
  });

  const all = allDiffKeys(diff);
  const allChecked = all.length > 0 && all.every((k) => selected.has(k));
  const someChecked = all.some((k) => selected.has(k));

  async function run(keys: Set<string>) {
    setError(null);
    try {
      await apply.mutateAsync(keys);
      onClose();
    } catch (e) {
      setError(candidateErrorMessage(e));
    }
  }

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !apply.isPending && onClose()}>
      <DialogSurface style={{ maxWidth: 860, width: "100%" }}>
        <DialogBody>
          <DialogTitle>Review parsed resume (version {upload.resume.version ?? "—"})</DialogTitle>
          <DialogContent>
            <ErrorBar message={error} />
            <MessageBar intent={status.intent} layout="multiline" style={{ marginBottom: 12 }}>
              <MessageBarBody>
                {status.label}
                {upload.warnings?.length ? ` · ${upload.warnings.join(" · ")}` : ""}
              </MessageBarBody>
            </MessageBar>
            {diff.length === 0 ? (
              <Text>The parsed resume has nothing new compared with this profile.</Text>
            ) : (
              <div className={styles.scroll}>
                <Table aria-label="Parsed changes" size="small" className={styles.table}>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell style={{ width: 44 }}>
                        <Checkbox
                          aria-label="Select all"
                          checked={allChecked ? true : someChecked ? "mixed" : false}
                          onChange={(_, d) => setSelected(d.checked ? new Set(all) : new Set())}
                        />
                      </TableHeaderCell>
                      <TableHeaderCell>Field</TableHeaderCell>
                      <TableHeaderCell>Current</TableHeaderCell>
                      <TableHeaderCell>Parsed</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diff.map((entry) => {
                      const key = diffKey(entry);
                      const unresolved =
                        entry.field === "skills" &&
                        (upload.unresolved_skills ?? []).some((u) => u.name === String(entry.parsed));
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <Checkbox
                              aria-label={`Apply ${diffFieldLabel(entry.field)}`}
                              checked={selected.has(key)}
                              onChange={(_, d) =>
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (d.checked) next.add(key);
                                  else next.delete(key);
                                  return next;
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {diffFieldLabel(entry.field)}
                            {unresolved && (
                              <Badge size="small" appearance="tint" color="warning" style={{ marginLeft: 6 }}>
                                unresolved
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className={styles.current}>
                            {isAddition(entry) ? <em>Add new</em> : diffValueText(entry.field, entry.current)}
                          </TableCell>
                          <TableCell className={styles.parsed}>{diffValueText(entry.field, entry.parsed)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            {diff.length > 0 && (
              <Button disabled={apply.isPending} onClick={() => run(new Set())}>
                Keep profile as is
              </Button>
            )}
            <Button disabled={apply.isPending} onClick={onClose}>
              {diff.length > 0 ? "Decide later" : "Close"}
            </Button>
            {diff.length > 0 && (
              <Button
                appearance="primary"
                disabled={apply.isPending || selected.size === 0}
                icon={apply.isPending ? <Spinner size="tiny" /> : undefined}
                onClick={() => run(selected)}
              >
                Apply selected ({selected.size})
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
