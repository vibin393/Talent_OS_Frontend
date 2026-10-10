"use client";

import {
  Avatar,
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  InteractionTag,
  InteractionTagPrimary,
  InteractionTagSecondary,
  makeStyles,
  Spinner,
  Tab,
  TabList,
  TagGroup,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import {
  Archive20Regular,
  ArchiveArrowBack20Regular,
  ArrowUpload20Regular,
  Edit20Regular,
  Tag20Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AiConsentControls } from "@/features/privacy/consent-request";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { UserPicker } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import { isApiError } from "@/lib/api/errors";
import type { Candidate360Out } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { CandidateApplications } from "@/features/pipeline/candidate-applications";
import { ActivityTab } from "./activity-tab";
import { AiInsightsTab } from "./ai-insights-tab";
import { AttachmentsTab } from "./attachments-tab";
import { DocumentsPanel } from "@/features/documents/documents-panel";
import { CandidateFormDrawer } from "./candidate-form-drawer";
import { candidateErrorMessage } from "./errors";
import { formatRole } from "./format";
import { ProfileTab } from "./profile-tab";
import { ResumesTab } from "./resumes-tab";
import { SkillsTab } from "./skills-tab";
import { TagNamesPicker } from "./tags-picker";
import { useCandidateMutation } from "./use-candidates";
import { candidateComposeContext } from "@/features/comms/compose-contexts";
import { EmailButton } from "@/features/comms/email-button";
import { EntityTasksCard } from "@/features/tasks/entity-tasks-card";
import { MessagesCard, SendMessageButton } from "@/features/messaging/messages-card";
import { CandidatePoolMenu } from "@/features/talent-pools/add-to-pool-menu";
import { CandidateAssessmentsTab } from "@/features/assessments/candidate-tab";
import { ReferredByBadge } from "@/features/referrals/referred-by-badge";

const useStyles = makeStyles({
  header: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalL,
    alignItems: "flex-start",
    marginBottom: tokens.spacingVerticalM,
  },
  identity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, flex: "1 1 320px", minWidth: 0 },
  idLine: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  owner: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end", minWidth: "260px" },
  tags: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap", marginTop: tokens.spacingVerticalXS },
  tabs: {
    marginBottom: tokens.spacingVerticalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    overflowX: "auto",
  },
});

export type CandidateTab = "profile" | "resumes" | "skills" | "applications" | "activity" | "attachments" | "documents" | "ai" | "assessments";

const TABS: { id: CandidateTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "resumes", label: "Resumes" },
  { id: "skills", label: "Skills" },
  { id: "applications", label: "Applications" },
  { id: "activity", label: "Notes & Activity" },
  { id: "attachments", label: "Attachments" },
  { id: "documents", label: "Documents" },
  { id: "ai", label: "AI Insights" },
  // Epic 40
  { id: "assessments", label: "Assessments" },
];

