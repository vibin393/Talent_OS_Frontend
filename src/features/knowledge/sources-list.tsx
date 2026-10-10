"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { knowledgeApi, knowledgeKeys } from "./api";
import { AUDIENCE_LABELS, KIND_LABELS, STATUS_LABELS, statusColor } from "./logic";
import type { Audience } from "./types";

const useStyles = makeStyles({
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", marginBottom: tokens.spacingVerticalM },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  empty: { padding: tokens.spacingVerticalXXL, color: tokens.colorNeutralForeground3 },
  wrap: { overflowX: "auto" },
});

const AUDIENCES: Audience[] = ["worker", "candidate", "both", "internal"];

function NewSourceDialog({ mode, onClose }: { mode: "article" | "file"; onClose: () => void }) {
  const styles = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<Audience>("both");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const create = useMutation({
    mutationFn: () =>
      mode === "file" && file ? knowledgeApi.upload(title, audience, file) : knowledgeApi.create({ title, audience, body_md: body || null }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: knowledgeKeys.list });
      router.push(`/settings/knowledge/${s.id}`);
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{mode === "file" ? "Upload file" : "New article"}</DialogTitle>
          <DialogContent className={styles.form}>
            <Field label="Title" required>
              <Input value={title} maxLength={200} onChange={(_, d) => setTitle(d.value)} />
            </Field>
            <Field label="Audience">
              <Dropdown value={AUDIENCE_LABELS[audience]} selectedOptions={[audience]} onOptionSelect={(_, d) => setAudience(d.optionValue as Audience)}>
                {AUDIENCES.map((a) => (
                  <Option key={a} value={a}>
                    {AUDIENCE_LABELS[a]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {mode === "file" ? (
              <Field label="File (PDF, DOCX or TXT, up to 10 MB)" required>
                <input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </Field>
            ) : (
              <Field label="Content (Markdown)">
                <Textarea value={body} rows={10} onChange={(_, d) => setBody(d.value)} />
              </Field>
            )}
            <ErrorBar message={create.isError ? errorMessage(create.error) : null} />
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!title.trim() || (mode === "file" && !file) || create.isPending} onClick={() => create.mutate()}>
              Create
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function KnowledgeSourcesList() {
  const styles = useStyles();
  const canRead = usePermission("knowledge:read");
  const canManage = usePermission("knowledge:manage");
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"article" | "file" | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const q = useQuery({ queryKey: knowledgeKeys.list, queryFn: ({ signal }) => knowledgeApi.list(signal), enabled: canRead || canManage });
  const importer = useMutation({
    mutationFn: () => knowledgeApi.importOnboarding(),
    onSuccess: (r) => {
      setImported(`${r.created} draft source${r.created === 1 ? "" : "s"} created from onboarding templates.`);
      void qc.invalidateQueries({ queryKey: knowledgeKeys.list });
    },
  });
  if (!canRead && !canManage) return <NoAccess what="knowledge sources" />;
  const rows = q.data ?? [];
  return (
    <div>
      <PageHeader title="Knowledge sources" subtitle="Onboarding articles, policies and FAQs the onboarding assistant may cite." />
      {canManage && (
        <div className={styles.actions}>
          <Button appearance="primary" onClick={() => setDialog("article")}>
            New article
          </Button>
          <Button onClick={() => setDialog("file")}>Upload file</Button>
          <Button disabled={importer.isPending} onClick={() => importer.mutate()}>
            Import from onboarding templates
          </Button>
        </div>
      )}
      {imported && (
        <MessageBar intent="success">
          <MessageBarBody>{imported}</MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar message={q.isError ? errorMessage(q.error) : importer.isError ? errorMessage(importer.error) : null} />
      {q.isPending && <GridSkeleton />}
      {q.isSuccess && rows.length === 0 && <div className={styles.empty}>No knowledge sources yet.</div>}
      {rows.length > 0 && (
        <div className={styles.wrap}>
          <Table aria-label="Knowledge sources" size="small">
            <TableHeader>
              <TableRow>
                {["Title", "Type", "Audience", "Status", "Version", "Last reviewed"].map((h) => (
                  <TableHeaderCell key={h}>{h}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <AppLink href={`/settings/knowledge/${s.id}`}>{s.title}</AppLink>
                  </TableCell>
                  <TableCell>{KIND_LABELS[s.kind]}</TableCell>
                  <TableCell>{AUDIENCE_LABELS[s.audience]}</TableCell>
                  <TableCell>
                    <Badge appearance="tint" color={statusColor(s.status)}>
                      {STATUS_LABELS[s.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.published_version_no ?? s.current_version_no}</TableCell>
                  <TableCell>{s.last_reviewed_on ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {dialog && <NewSourceDialog mode={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
