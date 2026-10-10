import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isReportKind, REPORT_LABELS } from "@/features/reports/query";
import { ReportListView } from "@/features/reports/report-list-view";

export async function generateMetadata({ params }: PageProps<"/reports/[kind]">): Promise<Metadata> {
  const { kind } = await params;
  return { title: isReportKind(kind) ? REPORT_LABELS[kind] : "Reports" };
}

export default async function ReportPage({ params, searchParams }: PageProps<"/reports/[kind]">) {
  const { kind } = await params;
  if (!isReportKind(kind)) notFound();
  const query = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, v);
  }
  return <ReportListView key={kind} kind={kind} initialSearch={search.toString()} />;
}
