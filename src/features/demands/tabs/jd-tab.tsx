"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  mergeClasses,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowCounterclockwise20Regular,
  Dismiss20Regular,
  Globe20Regular,
  GlobeProhibited20Regular,
  Save20Regular,
  ShieldCheckmark20Regular,
  Sparkle20Regular,
} from "@fluentui/react-icons";
import { Fragment, useEffect, useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { ApplyQuestionsButton } from "@/features/careers/admin/apply-questions-editor";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { BiasMatchOut, DemandOut, JdKind, JdVersionOut } from "@/lib/api/types";
import { demandErrorMessage } from "../errors";
import {
  useBiasCheck,
  useGenerateJd,
  useJdVersions,
  usePosting,
  usePublish,
  useRestoreJd,
  useSaveJd,
  useUnpublish,
} from "../use-jd-versions";

export const JD_KINDS: readonly JdKind[] = [
  "full",
  "short",
  "posting",
  "recruiter_summary",
  "screening_questions",
  "interview_questions",
  "boolean",
];

export const JD_KIND_LABELS: Record<JdKind, string> = {
  full: "Full JD",
  short: "Short JD",
  posting: "Job posting",
  recruiter_summary: "Recruiter summary",
  screening_questions: "Screening questions",
  interview_questions: "Interview questions",
  boolean: "Boolean search string",
};

const PUBLISHABLE: readonly JdKind[] = ["full", "posting"];

const useStyles = makeStyles({
  root: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
    "@media (max-width: 899px)": { gridTemplateColumns: "1fr" },
  },
  surface: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingHorizontalM,
  },
  versions: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  version: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    width: "100%",
    textAlign: "start",
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    color: tokens.colorNeutralForeground1,
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
  },
  selected: { backgroundColor: tokens.colorSubtleBackgroundSelected },
  line: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  editor: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  toolbar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  textarea: { minHeight: "360px", fontFamily: tokens.fontFamilyBase },
  mark: { backgroundColor: tokens.colorPaletteYellowBackground2, color: tokens.colorNeutralForeground1, borderRadius: tokens.borderRadiusSmall },
  preview: {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    maxHeight: "240px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  matches: { margin: 0, paddingLeft: tokens.spacingHorizontalL },
});

/** Text with bias matches highlighted (`<mark>`). */
function Highlighted({ text, matches }: { text: string; matches: readonly BiasMatchOut[] }) {
  const styles = useStyles();
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let at = 0;
  sorted.forEach((m, i) => {
    if (m.start < at) return;
    parts.push(<Fragment key={`t${i}`}>{text.slice(at, m.start)}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className={styles.mark} title={m.category}>
        {text.slice(m.start, m.end)}
      </mark>,
    );
    at = m.end;
  });
  parts.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <div className={styles.preview}>{parts}</div>;
}

function MatchList({ matches }: { matches: readonly BiasMatchOut[] }) {
  const styles = useStyles();
  return (
    <ul className={styles.matches}>
      {matches.map((m, i) => (
        <li key={i}>
          “{m.term}” <Badge appearance="tint" color="warning" size="small">{m.category}</Badge>
        </li>
      ))}
    </ul>
  );
}