/** Candidate 360: header (identity, owner, tags, actions) and tabbed detail. */
export function Candidate360({ id }: { id: string }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const canRead = usePermission("candidate:read");
  const canReadDocs = usePermission("document:read");
  const canReadAssessments = usePermission("assessment:read");
  const [tab, setTab] = useState<CandidateTab>("profile");

  const query = useQuery({
    queryKey: candidateKeys.detail(id),
    queryFn: ({ signal }) => candidatesApi.get(id, signal),
    enabled: canRead,
    retry: (count, e) => !(isApiError(e) && e.status < 500) && count < 2,
  });
  const c = query.data;

  // A merged profile redirects to the survivor.
  const redirected = useRef(false);
  useEffect(() => {
    if (c?.merged_into_id && !redirected.current) {
      redirected.current = true;
      toast.info(`${c.human_id} was merged into another profile. Showing the surviving profile.`);
      router.replace(`/candidates/${c.merged_into_id}`);
    }
  }, [c, router, toast]);

  if (!canRead) return <NoAccess what="candidates" />;
  if (query.isPending) return <GridSkeleton rows={6} />;
  if (query.isError) {
    return (
      <>
        <ErrorBar
          title="Could not load the candidate."
          message={isApiError(query.error) && query.error.status === 404 ? "This candidate does not exist or you do not have access to it." : candidateErrorMessage(query.error)}
        />
        <p>
          <AppLink href="/candidates">Back to candidates</AppLink>
        </p>
      </>
    );
  }
  if (!c || c.merged_into_id) return <Spinner label="Opening the surviving profile…" />;

  return (
    <>
      <CandidateHeader c={c} onUploadResume={() => setTab("resumes")} />
      <TabList
        selectedValue={tab}
        onTabSelect={(_, d) => setTab(d.value as CandidateTab)}
        aria-label="Candidate sections"
        className={styles.tabs}
      >
        {TABS.filter((t) => (t.id !== "documents" || canReadDocs) && (t.id !== "assessments" || canReadAssessments)).map((t) => (
          <Tab key={t.id} value={t.id}>
            {t.label}
            {t.id === "resumes" && c.counts.resumes ? ` (${c.counts.resumes})` : ""}
            {t.id === "attachments" && c.counts.attachments ? ` (${c.counts.attachments})` : ""}
            {t.id === "skills" && c.counts.skills ? ` (${c.counts.skills})` : ""}
          </Tab>
        ))}
      </TabList>
      {tab === "profile" && (
        <>
          <ProfileTab c={c} />
          <EntityTasksCard entityType="candidate" entityId={c.id} />
          <MessagesCard recipient={{ entity_type: "candidate", entity_id: c.id }} name={c.full_name} />
        </>
      )}
      {tab === "resumes" && <ResumesTab c={c} />}
      {tab === "skills" && <SkillsTab c={c} />}
      {tab === "applications" && <CandidateApplications candidateId={c.id} />}
      {tab === "activity" && <ActivityTab candidateId={c.id} />}
      {tab === "attachments" && <AttachmentsTab c={c} />}
      {tab === "documents" && <DocumentsPanel ownerKind="candidate" ownerId={c.id} ownerName={c.full_name} />}
      {tab === "ai" && <AiInsightsTab candidateId={c.id} />}
      {tab === "assessments" && <CandidateAssessmentsTab candidateId={c.id} candidateName={c.full_name} />}
    </>
  );
}

