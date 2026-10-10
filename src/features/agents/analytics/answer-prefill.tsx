"use client";

import { Spinner } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { ErrorBar } from "@/features/admin/ui";
import { BuilderView } from "@/features/report-builder/builder-view";
import { errorMessage } from "@/lib/api/errors";
import { analyticsApi, analyticsKeys } from "./api";
import { prefillFromAnswer } from "./logic";

/** `/reports/custom/new?from_answer=<id>` (Epic 64.3): the P3 builder pre-filled from an analytics answer; after Save the
 *  answer is linked to the new report (`POST /analytics/answers/{id}/saved`). Saving / scheduling follow P3 rules. */
export function AnswerPrefilledBuilder({ answerId }: { answerId: string }) {
  const answer = useQuery({ queryKey: analyticsKeys.answer(answerId), queryFn: ({ signal }) => analyticsApi.get(answerId, signal), retry: false });
  if (answer.isPending) return <Spinner label="Loading the answer" />;
  if (answer.error || !answer.data) return <ErrorBar title="Could not open the answer." message={errorMessage(answer.error)} />;
  const p = prefillFromAnswer(answer.data);
  return <BuilderView prefill={{ name: p.name, definition: p.definition, viz: p.viz, onCreated: (reportId) => analyticsApi.saved(p.answerId, reportId) }} />;
}
