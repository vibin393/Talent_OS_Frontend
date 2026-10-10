"use client";

import {
  Button,
  Caption1,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { DatePicker } from "@fluentui/react-datepicker-compat";
import { Delete20Regular, Dismiss16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PersonPicker } from "@/features/activity/person-picker";
import { ConfirmDialog, formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { TaskOut, TaskPriority, TaskUpdate } from "@/lib/api/types";
import { EntityPicker } from "./entity-picker";
import type { SearchableEntity } from "./entity-search";
import { EntityChip } from "./task-row";
import {
  entityHref,
  localDateKey,
  localTime,
  PRIORITIES,
  PRIORITY_LABELS,
  REMINDER_PRESETS,
  zonedInstant,
} from "./task-model";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end", flexWrap: "wrap" },
  grow: { flex: "1 1 160px", minWidth: 0 },
  time: { width: "120px" },
  muted: { color: tokens.colorNeutralForeground3 },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
});

function toPickerDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fromPickerDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The moment reminders are measured from: the due time, or 09:00 on an all-day due date. */
function dueBase(task: Pick<TaskOut, "due_at" | "due_all_day">, tz: string): Date | null {
  if (!task.due_at) return null;
  const due = new Date(task.due_at);
  return task.due_all_day ? zonedInstant(localDateKey(due, tz), "09:00", tz) : due;
}

/**
 * Task details (To Do style right pane): every change is saved straight away through `onSave`
 * (optimistic, rolled back with a toast on failure).
 */
