"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  Switch,
  Tag,
  TagGroup,
  Text,
  Textarea,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, ArrowUpload20Regular, Delete20Regular, Save20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { OptionCombobox } from "@/features/campaigns/option-combobox";
import { useMarketingOptions } from "@/features/campaigns/use-marketing";
import { EnrolDialog } from "@/features/sequences/enrol-dialog";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { audienceKeys, audiencesApi } from "./api";
import { AudienceStatusBadge } from "./audiences-view";
import { ListImportDialog } from "./list-import-dialog";
import { addSource, removeSource, sameSources, type SourceDraft, sourcesFromAudience, sourcesToPayload } from "./logic";
import { ReachPreviewCard } from "./reach-preview";
import type { AudienceOut, SourceKind, SourceMode } from "./types";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
    "@media (max-width: 1100px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  col: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, minWidth: 0 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  pickers: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalM, "@media (max-width: 600px)": { gridTemplateColumns: "1fr" } },
  muted: { color: tokens.colorNeutralForeground3 },
  listRow: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** `/marketing/audiences/[id]`: builder (Include / Exclude), list import and reach preview. */
export function AudienceDetail({ audienceId }: { audienceId: string }) {
  const styles = useStyles();
  const canRead = usePermission("campaign:read");
  const query = useQuery({
    queryKey: audienceKeys.detail(audienceId),
    queryFn: ({ signal }) => audiencesApi.get(audienceId, signal),
    enabled: canRead,
  });
  if (!canRead) return <NoAccess what="audiences" />;
  const back = (
    <div className={styles.back}>
      <AppLink href="/marketing/audiences">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Audiences
      </AppLink>
    </div>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <GridSkeleton rows={6} />
      </>
    );
  if (query.isError)
    return (
      <>
        {back}
        {isApiError(query.error) && query.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader header={<Subtitle2 as="h1">Audience not found</Subtitle2>} description={<Body1>It may have been archived.</Body1>} />
          </Card>
        ) : (
          <ErrorBar title="Could not load this audience." message={errorMessage(query.error)} />
        )}
      </>
    );
  return (
    <>
      {back}
      <AudienceEditor key={query.data.updated_at} audience={query.data} />
    </>
  );
}

