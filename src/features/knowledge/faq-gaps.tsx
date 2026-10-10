"use client";

import {
  Button,
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { knowledgeApi, knowledgeKeys } from "./api";
import { articleFromGap, GAP_OUTCOMES } from "./logic";
import type { GapRow } from "./types";

const useStyles = makeStyles({
  empty: { padding: tokens.spacingVerticalXXL, color: tokens.colorNeutralForeground3 },
  wrap: { overflowX: "auto" },
});

export function FaqGaps() {
  const styles = useStyles();
  const router = useRouter();
  const canManageKnowledge = usePermission("knowledge:manage");
  const canManageOnboarding = usePermission("onboarding:manage");
  const q = useQuery({ queryKey: knowledgeKeys.gaps, queryFn: ({ signal }) => knowledgeApi.gaps(signal), enabled: canManageKnowledge || canManageOnboarding });
  const create = useMutation({
    mutationFn: (gap: GapRow) => knowledgeApi.create({ ...articleFromGap(gap), audience: "both" }),
    onSuccess: (s) => router.push(`/settings/knowledge/${s.id}`),
  });
  if (!canManageKnowledge && !canManageOnboarding) return <NoAccess what="the FAQ gap report" />;
  const rows = q.data ?? [];
  return (
    <div>
      <PageHeader title="Unanswered onboarding questions" subtitle="Questions the onboarding assistant handed off, could not ground, or answered wrongly." />
      <ErrorBar message={q.isError ? errorMessage(q.error) : create.isError ? errorMessage(create.error) : null} />
      {q.isPending && <GridSkeleton />}
      {q.isSuccess && rows.length === 0 && <div className={styles.empty}>No unanswered questions.</div>}
      {rows.length > 0 && (
        <div className={styles.wrap}>
          <Table aria-label="Unanswered onboarding questions" size="small">
            <TableHeader>
              <TableRow>
                {["Question", "Topic", "Times asked", "Outcome", "Last asked", ""].map((h) => (
                  <TableHeaderCell key={h || "actions"}>{h}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.question}>
                  <TableCell>{g.question}</TableCell>
                  <TableCell>{g.topic ?? "—"}</TableCell>
                  <TableCell>{g.times_asked}</TableCell>
                  <TableCell>{GAP_OUTCOMES[g.outcome]}</TableCell>
                  <TableCell>{formatDateTime(g.last_asked)}</TableCell>
                  <TableCell>
                    {canManageKnowledge && (
                      <Button size="small" disabled={create.isPending} onClick={() => create.mutate(g)}>
                        Create article from this
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