function CandidateHeader({ c, onUploadResume }: { c: Candidate360Out; onUploadResume: () => void }) {
  const styles = useStyles();
  const canUpdatePerm = usePermission("candidate:update");
  const canDelete = usePermission("candidate:delete");
  const canReadUsers = usePermission("user:read");
  const canEdit = canUpdatePerm && c.can_edit !== false;
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [tagging, setTagging] = useState(false);
  const invalidate = [candidateKeys.detail(c.id), candidateKeys.lists];

  const setOwner = useCandidateMutation({
    mutationFn: (ownerId: string) => candidatesApi.update(c.id, { owner_id: ownerId }),
    invalidate,
    success: (r) => `Owner changed to ${r.owner_name ?? "the selected user"}`,
    toastErrors: true,
  });
  const toggleArchive = useCandidateMutation({
    mutationFn: () => (c.archived_at ? candidatesApi.unarchive(c.id) : candidatesApi.archive(c.id)),
    invalidate,
    success: (r) => (r.archived_at ? `${r.full_name} archived` : `${r.full_name} restored`),
    toastErrors: true,
  });
  const removeTag = useCandidateMutation({
    mutationFn: (tagId: string) => candidatesApi.removeTag(c.id, tagId),
    invalidate,
    toastErrors: true,
  });

  return (
    <div className={styles.header}>
      <Avatar name={c.full_name} size={64} color="colorful" aria-hidden />
      <div className={styles.identity}>
        <div className={styles.idLine}>
          <Title2 as="h1">{c.full_name}</Title2>
          <Badge appearance="outline" color="informative">
            {c.human_id}
          </Badge>
          {c.archived_at && (
            <Badge appearance="tint" color="subtle">
              Archived
            </Badge>
          )}
          <AiConsentControls candidateId={c.id} state={c.ai_consent_state} />
          <ReferredByBadge candidateId={c.id} />
        </div>
        <Text size={400}>{formatRole(c.current_title, c.current_employer)}</Text>
        <div className={styles.tags}>
          {c.tags.length > 0 && (
            <TagGroup
              aria-label="Tags"
              onDismiss={canEdit ? (_, d) => removeTag.mutate(String(d.value)) : undefined}
            >
              {c.tags.map((t) => (
                <InteractionTag key={t.id} value={t.id} size="small" shape="rounded">
                  <InteractionTagPrimary hasSecondaryAction={canEdit}>{t.name}</InteractionTagPrimary>
                  {canEdit && <InteractionTagSecondary aria-label={`Remove tag ${t.name}`} />}
                </InteractionTag>
              ))}
            </TagGroup>
          )}
          {canEdit && (
            <Button size="small" appearance="subtle" icon={<Tag20Regular />} onClick={() => setTagging(true)}>
              Add tags
            </Button>
          )}
        </div>
      </div>
      <div className={styles.owner}>
        <Avatar name={c.owner_name ?? undefined} size={32} aria-hidden />
        {canEdit && canReadUsers ? (
          <UserPicker
            label="Owner"
            value={c.owner_id}
            valueLabel={c.owner_name ?? ""}
            disabled={setOwner.isPending}
            onChange={(id) => {
              if (id && id !== c.owner_id) setOwner.mutate(id);
            }}
          />
        ) : (
          <div>
            <Caption1 className={styles.muted}>Owner</Caption1>
            <Body1 as="p" style={{ margin: 0 }}>{c.owner_name ?? "—"}</Body1>
          </div>
        )}
      </div>
      <div className={styles.actions}>
        <EmailButton context={() => candidateComposeContext(c)} disabled={!!c.archived_at} />
        <SendMessageButton recipients={() => [{ entity_type: "candidate", entity_id: c.id, label: c.full_name }]} disabled={!!c.archived_at} />
        {canEdit && (
          <Button icon={<Edit20Regular />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {canEdit && (
          <Button icon={<ArrowUpload20Regular />} onClick={onUploadResume}>
            Upload resume
          </Button>
        )}
        {canDelete && (
          <Button
            icon={c.archived_at ? <ArchiveArrowBack20Regular /> : <Archive20Regular />}
            onClick={() => setArchiving(true)}
          >
            {c.archived_at ? "Unarchive" : "Archive"}
          </Button>
        )}
        <CandidatePoolMenu candidateId={c.id} disabled={!!c.archived_at} />
      </div>

      {editing && <CandidateFormDrawer candidate={c} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={archiving}
        title={c.archived_at ? "Unarchive candidate?" : "Archive candidate?"}
        confirmLabel={c.archived_at ? "Unarchive" : "Archive"}
        onClose={() => setArchiving(false)}
        onConfirm={() => toggleArchive.mutateAsync(undefined)}
      >
        {c.archived_at
          ? `${c.full_name} will appear in candidate lists and searches again.`
          : `${c.full_name} will be hidden from candidate lists and searches. The profile and its history are kept.`}
      </ConfirmDialog>
      {tagging && <AddTagsDialog candidateId={c.id} onClose={() => setTagging(false)} />}
    </div>
  );
}

function AddTagsDialog({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const save = useCandidateMutation({
    mutationFn: () => candidatesApi.addTags(candidateId, names),
    invalidate: [candidateKeys.detail(candidateId), ["tags"]],
    success: "Tags added",
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add tags</DialogTitle>
          <DialogContent>
            <ErrorBar message={error} />
            <TagNamesPicker label="Tags" value={names} onChange={setNames} hint="New tags are created automatically." />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={names.length === 0 || save.isPending}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setError(null);
                try {
                  await save.mutateAsync(undefined);
                  onClose();
                } catch (e) {
                  setError(candidateErrorMessage(e));
                }
              }}
            >
              Add
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
