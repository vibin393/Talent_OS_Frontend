"use client";

import {
  Button,
  Card,
  CardHeader,
  Link,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Tab,
  TabList,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwise20Regular, Copy20Regular, TableSimple20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { usePermission } from "@/features/auth/use-permission";
import { reportBuilderApi, reportBuilderKeys } from "@/features/report-builder/api";
import { fieldMap } from "@/features/report-builder/logic";
import { ReportChart } from "@/features/report-builder/report-chart";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { analyticsApi, analyticsKeys } from "./api";
import { Explanation } from "./explanation";
import {
  LABELS,
  builderHref,
  cardErrorKind,
  cardErrorText,
  defaultTab,
  openInBuilderState,
  savedLabel,
  suppressedNote,
  toTsv,
  visibleResult,
  type CardTab,
} from "./logic";

const useStyles = makeStyles({
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalM, minWidth: 0 },
  header: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  list: { margin: 0, paddingInlineStart: tokens.spacingHorizontalL },
});

/** The analytics answer card (Epic 64, 64.2 / 64.3): question, assumptions, chart | table re-run as the current viewer,
 *  masked / limit / suppressed notes, "How was this calculated?" and the actions. Shown on `/reports/ask` and in Copilot
 *  threads (card kind `analytics_answer`). */
export function AnalyticsAnswerCard({ answerId }: { answerId: string }) {
  const styles = useStyles();
  const canBuild = usePermission("report:build");
  const answer = useQuery({ queryKey: analyticsKeys.answer(answerId), queryFn: ({ signal }) => analyticsApi.get(answerId, signal) });
  const preview = useQuery({
    queryKey: analyticsKeys.preview(answerId),
    queryFn: () => analyticsApi.preview(answerId),
    enabled: !!answer.data && answer.data.status === "ok",
    retry: false,
    staleTime: 60_000,
  });
  const sourceKey = answer.data?.source_key ?? "";
  const source = useQuery({ queryKey: reportBuilderKeys.source(sourceKey), queryFn: ({ signal }) => reportBuilderApi.source(sourceKey, signal), enabled: !!sourceKey, retry: false });
  const fields = useMemo(() => fieldMap(source.data), [source.data]);
  const [tab, setTab] = useState<CardTab | null>(null);
  const [copied, setCopied] = useState(false);

  if (answer.isPending) {
    return (
      <Card className={styles.card} aria-busy="true">
        <Skeleton aria-label="Loading answer">
          <SkeletonItem size={16} />
          <SkeletonItem size={128} />
        </Skeleton>
      </Card>
    );
  }
  if (answer.error || !answer.data) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(answer.error)}</MessageBarBody>
      </MessageBar>
    );
  }
  const a = answer.data;
  const err = preview.error && isApiError(preview.error) ? preview.error : null;
  const errKind = a.status === "needs_repair" ? "needs_repair" : err ? cardErrorKind(err.code) : null;
  const errText = errKind ? (cardErrorText(errKind) ?? errorMessage(preview.error)) : null;
  const visible = preview.data ? visibleResult(preview.data) : null;
  const suppressed = visible ? suppressedNote(visible.hidden, a.min_cell_size) : null;
  const current: CardTab = tab ?? defaultTab(a.viz);
  const open = openInBuilderState(canBuild);
  const saved = savedLabel(a.saved_report_name);

  const copy = async () => {
    if (!visible) return;
    try {
      await navigator.clipboard.writeText(toTsv(visible.result));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const openButton = (
    open.disabled ? (
      <Button appearance="primary" icon={<TableSimple20Regular />} disabled>
        {LABELS.openInBuilder}
      </Button>
    ) : (
      <Button appearance="primary" icon={<TableSimple20Regular />} as="a" href={builderHref(a.id)}>
        {LABELS.openInBuilder}
      </Button>
    )
  );

  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <div className={styles.header}>
            <Subtitle2>{a.question}</Subtitle2>
            <AiBadge agentName={LABELS.analytics} />
          </div>
        }
      />
      {a.assumptions.length > 0 && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{LABELS.assumptions}</MessageBarTitle>
            <ul className={styles.list}>
              {a.assumptions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </MessageBarBody>
        </MessageBar>
      )}
      {errText ? (
        <MessageBar intent={errKind === "needs_repair" ? "warning" : "error"}>
          <MessageBarBody>{errText}</MessageBarBody>
        </MessageBar>
      ) : preview.isPending || !visible ? (
        <Skeleton aria-label="Running the answer">
          <SkeletonItem size={128} />
        </Skeleton>
      ) : (
        <>
          <TabList size="small" selectedValue={current} onTabSelect={(_, d) => setTab(d.value as CardTab)}>
            <Tab value="chart">{LABELS.chart}</Tab>
            <Tab value="table">{LABELS.table}</Tab>
          </TabList>
          {current === "chart" ? (
            <ReportChart result={visible.result} viz={visible.result.viz ?? a.viz} fields={fields} compact />
          ) : (
            <ReportChart result={visible.result} viz={{ type: "table" }} fields={fields} compact />
          )}
          {suppressed && (
            <MessageBar intent="info">
              <MessageBarBody>{suppressed}</MessageBarBody>
            </MessageBar>
          )}
        </>
      )}
      <Explanation text={a.explanation} sourceLabel={a.source_label} />
      {saved && a.saved_report_id && (
        <Link as="a" href={`/reports/custom/${a.saved_report_id}`}>
          {saved}
        </Link>
      )}
      <div className={styles.actions}>
        {open.disabled ? (
          <Tooltip content={open.tooltip ?? ""} relationship="description">
            <span>{openButton}</span>
          </Tooltip>
        ) : (
          openButton
        )}
        <Button icon={<Copy20Regular />} disabled={!visible || !!errText} onClick={copy}>
          {copied ? "Copied" : LABELS.copyTable}
        </Button>
        <Button icon={<ArrowClockwise20Regular />} disabled={a.status !== "ok" || preview.isFetching} onClick={() => preview.refetch()}>
          {LABELS.refresh}
        </Button>
      </div>
    </Card>
  );
}
