"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Body1,
  Caption1,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  makeStyles,
  Subtitle2,
  tokens,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { AiBadge } from "@/components/ai/ai-badge";
import { AppLink } from "@/components/app-link";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { interviewAssistantApi, interviewAssistantKeys } from "./api";
import { formatOffset } from "./logic";
import type { QaItem } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  quote: { margin: 0, paddingLeft: tokens.spacingHorizontalM, borderLeft: `3px solid ${tokens.colorNeutralStroke1}` },
  muted: { color: tokens.colorNeutralForeground3 },
  grid: { overflowX: "auto" },
});

const columns: TableColumnDefinition<QaItem>[] = [
  createTableColumn<QaItem>({ columnId: "asked", renderHeaderCell: () => "Question asked", renderCell: (q) => q.asked_text }),
  createTableColumn<QaItem>({ columnId: "kit", renderHeaderCell: () => "Kit question", renderCell: (q) => q.kit_question_text ?? "—" }),
  createTableColumn<QaItem>({ columnId: "said", renderHeaderCell: () => "Candidate said", renderCell: (q) => `“${q.response_quote}”` }),
  createTableColumn<QaItem>({ columnId: "time", renderHeaderCell: () => "Time", renderCell: (q) => (q.start_ms !== null ? `▶ ${formatOffset(q.start_ms)}` : "") }),
];

/** The assistant's outputs for the draft owner (or under the P1 blind rule): summary by competency, the questions
 * asked and the skill suggestions sent to the candidate's Skills tab. Everything is labelled AI-generated. */
export function OutputsView({ interviewId }: { interviewId: string }) {
  const styles = useStyles();
  const q = useQuery({
    queryKey: interviewAssistantKeys.outputs(interviewId),
    queryFn: ({ signal }) => interviewAssistantApi.outputs(interviewId, signal),
    retry: (n, e) => !(isApiError(e) && e.status === 404) && n < 2,
  });
  if (q.isPending) return <GridSkeleton rows={3} />;
  if (q.isError) return isApiError(q.error) && q.error.status === 404 ? null : <ErrorBar message={errorMessage(q.error)} />;
  const out = q.data;
  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <AiBadge agentName="Interview Assistant" />
        <Caption1 className={styles.muted}>AI-generated — for your review</Caption1>
      </div>
      {out.overall_summary && <Body1>{out.overall_summary}</Body1>}
      <section aria-label="Summary by competency">
        <Subtitle2 as="h3">Summary by competency</Subtitle2>
        <Accordion collapsible multiple>
          {out.summary_by_competency.map((c) => (
            <AccordionItem key={c.competency_key} value={c.competency_key}>
              <AccordionHeader>{c.label}</AccordionHeader>
              <AccordionPanel>
                <Body1 as="p">{c.summary}</Body1>
                {c.evidence.map((e, i) => (
                  <blockquote key={i} className={styles.quote}>
                    <Body1>“{e.quote}”</Body1> {e.start_ms !== null && <Caption1 className={styles.muted}>▶ {formatOffset(e.start_ms)}</Caption1>}
                  </blockquote>
                ))}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      {out.qa_items.length > 0 && (
        <section aria-label="Questions asked" className={styles.grid}>
          <Subtitle2 as="h3">Questions asked</Subtitle2>
          <DataGrid items={out.qa_items} columns={columns} getRowId={(q: QaItem) => `${q.start_ms}-${q.asked_text}`} size="small">
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<QaItem>>
              {({ item, rowId }) => (
                <DataGridRow<QaItem> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        </section>
      )}
      <section aria-label="Skill suggestions">
        <Subtitle2 as="h3">Skill suggestions</Subtitle2>
        <Body1 as="p">
          {out.skill_suggestion_count} suggestions sent to the candidate&apos;s Skills tab for review ·{" "}
          <AppLink href={`/candidates/${out.candidate_id}?tab=skills`}>Open Skills</AppLink>
        </Body1>
      </section>
    </div>
  );
}
