import type { Metadata } from "next";
import { AnswerPrefilledBuilder } from "@/features/agents/analytics/answer-prefill";
import { BuilderView } from "@/features/report-builder/builder-view";

export const metadata: Metadata = { title: "New custom report" };

/** `/reports/custom/new` (Epic 47): the report builder for a new definition. Epic 64: `?from_answer=<id>` pre-fills it from
 *  an analytics answer. */
export default async function NewCustomReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const fromAnswer = (await searchParams).from_answer;
  if (typeof fromAnswer === "string" && fromAnswer) return <AnswerPrefilledBuilder answerId={fromAnswer} />;
  return <BuilderView />;
}
