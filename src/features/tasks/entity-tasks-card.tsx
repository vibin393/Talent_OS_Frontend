"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
  CounterBadge,
  Input,
  makeStyles,
  Spinner,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { AppLink } from "@/components/app-link";
import { DetailsDrawer, ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import type { TaskEntityType } from "@/lib/api/types";
import { TaskDetail } from "./task-detail";
import { isOverdue } from "./task-model";
import { TaskRow } from "./task-row";
import { useEntityTasks, useTaskMutations, useTaskTimeZone } from "./use-tasks";

const useStyles = makeStyles({
  card: { maxWidth: "720px", marginTop: tokens.spacingVerticalL },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center" },
});

/** "Tasks" card for an entity page: open tasks linked to the record, inline add and a details drawer. */
export function EntityTasksCard({ entityType, entityId }: { entityType: TaskEntityType; entityId: string }) {
  const styles = useStyles();
  const canRead = usePermission("task:read");
  const canCreate = usePermission("task:create");
  const canUpdate = usePermission("task:update");
  const tz = useTaskTimeZone();
  const tasks = useEntityTasks(entityType, entityId);
  const { setDone, update, remove, create } = useTaskMutations();
  const [title, setTitle] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!canRead) return null;

  const all = tasks.data?.items ?? [];
  const open = all.filter((t) => t.status === "open");
  const shown = showDone ? all.filter((t) => t.status !== "cancelled") : open;
  const overdue = open.filter((t) => isOverdue(t, now, tz)).length;
  const selected = all.find((t) => t.id === openId) ?? null;

  const add = () => {
    const t = title.trim();
    if (!t) return;
    setTitle("");
    create.mutate({ title: t, entity_type: entityType, entity_id: entityId, priority: "normal", due_all_day: false });
  };

  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <Subtitle2 as="h2">
            Tasks{" "}
            {overdue > 0 && <CounterBadge count={overdue} color="danger" size="small" aria-label={`${overdue} overdue`} />}
          </Subtitle2>
        }
        description={<Body1 className={styles.muted}>{open.length === 1 ? "1 open task" : `${open.length} open tasks`}</Body1>}
        action={<AppLink href="/tasks">My tasks</AppLink>}
      />
      {canCreate && (
        <Input
          appearance="filled-darker"
          contentBefore={create.isPending ? <Spinner size="extra-tiny" /> : <Add20Regular />}
          placeholder="Add a task"
          aria-label="Add a task for this record"
          value={title}
          maxLength={200}
          onChange={(_, d) => setTitle(d.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
      )}
      {tasks.isError ? (
        <ErrorBar message={errorMessage(tasks.error)} />
      ) : tasks.isPending ? (
        <Spinner size="tiny" label="Loading tasks" />
      ) : shown.length === 0 ? (
        <Body1 className={styles.muted}>No open tasks.</Body1>
      ) : (
        <div role="list" aria-label="Tasks for this record" className={styles.list}>
          {shown.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              now={now}
              timeZone={tz}
              canComplete={canUpdate}
              hideEntity
              onToggle={(done) => setDone.mutate({ task: t, done })}
              onOpen={() => setOpenId(t.id)}
            />
          ))}
        </div>
      )}
      {all.length > open.length && (
        <div className={styles.footer}>
          <Button appearance="transparent" size="small" onClick={() => setShowDone((s) => !s)}>
            {showDone ? "Hide completed" : `Show completed (${all.length - open.length})`}
          </Button>
        </div>
      )}
      <DetailsDrawer open={!!selected} title="Task details" onClose={() => setOpenId(null)}>
        {selected && (
          <TaskDetail
            key={selected.id}
            task={selected}
            timeZone={tz}
            onSave={(body) => update.mutate({ id: selected.id, body })}
            onToggle={(done) => setDone.mutate({ task: selected, done })}
            onDelete={async () => {
              await remove.mutateAsync(selected);
              setOpenId(null);
            }}
          />
        )}
      </DetailsDrawer>
    </Card>
  );
}