export function TaskDetail({
  task,
  timeZone,
  onSave,
  onToggle,
  onDelete,
}: {
  task: TaskOut;
  timeZone: string;
  onSave: (body: TaskUpdate) => void;
  onToggle: (done: boolean) => void;
  onDelete: () => Promise<unknown>;
}) {
  const styles = useStyles();
  const canUpdate = usePermission("task:update");
  const canDelete = usePermission("task:delete");
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ro = !canUpdate;
  const done = task.status === "done";

  const dueKey = task.due_at ? localDateKey(new Date(task.due_at), timeZone) : null;
  const dueTime = task.due_at && !task.due_all_day ? localTime(new Date(task.due_at), timeZone) : "";

  const setDue = (dateKey: string | null, time: string) => {
    if (!dateKey) {
      onSave({ due_at: null, due_all_day: false, reminder_at: null });
      return;
    }
    const due = zonedInstant(dateKey, time || "12:00", timeZone);
    const body: TaskUpdate = { due_at: due.toISOString(), due_all_day: !time };
    // A reminder after the new due date is no longer valid.
    if (task.reminder_at && new Date(task.reminder_at) > due) body.reminder_at = null;
    onSave(body);
  };

  const base = dueBase(task, timeZone);
  const reminderMinutes =
    task.reminder_at && base ? Math.round((base.getTime() - new Date(task.reminder_at).getTime()) / 60_000) : null;
  const preset = task.reminder_at
    ? (REMINDER_PRESETS.find((p) => p.minutes === reminderMinutes)?.minutes.toString() ?? "custom")
    : "none";

  const saveTitle = () => {
    const t = title.trim();
    if (!t) setTitle(task.title);
    else if (t !== task.title) onSave({ title: t });
  };

  const href = entityHref(task.entity_type, task.entity_id);

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        <Checkbox
          shape="circular"
          checked={done}
          disabled={ro}
          aria-label={done ? "Mark as not completed" : "Mark as completed"}
          onChange={(_, d) => onToggle(!!d.checked)}
        />
        <Field className={styles.grow} label="Title">
          <Input
            value={title}
            maxLength={200}
            disabled={ro}
            className={styles.title}
            onChange={(_, d) => setTitle(d.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
        </Field>
      </div>

      {canUpdate ? (
        <PersonPicker
          label="Owner"
          value={task.owner_id}
          valueLabel={task.owner_name ?? ""}
          onChange={(p) => p && p.id !== task.owner_id && onSave({ owner_id: p.id })}
          unavailableHint="You cannot browse people; the task stays with its owner."
        />
      ) : (
        <Field label="Owner">
          <Text>{task.owner_name ?? "—"}</Text>
        </Field>
      )}

      <div className={styles.row}>
        <Field label="Due" className={styles.grow}>
          <DatePicker
            value={dueKey ? toPickerDate(dueKey) : null}
            disabled={ro}
            placeholder="Add due date"
            allowTextInput
            onSelectDate={(d) => setDue(d ? fromPickerDate(d) : null, dueTime)}
          />
        </Field>
        <Field label="Time" hint={dueKey && !dueTime ? "All day" : undefined}>
          <Input
            type="time"
            className={styles.time}
            disabled={ro || !dueKey}
            value={dueTime}
            onChange={(_, d) => dueKey && setDue(dueKey, d.value)}
          />
        </Field>
        {dueKey && !ro && (
          <Button
            appearance="subtle"
            icon={<Dismiss16Regular />}
            aria-label="Remove due date"
            onClick={() => setDue(null, "")}
          />
        )}
      </div>

      <Field label="Reminder" hint={!base ? "Add a due date to set a reminder." : undefined}>
        <Dropdown
          disabled={ro || !base}
          value={
            preset === "none"
              ? "No reminder"
              : preset === "custom"
                ? formatDateTime(task.reminder_at)
                : (REMINDER_PRESETS.find((p) => String(p.minutes) === preset)?.label ?? "")
          }
          selectedOptions={[preset]}
          onOptionSelect={(_, d) => {
            if (!base) return;
            if (d.optionValue === "none") onSave({ reminder_at: null });
            else if (d.optionValue && d.optionValue !== "custom")
              onSave({ reminder_at: new Date(base.getTime() - Number(d.optionValue) * 60_000).toISOString() });
          }}
        >
          <Option value="none">No reminder</Option>
          {REMINDER_PRESETS.map((p) => (
            <Option key={p.minutes} value={String(p.minutes)}>
              {p.label}
            </Option>
          ))}
          {preset === "custom" && (
            <Option value="custom" text={formatDateTime(task.reminder_at)}>
              {formatDateTime(task.reminder_at)}
            </Option>
          )}
        </Dropdown>
      </Field>

      <Field label="Priority">
        <Dropdown
          disabled={ro}
          value={PRIORITY_LABELS[task.priority as TaskPriority]}
          selectedOptions={[task.priority]}
          onOptionSelect={(_, d) => d.optionValue && onSave({ priority: d.optionValue as TaskPriority })}
        >
          {PRIORITIES.map((p) => (
            <Option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </Option>
          ))}
        </Dropdown>
      </Field>

      {task.entity_type && task.entity_id && (
        <div className={styles.row}>
          <Caption1 className={styles.muted}>Linked to</Caption1>
          {href ? (
            <AppLink href={href}>
              <EntityChip type={task.entity_type} id={task.entity_id} />
            </AppLink>
          ) : (
            <EntityChip type={task.entity_type} id={task.entity_id} />
          )}
        </div>
      )}
      {!ro && (
        <EntityPicker
          label={task.entity_type ? "Change linked record" : "Link to a record"}
          value={null}
          onChange={(v) =>
            onSave(v ? { entity_type: v.type, entity_id: v.id } : { entity_type: null, entity_id: null })
          }
          types={["candidate", "demand", "client"] as SearchableEntity[]}
        />
      )}

      <Field label="Notes">
        <Textarea
          value={notes}
          disabled={ro}
          resize="vertical"
          rows={5}
          maxLength={10_000}
          onChange={(_, d) => setNotes(d.value)}
          onBlur={() => notes !== (task.notes ?? "") && onSave({ notes: notes || null })}
        />
      </Field>

      <Caption1 className={styles.muted}>
        Created by {task.created_by_name ?? "someone"} · {formatDateTime(task.created_at)}
        {task.completed_at ? ` · Completed ${formatDateTime(task.completed_at)}` : ""}
      </Caption1>

      <div className={styles.footer}>
        {!ro && (
          <Button appearance={done ? "secondary" : "primary"} onClick={() => onToggle(!done)}>
            {done ? "Mark as not completed" : "Complete"}
          </Button>
        )}
        {canDelete && (
          <Button appearance="subtle" icon={<Delete20Regular />} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete task?"
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      >
        {`"${task.title}" will be deleted.`}
      </ConfirmDialog>
    </div>
  );
}
