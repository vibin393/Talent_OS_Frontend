"use client";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Spinner,
  Switch,
  Tab,
  TabList,
  Text,
  tokens, mergeClasses } from "@fluentui/react-components";
import {
  Call20Regular,
  CalendarLtr20Regular,
  Edit20Regular,
  History20Regular,
  LockClosed16Regular,
  Mail20Regular,
  Note20Regular,
} from "@fluentui/react-icons";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import type { ActivityCreate, ActivityKind, ActivityOut } from "@/lib/api/types";
import { activityApi, activityKeys } from "./api";
import {
  ACTIVITY_KIND_LABELS,
  authorLabel,
  formatWhen,
  fromLocalInputValue,
  participantsLabel,
  toLocalInputValue,
  type UserActivityKind,
} from "./format";
import { MentionTextarea } from "./mention-textarea";
import { channelActivityLabel, isChannelActivity } from "@/features/comms/channel-activity";
import { EmailReplyCard } from "@/features/comms/email-reply-card";
import { EscalatedBadge } from "@/features/escalations/escalation-entry";
import { type Mention, parseBody, toDisplay, toMarkup } from "./mentions";

export type ParticipantOption = { id: string; name: string; kind: "contact" | "user" };

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "860px" },
  // `overflow: visible` so the @mention suggestion list is not clipped by the Card.
  composer: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalL,
    overflow: "visible",
  },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, alignItems: "flex-end" },
  actions: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
  grow: { flex: 1 },
  list: { display: "flex", flexDirection: "column", margin: 0, padding: 0, listStyle: "none" },
  item: {
    display: "grid",
    gridTemplateColumns: "32px 1fr",
    columnGap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  icon: {
    width: "32px",
    height: "32px",
    borderRadius: tokens.borderRadiusCircular,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
  },
  systemIcon: { backgroundColor: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground3 },
  meta: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  body: { display: "block", whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: `${tokens.spacingVerticalXXS} 0 0` },
  mention: {
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusSmall,
    padding: `0 ${tokens.spacingHorizontalXXS}`,
    fontWeight: tokens.fontWeightSemibold,
  },
  surface: { backgroundColor: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusMedium, boxShadow: tokens.shadow4 },
  empty: { padding: tokens.spacingHorizontalXXL, textAlign: "center", color: tokens.colorNeutralForeground3 },
  more: { display: "flex", justifyContent: "center", padding: tokens.spacingVerticalS },
});

const ACTIVITY_MESSAGES: Record<string, string> = {
  invalid_mention: "One of the mentioned people is not a user of this workspace. Remove the mention and try again.",
  edit_window_closed: "Notes can only be edited within 24 hours of posting.",
  not_author: "Only the author can edit this entry.",
  forbidden: "You do not have permission to do this.",
};

function activityErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    const known = ACTIVITY_MESSAGES[e.code];
    if (known) return known;
    if (e.status === 422) return fieldErrors(e).body ?? e.message;
    if (e.status === 404) return "This record no longer exists or you cannot see it.";
  }
  return errorMessage(e);
}

function KindIcon({ kind }: { kind: ActivityKind }) {
  switch (kind) {
    case "call":
      return <Call20Regular />;
    case "meeting":
      return <CalendarLtr20Regular />;
    case "email":
      return <Mail20Regular />;
    case "system":
      return <History20Regular />;
    default:
      return <Note20Regular />;
  }
}

/** Stored body with @mentions highlighted. */
export function ActivityBody({ body }: { body: string }) {
  const styles = useStyles();
  return (
    <Text as="p" className={styles.body}>
      {parseBody(body).map((s, i) =>
        s.kind === "text" ? (
          <Fragment key={i}>{s.text}</Fragment>
        ) : (
          <span key={i} className={styles.mention} data-user-id={s.id}>
            @{s.name}
          </span>
        ),
      )}
    </Text>
  );
}

