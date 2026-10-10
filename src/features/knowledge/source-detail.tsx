"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Tab,
  TabList,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { knowledgeApi, knowledgeKeys } from "./api";
import { AUDIENCE_LABELS, canPublish, KIND_LABELS, publishableVersion, STATUS_LABELS, statusColor } from "./logic";
import type { SearchHitOut, SourceDetailOut } from "./types";

const useStyles = makeStyles({
  head: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center", marginBottom: tokens.spacingVerticalM },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginTop: tokens.spacingVerticalM, maxWidth: "880px" },
  pre: { whiteSpace: "pre-wrap", fontFamily: tokens.fontFamilyBase },
  hit: { padding: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
});

function ContentTab({ s, canManage, onSaved }: { s: SourceDetailOut; canManage: boolean; onSaved: () => void }) {
  const styles = useStyles();
  const [body, setBody] = useState(s.current_body_md ?? "");
  const save = useMutation({ mutationFn: () => knowledgeApi.newVersion(s.id, body), onSuccess: onSaved });
  if (s.kind === "file" && !s.current_body_md) {
    return <Body1 className={styles.section}>This source is an uploaded file. Upload a new version to change it.</Body1>;
  }
  return (
    <div className={styles.section}>
      {canManage ? (
        <>
          <Field label="Content (Markdown)">
            <Textarea value={body} rows={16} onChange={(_, d) => setBody(d.value)} />
          </Field>
          <ErrorBar message={save.isError ? errorMessage(save.error) : null} />
          <div>
            <Button appearance="primary" disabled={!body.trim() || body === s.current_body_md || save.isPending} onClick={() => save.mutate()}>
              Save as new version
            </Button>
          </div>
        </>
      ) : (
        <Body1 className={styles.pre}>{s.current_body_md}</Body1>
      )}
    </div>
  );
}

function VersionsTab({ s }: { s: SourceDetailOut }) {
  const styles = useStyles();
  return (
    <div className={styles.section}>
      {s.versions.map((v) => (
        <Card key={v.id} className={styles.hit}>
          <Text weight="semibold">
            Version {v.version_no} {v.published && <Badge color="success">Published</Badge>}
          </Text>
          <Caption1 className={styles.muted}>
            {formatDateTime(v.created_at)} · {v.chunk_count} passages · text {v.extract_status}
          </Caption1>
        </Card>
      ))}
    </div>
  );
}

function TestTab({ s }: { s: SourceDetailOut }) {
  const styles = useStyles();
  const [question, setQuestion] = useState("");
  const search = useMutation({
    mutationFn: () => knowledgeApi.searchPreview(question, s.audience === "candidate" ? "candidate" : s.audience === "internal" ? "internal" : "worker"),
  });
  const hits: SearchHitOut[] = search.data ?? [];
  return (
    <div className={styles.section}>
      <Field label="Ask a question as a Worker would">
        <Input value={question} onChange={(_, d) => setQuestion(d.value)} />
      </Field>
      <div>
        <Button disabled={!question.trim() || search.isPending} onClick={() => search.mutate()}>
          Search
        </Button>
      </div>
      <ErrorBar message={search.isError ? errorMessage(search.error) : null} />
      {search.isSuccess && hits.length === 0 && <Body1 className={styles.muted}>No published source answers this question.</Body1>}
      {hits.map((h) => (
        <Card key={h.citation} className={styles.hit}>
          <Text weight="semibold">{h.title}</Text>
          <Body1 className={styles.pre}>{h.excerpt}</Body1>
        </Card>
      ))}
    </div>
  );
}

export function KnowledgeSourceDetail({ id }: { id: string }) {
  const styles = useStyles();
  const canRead = usePermission("knowledge:read");
  const canManage = usePermission("knowledge:manage");
  const qc = useQueryClient();
  const [tab, setTab] = useState("content");
  const [published, setPublished] = useState(false);
  const q = useQuery({ queryKey: knowledgeKeys.source(id), queryFn: ({ signal }) => knowledgeApi.get(id, signal), enabled: canRead || canManage });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: knowledgeKeys.source(id) });
    void qc.invalidateQueries({ queryKey: knowledgeKeys.list });
  };
  const action = useMutation({
    mutationFn: (kind: "publish" | "unpublish" | "archive") => {
      const s = q.data as SourceDetailOut;
      if (kind === "publish") return knowledgeApi.publish(id, publishableVersion(s) ?? s.current_version_no);
      return kind === "unpublish" ? knowledgeApi.unpublish(id) : knowledgeApi.archive(id);
    },
    onSuccess: (_, kind) => {
      setPublished(kind === "publish");
      refresh();
    },
  });
  if (!canRead && !canManage) return <NoAccess what="knowledge sources" />;
  if (q.isPending) return <GridSkeleton />;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  const s = q.data;
  return (
    <div>
      <PageHeader title={s.title} subtitle={`${KIND_LABELS[s.kind]} · ${AUDIENCE_LABELS[s.audience]}`} />
      <div className={styles.head}>
        <Badge appearance="tint" color={statusColor(s.status)}>
          {STATUS_LABELS[s.status]}
        </Badge>
        {canManage && (
          <>
            <Button appearance="primary" disabled={!canPublish(s) || action.isPending} onClick={() => action.mutate("publish")}>
              Publish
            </Button>
            <Button disabled={s.status !== "published" || action.isPending} onClick={() => action.mutate("unpublish")}>
              Unpublish
            </Button>
            <Button disabled={s.status === "archived" || action.isPending} onClick={() => action.mutate("archive")}>
              Archive
            </Button>
          </>
        )}
      </div>
      {published && (
        <MessageBar intent="success">
          <MessageBarBody>Published. The onboarding assistant can cite this now.</MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar message={action.isError ? errorMessage(action.error) : null} />
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="content">Content</Tab>
        <Tab value="versions">Versions</Tab>
        <Tab value="test">Test a question</Tab>
      </TabList>
      {tab === "content" && <ContentTab key={s.current_version_no} s={s} canManage={canManage} onSaved={refresh} />}
      {tab === "versions" && <VersionsTab s={s} />}
      {tab === "test" && <TestTab s={s} />}
    </div>
  );
}