function AudienceEditor({ audience }: { audience: AudienceOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const router = useRouter();
  const qc = useQueryClient();
  const canWrite = usePermission("campaign:write");
  const options = useMarketingOptions();
  const [name, setName] = useState(audience.name);
  const [description, setDescription] = useState(audience.description ?? "");
  const [sources, setSources] = useState<SourceDraft[]>(() => sourcesFromAudience(audience));
  const [importMode, setImportMode] = useState<SourceMode | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const readOnly = !canWrite || audience.status === "archived";
  const original = sourcesFromAudience(audience);
  const dirty = name.trim() !== audience.name || (description.trim() || null) !== (audience.description ?? null) || !sameSources(sources, original);
  const invalidate = () => qc.invalidateQueries({ queryKey: audienceKeys.all });

  const preview = useMutation({ mutationFn: () => audiencesApi.preview(audience.id) });
  const save = useMutation({
    mutationFn: () =>
      audiencesApi.update(audience.id, { name: name.trim(), description: description.trim() || null, sources: sourcesToPayload(sources) }),
    onSuccess: () => {
      toast.success("Audience saved.");
      preview.reset();
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Could not save the audience.")),
  });
  const setStatus = useMutation({
    mutationFn: (status: "draft" | "active") => audiencesApi.update(audience.id, { status }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(errorMessage(e, "Could not change the status.")),
  });

  const pick = (mode: SourceMode, kind: SourceKind) => (o: { id: string; name: string } | null) => {
    if (o) setSources((s) => addSource(s, { mode, kind, id: o.id, name: o.name }));
  };

  const section = (mode: SourceMode) => {
    const list = sources.filter((s) => s.mode === mode);
    const listCount = mode === "include" ? audience.include_list_count : audience.exclude_list_count;
    return (
      <Card>
        <CardHeader
          header={<Subtitle2 as="h2">{mode === "include" ? "Include" : "Exclude"}</Subtitle2>}
          description={
            <Caption1 className={styles.muted}>
              {mode === "include" ? "Anyone in these pools, segments or lists." : "Removed even if they are included."}
            </Caption1>
          }
        />
        {list.length > 0 ? (
          <TagGroup
            aria-label={mode === "include" ? "Included sources" : "Excluded sources"}
            onDismiss={readOnly ? undefined : (_, d) => {
              const [kind, id] = String(d.value).split(":");
              setSources((s) => removeSource(s, { mode, kind: kind as SourceKind, id }));
            }}
          >
            {list.map((s) => (
              <Tag key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`} dismissible={!readOnly} secondaryText={s.kind === "pool" ? "Pool" : "Segment"}>
                {s.name}
              </Tag>
            ))}
          </TagGroup>
        ) : (
          <Text className={styles.muted}>No pools or segments.</Text>
        )}
        {!readOnly && (
          <div className={styles.pickers}>
            <OptionCombobox label="Add a pool" placeholder="Search pools" options={options.data?.pools ?? []} onChange={pick(mode, "pool")} />
            <OptionCombobox
              label="Add a segment"
              placeholder="Search segments"
              options={options.data?.segments ?? []}
              onChange={pick(mode, "segment")}
            />
          </div>
        )}
        <div className={styles.listRow}>
          <Text>
            Imported list: <strong>{listCount.toLocaleString()}</strong> {listCount === 1 ? "person" : "people"}
          </Text>
          {!readOnly && (
            <Button size="small" icon={<ArrowUpload20Regular />} onClick={() => setImportMode(mode)}>
              Import list
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <>
      <div className={styles.header}>
        <Title2 as="h1">{audience.name}</Title2>
        <AudienceStatusBadge status={audience.status} />
        <span className={styles.grow} />
        <div className={styles.actions}>
          {!readOnly && (
            <Switch
              label="Active"
              checked={audience.status === "active"}
              disabled={setStatus.isPending}
              onChange={(_, d) => setStatus.mutate(d.checked ? "active" : "draft")}
            />
          )}
          {canWrite && audience.status !== "archived" && (
            <Button onClick={() => setEnrolling(true)}>Enrol in sequence</Button>
          )}
          {!readOnly && (
            <Button icon={<Delete20Regular />} onClick={() => setArchiving(true)}>
              Archive
            </Button>
          )}
          {!readOnly && (
            <Button appearance="primary" icon={<Save20Regular />} disabled={!dirty || !name.trim() || save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          )}
        </div>
      </div>
      <div className={styles.layout}>
        <div className={styles.col}>
          <Card>
            <div className={styles.form}>
              <Field label="Name" required validationState={name.trim() ? "none" : "error"} validationMessage={name.trim() ? undefined : "Enter a name."}>
                <Input value={name} maxLength={200} disabled={readOnly} onChange={(_, d) => setName(d.value)} />
              </Field>
              <Field label="Description">
                <Textarea value={description} maxLength={2000} disabled={readOnly} onChange={(_, d) => setDescription(d.value)} />
              </Field>
            </div>
          </Card>
          {section("include")}
          {section("exclude")}
        </div>
        <div className={styles.col}>
          {dirty && (
            <MessageBar intent="info">
              <MessageBarBody>Save your changes to include them in the preview.</MessageBarBody>
            </MessageBar>
          )}
          <ReachPreviewCard preview={preview.data} loading={preview.isPending} error={preview.error} onRun={() => preview.mutate()} />
        </div>
      </div>
      {importMode && (
        <ListImportDialog audienceId={audience.id} defaultMode={importMode} onClose={() => setImportMode(null)} onApplied={invalidate} />
      )}
      {enrolling && <EnrolDialog audienceId={audience.id} title={`Enrol ${audience.name}`} onClose={() => setEnrolling(false)} />}
      <ConfirmDialog
        open={archiving}
        title="Archive this audience?"
        confirmLabel="Archive"
        onClose={() => setArchiving(false)}
        onConfirm={async () => {
          try {
            await audiencesApi.archive(audience.id);
            toast.success("Audience archived.");
            invalidate();
            router.push("/marketing/audiences");
          } catch (e) {
            toast.error(errorMessage(e, "Could not archive the audience."));
            throw e;
          }
        }}
      >
        Campaigns already sent keep their recipients. You cannot use an archived audience for new campaigns.
      </ConfirmDialog>
    </>
  );
}