function Composer({
  entity,
  entityId,
  participantOptions,
  onPosted,
}: {
  entity: string;
  entityId: string;
  participantOptions: readonly ParticipantOption[];
  onPosted: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const [kind, setKind] = useState<UserActivityKind>("note");
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [when, setWhen] = useState(() => toLocalInputValue(new Date()));
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (body: ActivityCreate) => activityApi.add(entity, entityId, body),
  });

  const logged = kind !== "note";
  const empty = text.trim() === "";

  async function submit() {
    setError(null);
    const body: ActivityCreate = {
      kind,
      body: toMarkup(text.trim(), mentions),
      is_private: isPrivate,
      participants: logged
        ? participantOptions
            .filter((p) => participants.includes(p.id))
            .map((p) => ({ kind: p.kind, id: p.id, name: p.name }))
        : [],
    };
    if (logged) {
      const occurred = fromLocalInputValue(when);
      if (occurred) body.occurred_at = occurred;
    }
    try {
      await add.mutateAsync(body);
      toast.success(kind === "note" ? "Note added" : `${ACTIVITY_KIND_LABELS[kind]} logged`);
      setText("");
      setMentions([]);
      setParticipants([]);
      setIsPrivate(false);
      setWhen(toLocalInputValue(new Date()));
      onPosted();
    } catch (e) {
      setError(activityErrorMessage(e));
    }
  }

  const selectedNames = participantOptions
    .filter((p) => participants.includes(p.id))
    .map((p) => p.name)
    .join(", ");

  return (
    <Card className={styles.composer} aria-label="Add activity">
      <TabList
        size="small"
        selectedValue={kind}
        onTabSelect={(_, d) => setKind(d.value as UserActivityKind)}
        aria-label="Activity type"
      >
        <Tab value="note" icon={<Note20Regular />}>
          Note
        </Tab>
        <Tab value="call" icon={<Call20Regular />}>
          Log a call
        </Tab>
        <Tab value="meeting" icon={<CalendarLtr20Regular />}>
          Log a meeting
        </Tab>
      </TabList>
      <ErrorBar message={error} />
      <MentionTextarea
        label={kind === "note" ? "Note" : `${ACTIVITY_KIND_LABELS[kind]} summary`}
        value={text}
        mentions={mentions}
        onChange={(t, m) => {
          setText(t);
          setMentions(m);
        }}
        placeholder={kind === "note" ? "Add a note. Type @ to mention a colleague." : "What was discussed?"}
        disabled={add.isPending}
      />
      {logged && (
        <div className={styles.row}>
          <Field label="When">
            <Input type="datetime-local" value={when} onChange={(_, d) => setWhen(d.value)} disabled={add.isPending} />
          </Field>
          {participantOptions.length > 0 && (
            <Field label="Participants" className={styles.grow}>
              <Dropdown
                multiselect
                placeholder="Select contacts"
                value={selectedNames}
                selectedOptions={participants}
                onOptionSelect={(_, d) => setParticipants(d.selectedOptions)}
                disabled={add.isPending}
              >
                {participantOptions.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          )}
        </div>
      )}
      <div className={styles.actions}>
        <Switch
          className={styles.grow}
          checked={isPrivate}
          onChange={(_, d) => setIsPrivate(d.checked)}
          label="Private (visible to you and administrators only)"
          disabled={add.isPending}
        />
        <Button
          appearance="primary"
          disabled={empty || add.isPending}
          icon={add.isPending ? <Spinner size="tiny" /> : undefined}
          onClick={submit}
        >
          {kind === "note" ? "Post note" : "Log activity"}
        </Button>
      </div>
    </Card>
  );
}

