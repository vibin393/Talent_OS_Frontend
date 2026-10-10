"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  makeStyles,
  Tab,
  TabList,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useMe } from "@/features/auth/use-me";
import { errorMessage } from "@/lib/api/errors";
import { type InboxView, knowledgeApi, knowledgeKeys } from "./api";
import type { QaThreadOut } from "./types";

const useStyles = makeStyles({
  layout: { display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(0, 2fr)", gap: tokens.spacingHorizontalL, "@media (max-width: 720px)": { gridTemplateColumns: "1fr" } },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  item: { padding: tokens.spacingHorizontalM, cursor: "pointer" },
  selected: { outline: `2px solid ${tokens.colorBrandStroke1}` },
  messages: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  msg: { padding: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
  chips: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
});

const VIEWS: { value: InboxView; label: string }[] = [
  { value: "waiting", label: "Waiting for me" },
  { value: "answered", label: "Answered by assistant" },
  { value: "all", label: "All" },
];

function ThreadView({ id, myName }: { id: string; myName: string }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const canManage = usePermission("onboarding:manage");
  const [text, setText] = useState("");
  const q = useQuery({ queryKey: knowledgeKeys.thread(id), queryFn: ({ signal }) => knowledgeApi.thread(id, signal) });
  const done = (t: QaThreadOut) => {
    qc.setQueryData(knowledgeKeys.thread(id), t);
    void qc.invalidateQueries({ queryKey: ["knowledge", "threads"] });
    setText("");
  };
  const reply = useMutation({ mutationFn: () => knowledgeApi.reply(id, text), onSuccess: done });
  const close = useMutation({ mutationFn: () => knowledgeApi.close(id), onSuccess: done });
  if (q.isPending) return <GridSkeleton />;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  const t = q.data;
  return (
    <div className={styles.messages}>
      <Text weight="semibold">{t.candidate_name}</Text>
      {t.messages.map((m) => (
        <Card key={m.id} className={styles.msg}>
          <Caption1 className={styles.muted}>
            {m.role === "asker" ? t.candidate_name : m.role === "assistant" ? "Onboarding assistant" : m.role === "coordinator" ? "Coordinator" : "System"} ·{" "}
            {formatDateTime(m.created_at)} {m.role === "assistant" && <AiBadge agentName="Onboarding Agent" ownerName={t.coordinator_name} />}
          </Caption1>
          <Body1>{m.text}</Body1>
          {m.citations.length > 0 && (
            <div className={styles.chips}>
              {m.citations.map((c) => (
                <Badge key={c.citation} appearance="outline">
                  {c.kind === "task" ? `Your task: ${c.title}` : `Source: ${c.title}`}
                </Badge>
              ))}
            </div>
          )}
          {m.feedback && <Caption1 className={styles.muted}>Feedback: {m.feedback.replace(/_/g, " ")}</Caption1>}
        </Card>
      ))}
      {canManage && t.status !== "closed" && (
        <>
          <Field label={`Reply as ${myName}`}>
            <Textarea value={text} maxLength={1500} onChange={(_, d) => setText(d.value)} />
          </Field>
          <ErrorBar message={reply.isError ? errorMessage(reply.error) : close.isError ? errorMessage(close.error) : null} />
          <div className={styles.chips}>
            <Button appearance="primary" disabled={!text.trim() || reply.isPending} onClick={() => reply.mutate()}>
              Send reply
            </Button>
            <Button disabled={close.isPending} onClick={() => close.mutate()}>
              Close
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function OnboardingQuestionsInbox({ initialThread }: { initialThread?: string | null }) {
  const styles = useStyles();
  const canRead = usePermission("onboarding:read");
  const { data: me } = useMe();
  const [view, setView] = useState<InboxView>(initialThread ? "all" : "waiting");
  const [selected, setSelected] = useState<string | null>(initialThread ?? null);
  const q = useQuery({ queryKey: knowledgeKeys.threads(view), queryFn: ({ signal }) => knowledgeApi.threads(view, signal), enabled: canRead });
  if (!canRead) return <NoAccess what="onboarding questions" />;
  const rows = q.data ?? [];
  return (
    <div>
      <PageHeader title="Onboarding questions" subtitle="Questions Workers asked in Onboarding help, answered by the assistant or handed to you." />
      <TabList selectedValue={view} onTabSelect={(_, d) => setView(d.value as InboxView)}>
        {VIEWS.map((v) => (
          <Tab key={v.value} value={v.value}>
            {v.label}
          </Tab>
        ))}
      </TabList>
      <ErrorBar message={q.isError ? errorMessage(q.error) : null} />
      {q.isPending && <GridSkeleton />}
      <div className={styles.layout}>
        <div className={styles.list}>
          {q.isSuccess && rows.length === 0 && <Body1 className={styles.muted}>No questions here.</Body1>}
          {rows.map((t) => (
            <Card
              key={t.id}
              className={selected === t.id ? `${styles.item} ${styles.selected}` : styles.item}
              onClick={() => setSelected(t.id)}
              role="button"
              tabIndex={0}
              aria-label={`Question from ${t.candidate_name}`}
            >
              <Text weight="semibold">{t.candidate_name}</Text>
              <Caption1>{t.last_question ?? ""}</Caption1>
              <Caption1 className={styles.muted}>
                {t.status.replace(/_/g, " ")} · {formatDateTime(t.last_message_at)}
              </Caption1>
            </Card>
          ))}
        </div>
        <div>{selected && <ThreadView key={selected} id={selected} myName={me?.user.name ?? "me"} />}</div>
      </div>
    </div>
  );
}
