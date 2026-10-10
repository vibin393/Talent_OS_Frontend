"use client";

import {
  Avatar,
  Body1,
  Button,
  Caption1,
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
  SearchBox,
  Spinner,
  Tag,
  TagGroup,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { candidateKeys, candidatesApi } from "@/features/candidates/api";
import { EMPTY_CANDIDATE_FILTERS } from "@/features/candidates/query";
import type { ApplicationsCreateOut, CandidateOut } from "@/lib/api/types";
import { pipelineApi } from "./api";
import { pipelineError } from "./use-actions";
import { useInvalidatePipeline } from "./use-pipeline";

const useStyles = makeStyles({
  surface: { maxWidth: "640px", width: "100%" },
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  results: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    maxHeight: "320px",
    overflowY: "auto",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    ":last-child": { borderBottom: "none" },
  },
  label: { display: "flex", flexDirection: "column", minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  empty: { padding: tokens.spacingHorizontalM, color: tokens.colorNeutralForeground3 },
});

const MAX = 200;

/** "Add candidates" picker: search the talent pool, pick several, add them to the demand's pipeline. */
export function AddCandidatesDialog({ demandId, onClose }: { demandId: string; onClose: () => void }) {
  const styles = useStyles();
  const invalidate = useInvalidatePipeline();
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const [picked, setPicked] = useState<Map<string, CandidateOut>>(new Map());
  const [result, setResult] = useState<ApplicationsCreateOut | null>(null);

  const results = useQuery({
    queryKey: [...candidateKeys.all, "pipeline-picker", q],
    queryFn: ({ signal }) => candidatesApi.list({ ...EMPTY_CANDIDATE_FILTERS, q }, 1, 25, signal),
    placeholderData: (prev) => prev,
  });
  const add = useMutation({
    mutationFn: () => pipelineApi.addCandidates(demandId, { candidate_ids: [...picked.keys()], source: "manual" }),
    onSuccess: (r) => {
      setResult(r);
      setPicked(new Map());
    },
    onSettled: () => invalidate(demandId),
  });

  const toggle = (c: CandidateOut, on: boolean) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (on && next.size < MAX) next.set(c.id, c);
      else next.delete(c.id);
      return next;
    });

  const options = results.data?.items ?? [];
  const created = result?.counts.created ?? 0;
  const exists = result?.counts.exists ?? 0;
  const errors = result?.counts.error ?? 0;

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !add.isPending && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>Add candidates</DialogTitle>
          <DialogContent className={styles.content}>
            <SearchBox
              placeholder="Search by name, email, skill or ID"
              value={search}
              onChange={(_, d) => setSearch(d.value)}
              aria-label="Search candidates"
            />
            {picked.size > 0 && (
              <TagGroup
                aria-label="Selected candidates"
                onDismiss={(_, d) => setPicked((prev) => {
                  const next = new Map(prev);
                  next.delete(String(d.value));
                  return next;
                })}
              >
                {[...picked.values()].map((c) => (
                  <Tag key={c.id} value={c.id} dismissible dismissIcon={{ "aria-label": `Remove ${c.full_name}` }}>
                    {c.full_name}
                  </Tag>
                ))}
              </TagGroup>
            )}
            <ul className={styles.results} aria-label="Search results" aria-busy={results.isFetching}>
              {results.isPending && (
                <li className={styles.empty}>
                  <Spinner size="tiny" label="Searching…" />
                </li>
              )}
              {results.isSuccess && options.length === 0 && <li className={styles.empty}>No matching candidates.</li>}
              {options.map((c) => (
                <li key={c.id} className={styles.row}>
                  <Checkbox
                    checked={picked.has(c.id)}
                    onChange={(_, d) => toggle(c, !!d.checked)}
                    aria-label={`Select ${c.full_name}`}
                  />
                  <Avatar name={c.full_name} size={28} color="colorful" aria-hidden />
                  <span className={styles.label}>
                    <Text weight="semibold">{c.full_name}</Text>
                    <Caption1 className={styles.muted}>
                      {[c.human_id, c.current_title, c.current_employer].filter(Boolean).join(" · ")}
                    </Caption1>
                  </span>
                </li>
              ))}
            </ul>
            <div aria-live="polite">
              {result && (
                <MessageBar intent={errors ? "warning" : "success"} layout="multiline">
                  <MessageBarBody>
                    {created} added{exists ? `, ${exists} already in the pipeline` : ""}
                    {errors ? `, ${errors} could not be added` : ""}.
                    {result.items
                      .filter((i) => i.status === "error")
                      .map((i) => (
                        <Body1 key={i.candidate_id} block>
                          {String((i.error as { message?: string } | null)?.message ?? "Could not be added")}
                        </Body1>
                      ))}
                  </MessageBarBody>
                </MessageBar>
              )}
              {add.isError && (
                <MessageBar intent="error" layout="multiline">
                  <MessageBarBody>{pipelineError(add.error)}</MessageBarBody>
                </MessageBar>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={add.isPending}>
              {result ? "Done" : "Cancel"}
            </Button>
            <Button
              appearance="primary"
              disabled={picked.size === 0 || add.isPending}
              icon={add.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => add.mutate()}
            >
              {picked.size ? `Add ${picked.size}` : "Add"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
