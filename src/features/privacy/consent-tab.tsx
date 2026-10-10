"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle2,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, CheckmarkCircle20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { AIProcessingBasis, ConsentNoticeOut, ConsentPurpose } from "@/lib/api/types";
import { fieldErrors } from "@/lib/api/errors";
import { privacyApi, privacyErrorMessage, privacyKeys } from "./api";
import { ALL_CONSENT_PURPOSES, CONSENT_PURPOSE_LABELS } from "./format";
import { MarkdownView } from "./markdown-view";

// Epic 35: the generated `ConsentPurpose` union may lag the backend; every purpose is listed here.
const PURPOSES = ALL_CONSENT_PURPOSES as readonly string[] as ConsentPurpose[];

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "980px" },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  versions: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  version: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  grow: { flex: 1, minWidth: "200px" },
  editor: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    "@media (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  preview: {
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: "200px",
    overflowWrap: "anywhere",
  },
  mono: { "& textarea": { fontFamily: tokens.fontFamilyMonospace } },
});

/** Consent tab: the AI-processing basis and consent notice versions per purpose. */
export function ConsentTab() {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <AiBasisCard />
      <NoticesCard />
    </div>
  );
}

function AiBasisCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("privacy:manage");
  const basis = useQuery({ queryKey: privacyKeys.aiBasis, queryFn: ({ signal }) => privacyApi.aiBasis(signal) });
  const save = useMutation({
    mutationFn: (b: AIProcessingBasis) => privacyApi.setAiBasis(b),
    onSuccess: async (out) => {
      queryClient.setQueryData(privacyKeys.aiBasis, out);
      await queryClient.invalidateQueries({ queryKey: ["ai", "settings"] });
      toast.success("AI-processing basis saved. Candidate consent states are being recalculated.");
    },
    onError: (e) => toast.error(privacyErrorMessage(e)),
  });
  return (
    <Card className={styles.card} id="ai-basis">
      <CardHeader
        header={<Subtitle2 as="h2">AI-processing basis</Subtitle2>}
        description={<Caption1>The legal basis on which candidate data may be processed by AI features.</Caption1>}
      />
      {basis.isPending ? (
        <GridSkeleton rows={2} />
      ) : basis.isError ? (
        <ErrorBar message={privacyErrorMessage(basis.error)} />
      ) : (
        <>
          <RadioGroup
            value={basis.data.basis}
            disabled={!canManage || save.isPending}
            onChange={(_, d) => save.mutate(d.value as AIProcessingBasis)}
            aria-label="AI-processing basis"
          >
            <Radio
              value="consent_required"
              label="Consent required — AI processes a candidate's data only after they grant AI-processing consent"
            />
            <Radio
              value="notice_based"
              label="Notice based — recruiter-sourced candidates (manual, import, API, sourced) are processed under your privacy notice"
            />
          </RadioGroup>
          <MessageBar intent={basis.data.pending_count > 0 ? "warning" : "success"}>
            <MessageBarBody>
              {basis.data.pending_count > 0
                ? `${basis.data.pending_count.toLocaleString()} candidate(s) are waiting for AI consent. Send consent requests from the candidate list.`
                : "No candidates are waiting for AI consent."}
            </MessageBarBody>
          </MessageBar>
          {save.isPending && <Spinner size="tiny" label="Saving" />}
        </>
      )}
    </Card>
  );
}

function NoticesCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("privacy:manage");
  const [purpose, setPurpose] = useState<ConsentPurpose>("ai_processing");
  const [editing, setEditing] = useState<ConsentNoticeOut | "new" | null>(null);
  const [viewing, setViewing] = useState<ConsentNoticeOut | null>(null);
  const notices = useQuery({ queryKey: privacyKeys.notices, queryFn: ({ signal }) => privacyApi.notices(signal) });
  const activate = useMutation({
    mutationFn: (id: string) => privacyApi.activateNotice(id),
    onSuccess: async (n) => {
      toast.success(`Version ${n.version} is now active`);
      await queryClient.invalidateQueries({ queryKey: privacyKeys.notices });
    },
    onError: (e) => toast.error(privacyErrorMessage(e)),
  });
  const versions = (notices.data ?? []).filter((n) => n.purpose === purpose).sort((a, b) => b.version - a.version);
  const active = versions.find((n) => n.active);

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Consent notices</Subtitle2>}
        description={
          <Caption1>Every edit creates a new version. Candidates who already agreed keep the version they saw.</Caption1>
        }
        action={
          canManage ? (
            <Button icon={<Add20Regular />} style={{ whiteSpace: "nowrap" }} onClick={() => setEditing(active ?? "new")}>
              New version
            </Button>
          ) : undefined
        }
      />
      <Field label="Purpose" style={{ maxWidth: "320px" }}>
        <Dropdown
          value={CONSENT_PURPOSE_LABELS[purpose] ?? purpose}
          selectedOptions={[purpose]}
          onOptionSelect={(_, d) => d.optionValue && setPurpose(d.optionValue as ConsentPurpose)}
        >
          {PURPOSES.map((p) => (
            <Option key={p} value={p}>
              {CONSENT_PURPOSE_LABELS[p] ?? p}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {notices.isPending ? (
        <GridSkeleton rows={3} />
      ) : notices.isError ? (
        <ErrorBar message={privacyErrorMessage(notices.error)} />
      ) : versions.length === 0 ? (
        <Body1>No notice for this purpose yet.</Body1>
      ) : (
        <div className={styles.versions}>
          {versions.map((n) => (
            <div key={n.id} className={styles.version}>
              <div className={styles.grow}>
                <Body1>
                  <strong>v{n.version}</strong> · {n.title}
                </Body1>
                <br />
                <Caption1>
                  {n.locale} · {formatDateTime(n.created_at)}
                </Caption1>
              </div>
              {n.active ? (
                <Badge appearance="filled" color="success">
                  Active
                </Badge>
              ) : (
                canManage && (
                  <Button
                    size="small"
                    icon={<CheckmarkCircle20Regular />}
                    disabled={activate.isPending}
                    onClick={() => activate.mutate(n.id)}
                  >
                    Activate
                  </Button>
                )
              )}
              <Button size="small" appearance="subtle" onClick={() => setViewing(n)}>
                Preview
              </Button>
            </div>
          ))}
        </div>
      )}
      <DetailsDrawer open={viewing !== null} title={viewing ? `${viewing.title} (v${viewing.version})` : ""} onClose={() => setViewing(null)} size="medium">
        {viewing && <MarkdownView source={viewing.body_md} />}
      </DetailsDrawer>
      {editing !== null && (
        <NoticeEditor purpose={purpose} base={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}

function NoticeEditor({ purpose, base, onClose }: { purpose: ConsentPurpose; base: ConsentNoticeOut | null; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(base?.title ?? `${CONSENT_PURPOSE_LABELS[purpose]} notice`);
  const [body, setBody] = useState(base?.body_md ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () => privacyApi.createNotice({ purpose, locale: base?.locale ?? "en", title: title.trim(), body_md: body }),
    onSuccess: async (n) => {
      toast.success(`Version ${n.version} saved. Activate it to show it to candidates.`);
      await queryClient.invalidateQueries({ queryKey: privacyKeys.notices });
      onClose();
    },
    onError: (e) => {
      setFields(fieldErrors(e));
      setError(privacyErrorMessage(e));
    },
  });
  return (
    <DetailsDrawer
      open
      size="large"
      title={`New ${(CONSENT_PURPOSE_LABELS[purpose] ?? purpose).toLowerCase()} notice version`}
      onClose={() => !create.isPending && onClose()}
      footer={
        <>
          <Button
            appearance="primary"
            disabled={!title.trim() || !body.trim() || create.isPending}
            icon={create.isPending ? <Spinner size="tiny" /> : undefined}
            onClick={() => create.mutate()}
          >
            Save version
          </Button>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ErrorBar message={error} />
        <Field label="Title" required validationMessage={fields.title} validationState={fields.title ? "error" : "none"}>
          <Input value={title} onChange={(_, d) => setTitle(d.value)} maxLength={200} />
        </Field>
        <div className={styles.editor}>
          <Field
            label="Notice text (Markdown)"
            required
            className={styles.mono}
            hint="Headings (#), lists (-), **bold**, *italic* and [links](https://…) are supported."
            validationMessage={fields.body_md}
            validationState={fields.body_md ? "error" : "none"}
          >
            <Textarea value={body} onChange={(_, d) => setBody(d.value)} rows={18} resize="vertical" maxLength={20000} />
          </Field>
          <div>
            <Caption1>Preview</Caption1>
            <div className={styles.preview} aria-live="polite">
              {body.trim() ? <MarkdownView source={body} /> : <Caption1>Nothing to preview yet.</Caption1>}
            </div>
          </div>
        </div>
      </div>
    </DetailsDrawer>
  );
}
