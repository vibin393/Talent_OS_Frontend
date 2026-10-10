"use client";

import {
  Badge,
  Button,
  Caption1,
  Card,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { Candidate360Out, DuplicateDetailOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { candidateErrorMessage } from "./errors";
import { duplicateReasonLabel } from "./format";
import { buildMergeBody, COMPARE_FIELDS, compareValueText, defaultFieldChoices, fieldsFromOther, type Side } from "./merge";
import { useCandidateMutation } from "./use-candidates";

const useStyles = makeStyles({
  table: { minWidth: "720px" },
  differ: { backgroundColor: tokens.colorPaletteYellowBackground1 },
  chosen: { fontWeight: tokens.fontWeightSemibold },
  notChosen: { color: tokens.colorNeutralForeground3 },
  valueCell: { overflowWrap: "anywhere" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", marginTop: tokens.spacingVerticalL },
  head: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalL },
});

function counts(p: Candidate360Out): string {
  return `${p.emails.length} email(s), ${p.phones.length} phone(s), ${p.counts.resumes} resume(s), ${p.counts.skills} skill(s), ${p.counts.tags} tag(s), ${p.counts.attachments} attachment(s)`;
}

/** Side-by-side compare with a radio per differing field, survivor selector, Merge and Keep separate. */
export function MergeCompare({ id }: { id: string }) {
  const canRead = usePermission("candidate:read");
  const query = useQuery({
    queryKey: candidateKeys.duplicate(id),
    queryFn: ({ signal }) => candidatesApi.getDuplicate(id, signal),
    enabled: canRead,
  });
  if (!canRead) return <NoAccess what="candidates" />;
  if (query.isPending) return <GridSkeleton rows={8} />;
  if (query.isError) return <ErrorBar title="Could not load the duplicate." message={candidateErrorMessage(query.error)} />;
  return <MergeForm key={query.data.id} d={query.data} />;
}

function MergeForm({ d }: { d: DuplicateDetailOut }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const router = useRouter();
  const toast = useAppToast();
  const canMerge = usePermission("candidate:merge");
  const [survivor, setSurvivor] = useState<Side>("a");
  const [choices, setChoices] = useState<Record<string, Side>>(() => defaultFieldChoices(d.differing_fields, "a"));
  const [confirm, setConfirm] = useState<"merge" | "separate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = d.status === "open";
  const differing = new Set(d.differing_fields);
  const profiles = { a: d.profile_a, b: d.profile_b };
  const ids = { a: d.candidate_a.id, b: d.candidate_b.id };

  const merge = useCandidateMutation({
    mutationFn: () => candidatesApi.merge(d.id, buildMergeBody(survivor, ids, d.differing_fields, choices)),
    invalidate: [candidateKeys.all],
  });
  const keep = useCandidateMutation({
    mutationFn: () => candidatesApi.keepSeparate(d.id),
    invalidate: [candidateKeys.duplicates],
    success: "Kept as separate candidates. This pair will not be flagged again.",
  });

  const changeSurvivor = (side: Side) => {
    // Fields still on the old default follow the new survivor.
    setChoices((prev) => Object.fromEntries(d.differing_fields.map((f) => [f, prev[f] === survivor ? side : prev[f]])));
    setSurvivor(side);
  };
  const other: Side = survivor === "a" ? "b" : "a";
  const takenFromOther = fieldsFromOther(survivor, d.differing_fields, choices);

  return (
    <>
      <PageHeader
        title="Review possible duplicate"
        subtitle={<AppLink href="/candidates/duplicates">Back to the duplicate queue</AppLink>}
      />
      <div className={styles.head}>
        <div className={admin.badges}>
          {d.reasons.map((r) => (
            <Badge key={r} appearance="tint" color={r.startsWith("fuzzy") ? "warning" : "danger"}>
              {duplicateReasonLabel(r)}
            </Badge>
          ))}
          <Badge appearance="outline">Score {Number.isFinite(Number(d.score)) ? Number(d.score).toFixed(2) : d.score}</Badge>
          <Caption1>Flagged {formatDateTime(d.created_at)}</Caption1>
        </div>
        {!open && (
          <MessageBar intent="info">
            <MessageBarBody>
              This pair was {d.status === "merged" ? "merged" : "kept separate"}
              {d.resolved_at ? ` on ${formatDateTime(d.resolved_at)}` : ""}.
            </MessageBarBody>
          </MessageBar>
        )}
        <ErrorBar message={error} />
      </div>

      <Card>
        <div style={{ overflowX: "auto" }}>
          <Table aria-label="Compare candidates" className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell style={{ width: "22%" }}>Field</TableHeaderCell>
                {(["a", "b"] as const).map((side) => (
                  <TableHeaderCell key={side}>
                    <div className={admin.cellStack}>
                      <AppLink href={`/candidates/${ids[side]}`}>{profiles[side].full_name}</AppLink>
                      <Caption1 className={admin.muted}>{profiles[side].human_id}</Caption1>
                    </div>
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {open && canMerge && (
                <TableRow>
                  <TableCell>
                    <Text weight="semibold">Keep this profile</Text>
                  </TableCell>
                  <TableCell colSpan={2}>
                    <RadioGroup
                      layout="horizontal"
                      aria-label="Surviving profile"
                      value={survivor}
                      onChange={(_, data) => changeSurvivor(data.value as Side)}
                    >
                      <Radio value="a" label={`${profiles.a.human_id} (A)`} />
                      <Radio value="b" label={`${profiles.b.human_id} (B)`} />
                    </RadioGroup>
                  </TableCell>
                </TableRow>
              )}
              {COMPARE_FIELDS.map(({ field, label }) => {
                const isDiff = differing.has(field);
                const chosen = choices[field] ?? survivor;
                return (
                  <TableRow key={field} className={isDiff ? styles.differ : undefined}>
                    <TableCell>
                      {label}
                      {isDiff && (
                        <Badge size="small" appearance="tint" color="warning" style={{ marginLeft: 6 }}>
                          differs
                        </Badge>
                      )}
                    </TableCell>
                    {(["a", "b"] as const).map((side) => {
                      const text = compareValueText(field, profiles[side]);
                      return (
                        <TableCell
                          key={side}
                          className={mergeClasses(
                            styles.valueCell,
                            isDiff && open && (chosen === side ? styles.chosen : styles.notChosen),
                          )}
                        >
                          {isDiff && open && canMerge ? (
                            <Radio
                              name={`choice-${field}`}
                              value={side}
                              checked={chosen === side}
                              label={text}
                              aria-label={`Use ${label} from ${side.toUpperCase()}: ${text}`}
                              onChange={() => setChoices((prev) => ({ ...prev, [field]: side }))}
                            />
                          ) : (
                            text
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell>Records moved to the survivor</TableCell>
                <TableCell>{counts(profiles.a)}</TableCell>
                <TableCell>{counts(profiles.b)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      {open && canMerge && (
        <div className={styles.actions}>
          <Button appearance="primary" onClick={() => setConfirm("merge")}>
            Merge into {profiles[survivor].human_id}
          </Button>
          <Button onClick={() => setConfirm("separate")}>Keep separate</Button>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "merge"}
        title="Merge candidates?"
        confirmLabel="Merge"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setError(null);
          try {
            const m = await merge.mutateAsync(undefined);
            toast.success(`Merged. You can undo this until ${formatDateTime(m.undo_until)}.`);
            router.push(`/candidates/${m.survivor_id}`);
          } catch (e) {
            setError(candidateErrorMessage(e));
            throw e;
          }
        }}
      >
        {profiles[other].full_name} ({profiles[other].human_id}) will be merged into {profiles[survivor].full_name} (
        {profiles[survivor].human_id}). {takenFromOther} field{takenFromOther === 1 ? "" : "s"} will be taken from{" "}
        {profiles[other].human_id}. Contacts, resumes, skills, tags, lists, attachments and notes move to the survivor, and
        the other profile is archived. You can undo this for 30 days.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "separate"}
        title="Keep separate?"
        confirmLabel="Keep separate"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setError(null);
          try {
            await keep.mutateAsync(undefined);
            router.push("/candidates/duplicates");
          } catch (e) {
            setError(candidateErrorMessage(e));
            throw e;
          }
        }}
      >
        These are different people. The pair is closed and will not be flagged again.
      </ConfirmDialog>
    </>
  );
}