function PublishDialog({
  demand,
  version,
  onClose,
}: {
  demand: DemandOut;
  version: JdVersionOut;
  onClose: () => void;
}) {
  const toast = useAppToast();
  const bias = useBiasCheck(demand.id);
  const publish = usePublish(demand.id);
  const [showRate, setShowRate] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [showClient, setShowClient] = useState(false);
  const [ack, setAck] = useState(false);
  const [matches, setMatches] = useState<BiasMatchOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canShowRate = !(demand.masked_fields ?? []).includes("bill_rate");

  const { mutateAsync: check } = bias;
  useEffect(() => {
    check(version.id)
      .then((r) => setMatches(r.matches))
      .catch(() => setMatches([]));
  }, [check, version.id]);

  const submit = async () => {
    setError(null);
    try {
      await publish.mutateAsync({
        jd_version_id: version.id,
        show_rate: canShowRate && showRate,
        show_location: showLocation,
        show_client_name: showClient,
        acknowledge_bias_flags: ack,
      });
      toast.success(`Published version ${version.version_no}`);
      onClose();
    } catch (e) {
      if (isApiError(e) && e.code === "bias_flags_unacknowledged" && Array.isArray(e.details.matches)) {
        setMatches(e.details.matches as BiasMatchOut[]);
      }
      setError(demandErrorMessage(e));
    }
  };

  const flagged = (matches?.length ?? 0) > 0;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !publish.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Publish job posting</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <Body1>
              Version {version.version_no} ({JD_KIND_LABELS[version.kind]}) goes live on the career portal. Only one version is
              published at a time.
            </Body1>
            <ErrorBar message={error} />
            {matches === null ? (
              <Spinner size="tiny" label="Checking wording…" />
            ) : flagged ? (
              <MessageBar intent="warning" layout="multiline">
                <MessageBarBody>
                  <MessageBarTitle>Possibly biased wording</MessageBarTitle>
                  <MatchList matches={matches} />
                </MessageBarBody>
              </MessageBar>
            ) : (
              <MessageBar intent="success">
                <MessageBarBody>No flagged wording found.</MessageBarBody>
              </MessageBar>
            )}
            {canShowRate && <Switch label="Show the rate" checked={showRate} onChange={(_, d) => setShowRate(d.checked)} />}
            <Switch label="Show the location" checked={showLocation} onChange={(_, d) => setShowLocation(d.checked)} />
            <Switch label="Show the client name" checked={showClient} onChange={(_, d) => setShowClient(d.checked)} />
            {flagged && (
              <Checkbox
                checked={ack}
                onChange={(_, d) => setAck(!!d.checked)}
                label="I reviewed the flagged wording and want to publish anyway"
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              icon={publish.isPending ? <Spinner size="tiny" /> : <Globe20Regular />}
              disabled={publish.isPending || matches === null || (flagged && !ack)}
              onClick={submit}
            >
              Publish
            </Button>
            <Button appearance="secondary" disabled={publish.isPending} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/**
 * JD versions: list (AI/User author, Published marker) and an editor that always saves a new version.
 * "Generate" asks the AI for one of seven kinds; Restore copies an older version into a new one;
 * Bias check highlights flagged wording; Publish / Unpublish manage the job posting.
 */
export function JdTab({
  demand,
  canUpdate,
  publishRequested,
  onPublishHandled,
}: {
  demand: DemandOut;
  canUpdate: boolean;
  publishRequested?: boolean;
  onPublishHandled?: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const versions = useJdVersions(demand.id);
  const posting = usePosting(demand.id);
  const save = useSaveJd(demand.id);
  const generate = useGenerateJd(demand.id);
  const restore = useRestoreJd(demand.id);
  const bias = useBiasCheck(demand.id);
  const unpublish = useUnpublish(demand.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ kind: JdKind; content: string } | null>(null);
  const [matches, setMatches] = useState<BiasMatchOut[] | null>(null);
  const [publishing, setPublishing] = useState<JdVersionOut | null>(null);
  const [aiDown, setAiDown] = useState(false);

  const list = versions.data ?? [];
  const selected = list.find((v) => v.id === selectedId) ?? list[0] ?? null;
  const editable = canUpdate && !["cancelled", "closed"].includes(demand.status) && !demand.archived_at;
  const kind = draft?.kind ?? selected?.kind ?? "full";
  const content = draft?.content ?? selected?.content ?? "";
  const dirty = draft !== null && (draft.content !== (selected?.content ?? "") || draft.kind !== (selected?.kind ?? "full"));
  const livePosting = posting.data && posting.data.is_live ? posting.data : null;
  const publishable = (v: JdVersionOut | null) => !!v && PUBLISHABLE.includes(v.kind);
  const canPublish = canUpdate && demand.status === "open";

  // "Publish" in the header lands here: open the dialog for the selected (or newest publishable) version.
  const requested =
    publishRequested && !versions.isPending
      ? publishable(selected)
        ? selected
        : (list.find((v) => publishable(v)) ?? null)
      : null;
  const dialogVersion = publishing ?? requested;

  const select = (v: JdVersionOut) => {
    setSelectedId(v.id);
    setDraft(null);
    setMatches(null);
  };

  const run = async <T,>(p: Promise<T>, ok: (r: T) => string) => {
    try {
      const r = await p;
      toast.success(ok(r));
      return r;
    } catch (e) {
      if (isApiError(e) && e.code === "ai_unavailable") setAiDown(true);
      else toast.error(demandErrorMessage(e));
      return null;
    }
  };

  if (versions.isPending) return <GridSkeleton rows={6} />;
  if (versions.isError) return <ErrorBar title="Could not load JD versions." message={errorMessage(versions.error)} />;

  return (
    <div className={styles.root}>
      <section className={styles.surface} aria-label="Versions">
        <Subtitle2 as="h2">Versions</Subtitle2>
        {list.length === 0 ? (
          <Body1 className={styles.muted}>No versions yet. Write one or generate it with AI.</Body1>
        ) : (
          <ul className={styles.versions}>
            {list.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={mergeClasses(styles.version, selected?.id === v.id && styles.selected)}
                  aria-current={selected?.id === v.id}
                  onClick={() => select(v)}
                >
                  <span className={styles.line}>
                    <Text weight="semibold">v{v.version_no}</Text>
                    <Text>{JD_KIND_LABELS[v.kind]}</Text>
                  </span>
                  <span className={styles.line}>
                    <Badge size="small" appearance="tint" color={v.author_type === "ai" ? "brand" : "subtle"} icon={v.author_type === "ai" ? <Sparkle20Regular /> : undefined}>
                      {v.author_type === "ai" ? "AI" : "User"}
                    </Badge>
                    {v.is_published && (
                      <Badge size="small" appearance="filled" color="success" icon={<Globe20Regular />}>
                        Published
                      </Badge>
                    )}
                    {v.restored_from_id && (
                      <Caption1 className={styles.muted}>restored</Caption1>
                    )}
                  </span>
                  <Caption1 className={styles.muted}>{formatDateTime(v.created_at)}</Caption1>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={mergeClasses(styles.surface, styles.editor)} aria-label="Editor">
        {publishRequested && !versions.isPending && !requested && (
          <MessageBar intent="info">
            <MessageBarBody>Save or generate a full JD or job posting first, then publish it.</MessageBarBody>
            <MessageBarActions
              containerAction={<Button appearance="transparent" size="small" aria-label="Dismiss" icon={<Dismiss20Regular />} onClick={onPublishHandled} />}
            />
          </MessageBar>
        )}
        {aiDown && (
          <MessageBar intent="warning">
            <MessageBarBody>The AI assistant is unavailable right now. You can still write the JD yourself.</MessageBarBody>
          </MessageBar>
        )}
        {livePosting && (
          <MessageBar intent="success">
            <MessageBarBody>
              Live on the career portal since {formatDateTime(livePosting.published_at)} (version{" "}
              {list.find((v) => v.id === livePosting.jd_version_id)?.version_no ?? "?"}).
            </MessageBarBody>
            {canUpdate && (
              <MessageBarActions>
                <ApplyQuestionsButton demandId={demand.id} postingId={livePosting.id} />
              </MessageBarActions>
            )}
          </MessageBar>
        )}
        <div className={styles.toolbar}>
          <Field label="Kind">
            <Dropdown
              disabled={!editable}
              value={JD_KIND_LABELS[kind]}
              selectedOptions={[kind]}
              onOptionSelect={(_, d) => d.optionValue && setDraft({ kind: d.optionValue as JdKind, content })}
            >
              {JD_KINDS.map((k) => (
                <Option key={k} value={k}>
                  {JD_KIND_LABELS[k]}
                </Option>
              ))}
            </Dropdown>
          </Field>
          {editable && (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button icon={generate.isPending ? <Spinner size="tiny" /> : <Sparkle20Regular />} disabled={generate.isPending}>
                  Generate
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {JD_KINDS.map((k) => (
                    <MenuItem
                      key={k}
                      onClick={async () => {
                        setAiDown(false);
                        const v = await run(generate.mutateAsync(k), (r) => `Generated ${JD_KIND_LABELS[k]} as v${r.version_no}`);
                        if (v) select(v);
                      }}
                    >
                      {JD_KIND_LABELS[k]}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
          <Button
            icon={bias.isPending ? <Spinner size="tiny" /> : <ShieldCheckmark20Regular />}
            disabled={!selected || dirty || bias.isPending}
            title={dirty ? "Save the version first" : undefined}
            onClick={async () => {
              if (!selected) return;
              try {
                setMatches((await bias.mutateAsync(selected.id)).matches);
              } catch (e) {
                toast.error(demandErrorMessage(e));
              }
            }}
          >
            Bias check
          </Button>
          {editable && selected && list[0]?.id !== selected.id && (
            <Button
              icon={<ArrowCounterclockwise20Regular />}
              disabled={restore.isPending}
              onClick={async () => {
                const v = await run(restore.mutateAsync(selected.id), (r) => `Restored v${selected.version_no} as v${r.version_no}`);
                if (v) select(v);
              }}
            >
              Restore
            </Button>
          )}
          {canPublish && (
            <Button
              appearance="primary"
              icon={<Globe20Regular />}
              disabled={!publishable(selected) || dirty}
              title={!publishable(selected) ? "Only a full JD or job posting can be published" : undefined}
              onClick={() => selected && setPublishing(selected)}
            >
              Publish
            </Button>
          )}
          {canUpdate && livePosting && (
            <Button
              icon={<GlobeProhibited20Regular />}
              disabled={unpublish.isPending}
              onClick={() => run(unpublish.mutateAsync(undefined), () => "Unpublished the job posting")}
            >
              Unpublish
            </Button>
          )}
        </div>

        <Field label={selected ? `Content (v${selected.version_no})` : "Content"}>
          <Textarea
            className={styles.textarea}
            value={content}
            readOnly={!editable}
            maxLength={20000}
            resize="vertical"
            placeholder="Write the job description"
            onChange={(_, d) => {
              setDraft({ kind, content: d.value });
              setMatches(null);
            }}
          />
        </Field>
        {editable && (
          <div className={styles.toolbar}>
            <Button
              appearance="primary"
              icon={save.isPending ? <Spinner size="tiny" /> : <Save20Regular />}
              disabled={!content.trim() || save.isPending || (!dirty && !!selected)}
              onClick={async () => {
                const v = await run(save.mutateAsync({ kind, content }), (r) => `Saved v${r.version_no}`);
                if (v) select(v);
              }}
            >
              Save as new version
            </Button>
            {dirty && (
              <Button appearance="subtle" onClick={() => setDraft(null)}>
                Discard changes
              </Button>
            )}
          </div>
        )}

        {matches && (
          <section aria-label="Bias check results">
            {matches.length === 0 ? (
              <MessageBar intent="success">
                <MessageBarBody>No flagged wording found in v{selected?.version_no}.</MessageBarBody>
              </MessageBar>
            ) : (
              <>
                <MessageBar intent="warning" layout="multiline">
                  <MessageBarBody>
                    <MessageBarTitle>{matches.length} flagged {matches.length === 1 ? "term" : "terms"}</MessageBarTitle>
                    Edit the wording and save a new version, or acknowledge the flags when publishing.
                    <MatchList matches={matches} />
                  </MessageBarBody>
                </MessageBar>
                <Highlighted text={selected?.content ?? ""} matches={matches} />
              </>
            )}
          </section>
        )}
      </section>

      {dialogVersion && (
        <PublishDialog
          key={dialogVersion.id}
          demand={demand}
          version={dialogVersion}
          onClose={() => {
            setPublishing(null);
            onPublishHandled?.();
          }}
        />
      )}
    </div>
  );
}