function EntryEditor({ activity, onDone }: { activity: ActivityOut; onDone: (saved: boolean) => void }) {
  const styles = useStyles();
  const [{ text, mentions }, setDraft] = useState(() => toDisplay(activity.body));
  const [isPrivate, setIsPrivate] = useState(activity.is_private);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      activityApi.update(activity.id, { body: toMarkup(text.trim(), mentions), is_private: isPrivate }),
  });

  return (
    <div className={styles.composer} style={{ padding: 0, marginTop: 8 }}>
      <ErrorBar message={error} />
      <MentionTextarea
        label="Edit entry"
        value={text}
        mentions={mentions}
        onChange={(t, m) => setDraft({ text: t, mentions: m })}
        disabled={save.isPending}
        autoFocus
      />
      <div className={styles.actions}>
        <Switch
          className={styles.grow}
          checked={isPrivate}
          onChange={(_, d) => setIsPrivate(d.checked)}
          label="Private"
          disabled={save.isPending}
        />
        <Button appearance="secondary" onClick={() => onDone(false)} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          appearance="primary"
          disabled={text.trim() === "" || save.isPending}
          icon={save.isPending ? <Spinner size="tiny" /> : undefined}
          onClick={async () => {
            setError(null);
            try {
              await save.mutateAsync();
              onDone(true);
            } catch (e) {
              setError(activityErrorMessage(e));
            }
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function Entry({ activity, meId, onSaved }: { activity: ActivityOut; meId?: string; onSaved: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [editing, setEditing] = useState(false);
  const system = activity.kind === "system" || activity.kind === "email" || isChannelActivity(activity.kind);
  const author = authorLabel(activity, meId);
  const people = participantsLabel(activity.participants);
  const when = new Date(activity.occurred_at);

  return (
    <li className={styles.item}>
      {activity.author_name && !system ? (
        <Avatar name={activity.author_name} size={32} color="colorful" aria-hidden />
      ) : (
        <span className={mergeClasses(styles.icon, system ? styles.systemIcon : "")} aria-hidden>
          <KindIcon kind={activity.kind} />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div className={styles.meta}>
          <Text weight="semibold">{author}</Text>
          <Badge appearance="tint" color={system ? "subtle" : "brand"} icon={<KindIcon kind={activity.kind} />}>
            {ACTIVITY_KIND_LABELS[activity.kind] ?? channelActivityLabel(activity.kind)}
          </Badge>
          <EscalatedBadge activity={activity} />
          {activity.is_private && (
            <Badge appearance="tint" color="warning" icon={<LockClosed16Regular />}>
              Private
            </Badge>
          )}
          <Text size={200} className={styles.muted}>
            <time dateTime={activity.occurred_at} title={when.toLocaleString()}>
              {formatWhen(activity.occurred_at)}
            </time>
            {activity.edited_at && " · Edited"}
          </Text>
          {activity.can_edit && !editing && (
            <Button
              appearance="subtle"
              size="small"
              icon={<Edit20Regular />}
              aria-label={`Edit ${ACTIVITY_KIND_LABELS[activity.kind].toLowerCase()} by ${author}`}
              onClick={() => setEditing(true)}
            />
          )}
        </div>
        {people && (
          <Text as="p" size={200} className={styles.muted} style={{ display: "block", margin: 0 }}>
            With {people}
          </Text>
        )}
        {editing ? (
          <EntryEditor
            activity={activity}
            onDone={(saved) => {
              setEditing(false);
              if (saved) {
                toast.success("Entry updated");
                onSaved();
              }
            }}
          />
        ) : (
          (activity.kind as string) === "email_reply" ? (
            <EmailReplyCard data={activity.data} body={activity.body} />
          ) : (
            <ActivityBody body={activity.body} />
          )
        )}
      </div>
    </li>
  );
}

/**
 * Notes & activity for any registered entity (`entityType`: `client`, `contact`, `candidate`, or their
 * plural URL segment): composer (note / call / meeting, @mentions, private toggle; needs `note:write`)
 * and the newest-first timeline with "Load more" and inline edit within the 24 h window.
 */
export function ActivityTimeline({
  entityType,
  entityId,
  participantOptions = [],
  onChanged,
}: {
  entityType: string;
  entityId: string;
  participantOptions?: readonly ParticipantOption[];
  /** Called after a post or edit (e.g. to refresh counts). */
  onChanged?: () => void;
}) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const canWrite = usePermission("note:write");
  const key = activityKeys.timeline(entityType, entityId);

  const timeline = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => activityApi.timeline(entityType, entityId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? null,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    onChanged?.();
  };

  const items = timeline.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className={styles.root}>
      {canWrite && (
        <Composer entity={entityType} entityId={entityId} participantOptions={participantOptions} onPosted={refresh} />
      )}
      {timeline.isError && !timeline.data ? (
        <ErrorBar title="Could not load the timeline." message={errorMessage(timeline.error)} />
      ) : (
        <section className={styles.surface} aria-label="Timeline">
          {timeline.isPending ? (
            <GridSkeleton rows={4} />
          ) : items.length === 0 ? (
            <div className={styles.empty}>No activity yet.</div>
          ) : (
            <ul className={styles.list}>
              {items.map((a) => (
                <Entry key={a.id} activity={a} meId={me?.user.id} onSaved={refresh} />
              ))}
            </ul>
          )}
          {timeline.hasNextPage && (
            <div className={styles.more}>
              <Button
                appearance="subtle"
                disabled={timeline.isFetchingNextPage}
                icon={timeline.isFetchingNextPage ? <Spinner size="tiny" /> : undefined}
                onClick={() => timeline.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
