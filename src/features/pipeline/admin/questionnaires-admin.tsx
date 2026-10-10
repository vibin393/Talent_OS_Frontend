"use client";

import {
  Badge,
  Button,
  Checkbox,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Spinner,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { MAPPED_FIELD_LABELS } from "@/features/screening/candidate-updates-panel";
import { QUESTION_TYPE_LABELS, type QuestionType, questionKey } from "@/features/screening/validation";
import type { QuestionnaireOut, ScreeningQuestion } from "@/lib/api/types";
import { pipelineApi, pipelineKeys } from "../api";
import { pipelineError } from "../use-actions";
import { QuestionnaireVersions } from "@/features/agents/screening/questionnaire-versions";

const useStyles = makeStyles({
  q: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "flex-end" },
  grow: { flex: "1 1 200px", minWidth: 0 },
});

const TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];
const NO_MAP = "__none__";

/** Recruiter screening questionnaires: list, create, edit questions, set default, archive. */
export function QuestionnairesAdmin() {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<QuestionnaireOut | "new" | null>(null);
  const list = useQuery({ queryKey: pipelineKeys.questionnaires(false), queryFn: ({ signal }) => pipelineApi.questionnaires(false, signal) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: pipelineKeys.config });
  const archive = useMutation({
    mutationFn: (id: string) => pipelineApi.archiveQuestionnaire(id),
    onSuccess: () => toast.success("Questionnaire archived."),
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: refresh,
  });
  const columns: TableColumnDefinition<QuestionnaireOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (q) => (
        <span className={admin.badges}>
          <Text weight="semibold">{q.name}</Text>
          {q.is_default && (
            <Badge appearance="tint" color="brand">
              Default
            </Badge>
          )}
        </span>
      ),
    }),
    createTableColumn({ columnId: "count", renderHeaderCell: () => "Questions", renderCell: (q) => q.questions.length }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (q) => (
        <RowActions
          label={q.name}
          actions={[
            { label: "Edit", onClick: () => setEditing(q) },
            { label: "Archive", onClick: () => archive.mutate(q.id), disabled: archive.isPending || q.is_default },
          ]}
        />
      ),
    }),
  ];
  return (
    <>
      <div className={admin.toolbar}>
        <Text className={admin.grow}>Skill questions from each demand&apos;s required skills are added automatically when a screening opens.</Text>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          New questionnaire
        </Button>
      </div>
      <AdminGrid items={list.data} columns={columns} getRowId={(q) => q.id} loading={list.isPending} error={list.error} emptyText="No questionnaires." label="Screening questionnaires" onRowClick={(q) => setEditing(q)} />
      {editing && <QuestionnaireDrawer key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </>
  );
}

function QuestionnaireDrawer({ initial, onClose, onSaved }: { initial: QuestionnaireOut | null; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [questions, setQuestions] = useState<ScreeningQuestion[]>(
    initial?.questions ?? [{ key: "interest", label: "Are you interested in this role?", type: "boolean", required: true, options: null, maps_to: null }],
  );
  const update = (i: number, patch: Partial<ScreeningQuestion>) => setQuestions((prev) => prev.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const invalid =
    !name.trim() ||
    questions.length === 0 ||
    questions.some((q) => !q.label.trim() || (q.type === "choice" && (q.options ?? []).filter(Boolean).length < 2));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        is_default: isDefault,
        questions: questions.map((q) => ({
          ...q,
          label: q.label.trim(),
          options: q.type === "choice" ? (q.options ?? []).map((o) => o.trim()).filter(Boolean) : null,
        })),
      };
      return initial ? pipelineApi.updateQuestionnaire(initial.id, body) : pipelineApi.createQuestionnaire(body);
    },
    onSuccess: async () => {
      toast.success("Questionnaire saved.");
      await onSaved();
      onClose();
    },
  });
  return (
    <DetailsDrawer
      open
      size="large"
      title={initial ? `Edit ${initial.name}` : "New questionnaire"}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button appearance="primary" disabled={invalid || save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className={admin.form}>
        <Field label="Name" required>
          <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Checkbox label="Default questionnaire for new screenings" checked={isDefault} onChange={(_, d) => setIsDefault(!!d.checked)} />
        {questions.map((q, i) => (
          <fieldset key={q.key} className={styles.q}>
            <legend>
              <Text weight="semibold">Question {i + 1}</Text>
            </legend>
            <Field label="Question" required>
              <Input value={q.label} maxLength={500} onChange={(_, d) => update(i, { label: d.value })} />
            </Field>
            <div className={styles.row}>
              <Field label="Answer type">
                <Dropdown value={QUESTION_TYPE_LABELS[q.type]} selectedOptions={[q.type]} onOptionSelect={(_, d) => update(i, { type: (d.optionValue as QuestionType) ?? q.type })}>
                  {TYPES.map((t) => (
                    <Option key={t} value={t}>
                      {QUESTION_TYPE_LABELS[t]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Update candidate field" hint="Offers to copy the answer to the profile">
                <Dropdown
                  value={q.maps_to ? MAPPED_FIELD_LABELS[q.maps_to] : "None"}
                  selectedOptions={[q.maps_to ?? NO_MAP]}
                  onOptionSelect={(_, d) => update(i, { maps_to: d.optionValue === NO_MAP ? null : (d.optionValue as ScreeningQuestion["maps_to"]) })}
                >
                  <Option value={NO_MAP}>None</Option>
                  {Object.entries(MAPPED_FIELD_LABELS).map(([k, v]) => (
                    <Option key={k} value={k}>
                      {v}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Checkbox label="Required" checked={!!q.required} onChange={(_, d) => update(i, { required: !!d.checked })} />
              <Button
                appearance="subtle"
                icon={<Delete20Regular />}
                aria-label={`Remove question ${i + 1}`}
                disabled={questions.length <= 1}
                onClick={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
              />
            </div>
            {q.type === "choice" && (
              <Field label="Options (comma-separated)" className={styles.grow} required>
                <Input value={(q.options ?? []).join(", ")} onChange={(_, d) => update(i, { options: d.value.split(",").map((o) => o.trimStart()) })} />
              </Field>
            )}
          </fieldset>
        ))}
        <Button
          icon={<Add20Regular />}
          disabled={questions.length >= 60}
          onClick={() =>
            setQuestions((prev) => [
              ...prev,
              { key: questionKey("question", new Set(prev.map((q) => q.key))), label: "", type: "text", required: false, options: null, maps_to: null },
            ])
          }
        >
          Add question
        </Button>
        {save.isError && <ErrorBar message={pipelineError(save.error)} />}
        {/* Epic 57: Screening Agent versions and "Use for" bindings (saved separately from the P1 questionnaire). */}
        {initial && <QuestionnaireVersions questionnaireId={initial.id} />}
      </div>
    </DetailsDrawer>
  );
}
