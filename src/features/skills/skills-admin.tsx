"use client";

import {
  Badge,
  Button,
  Caption1,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  SearchBox,
  Spinner,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { Add20Regular, Checkmark20Regular, Dismiss20Regular, Merge20Regular, TagMultiple20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ConfirmDialog, ErrorBar, formatDateTime, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useDebounced } from "@/lib/use-debounced";
import { candidateErrorMessage } from "@/features/candidates/errors";
import { SkillPicker } from "@/features/candidates/skill-picker";
import { useCandidateMutation } from "@/features/candidates/use-candidates";
import type { PendingSkillOut, SkillOut } from "@/lib/api/types";
import { parseAliases, skillKeys, skillsApi } from "./api";

/** `/admin/skills`: catalog search, add skill / alias, pending queue (approve, reject, merge into). */
export function SkillsAdmin() {
  const canManage = usePermission("settings:manage");
  const [tab, setTab] = useState<"catalog" | "pending">("catalog");
  if (!canManage) return <NoAccess what="the skill catalog" />;
  return (
    <>
      <PageHeader
        title="Skill catalog"
        subtitle="The platform catalog plus your organization's own skills and aliases. New skills found on resumes wait here for review."
      />
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as "catalog" | "pending")} style={{ marginBottom: 12 }}>
        <Tab value="catalog">Catalog</Tab>
        <Tab value="pending">Pending review</Tab>
      </TabList>
      {tab === "catalog" ? <CatalogTab /> : <PendingTab />}
    </>
  );
}

function CatalogTab() {
  const styles = useAdminStyles();
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);
  const [includePending, setIncludePending] = useState(false);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [aliasFor, setAliasFor] = useState<SkillOut | null>(null);

  const list = useQuery({
    queryKey: skillKeys.search(q, includePending, page),
    queryFn: ({ signal }) => skillsApi.search(q, includePending, page, DEFAULT_PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });

  const columns: TableColumnDefinition<SkillOut>[] = [
    createTableColumn<SkillOut>({
      columnId: "name",
      renderHeaderCell: () => "Skill",
      renderCell: (s) => (
        <div className={styles.cellStack}>
          <Text weight="semibold">{s.name}</Text>
          {s.parent_name && <Caption1 className={styles.muted}>Part of {s.parent_name}</Caption1>}
        </div>
      ),
    }),
    createTableColumn<SkillOut>({
      columnId: "kind",
      renderHeaderCell: () => "Source",
      renderCell: (s) => (
        <div className={styles.badges}>
          <Badge appearance="tint" color={s.kind === "global" ? "informative" : "brand"}>
            {s.kind === "global" ? "Platform" : "Organization"}
          </Badge>
          {s.status && s.status !== "approved" && (
            <Badge appearance="tint" color={s.status === "pending" ? "warning" : "subtle"}>
              {s.status}
            </Badge>
          )}
        </div>
      ),
    }),
    createTableColumn<SkillOut>({
      columnId: "category",
      renderHeaderCell: () => "Category",
      renderCell: (s) => s.category ?? "—",
    }),
    createTableColumn<SkillOut>({
      columnId: "aliases",
      renderHeaderCell: () => "Aliases",
      renderCell: (s) => <span className={styles.truncate}>{s.aliases?.length ? s.aliases.join(", ") : "—"}</span>,
    }),
    createTableColumn<SkillOut>({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (s) => (
        <RowActions
          label={s.name}
          actions={[{ label: "Add alias", icon: <TagMultiple20Regular />, onClick: () => setAliasFor(s) }]}
        />
      ),
    }),
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setAdding(true)}>
          Add skill
        </Button>
        <Field label="Search" className={styles.search}>
          <SearchBox
            placeholder="Skill name or alias"
            value={search}
            onChange={(_, d) => {
              setSearch(d.value);
              setPage(1);
            }}
          />
        </Field>
        <Switch
          label="Include pending"
          checked={includePending}
          onChange={(_, d) => {
            setIncludePending(d.checked);
            setPage(1);
          }}
        />
      </div>
      <AdminGrid
        label="Skills"
        items={list.data?.items}
        columns={columns}
        getRowId={(s) => `${s.kind}:${s.id}`}
        loading={list.isPending}
        error={list.error}
        emptyText={q ? "No skills match." : "No skills."}
        columnSizing={{ name: { minWidth: 200, idealWidth: 260 }, aliases: { minWidth: 200, idealWidth: 280 }, actions: { minWidth: 56, idealWidth: 56 } }}
        footer={
          list.data && (
            <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />
          )
        }
      />
      {adding && <AddSkillDialog onClose={() => setAdding(false)} />}
      {aliasFor && <AddAliasDialog skill={aliasFor} onClose={() => setAliasFor(null)} />}
    </>
  );
}

function AddSkillDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [aliases, setAliases] = useState("");
  const [parent, setParent] = useState<SkillOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useCandidateMutation({
    mutationFn: () =>
      skillsApi.create({
        name: name.trim(),
        category: category.trim() || null,
        parent_skill_id: parent?.id ?? null,
        aliases: parseAliases(aliases),
      }),
    invalidate: [skillKeys.all],
    success: (s) => `Added ${s.name}`,
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add skill</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ErrorBar message={error} />
            <Field label="Name" required>
              <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
            </Field>
            <Field label="Category">
              <Input value={category} maxLength={200} onChange={(_, d) => setCategory(d.value)} placeholder="e.g. Data engineering" />
            </Field>
            {parent ? (
              <Field label="Parent skill">
                <span>
                  {parent.name}{" "}
                  <Button size="small" appearance="subtle" onClick={() => setParent(null)}>
                    Remove
                  </Button>
                </span>
              </Field>
            ) : (
              <SkillPicker label="Parent skill (optional)" allowNew={false} onPick={(s) => s && s.kind === "global" && setParent(s)} />
            )}
            <Field label="Aliases" hint="Separate with commas, e.g. ADF, Azure DF">
              <Textarea value={aliases} onChange={(_, d) => setAliases(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!name.trim() || save.isPending}
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

function AddAliasDialog({ skill, onClose }: { skill: SkillOut; onClose: () => void }) {
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useCandidateMutation({
    mutationFn: () => skillsApi.addAlias(skill.kind, skill.id, alias.trim()),
    invalidate: [skillKeys.all],
    success: (s) => `Alias added to ${s.name}`,
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add alias for {skill.name}</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ErrorBar message={error} />
            {skill.aliases?.length ? <Caption1>Current aliases: {skill.aliases.join(", ")}</Caption1> : null}
            <Field label="Alias" required hint="Aliases apply to your organization only.">
              <Input value={alias} maxLength={200} onChange={(_, d) => setAlias(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!alias.trim() || save.isPending}
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
              Add alias
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function PendingTab() {
  const styles = useAdminStyles();
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<PendingSkillOut | null>(null);
  const [merging, setMerging] = useState<PendingSkillOut | null>(null);
  const list = useQuery({
    queryKey: skillKeys.pending(page),
    queryFn: ({ signal }) => skillsApi.pending(page, DEFAULT_PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });
  const approve = useCandidateMutation({
    mutationFn: (s: PendingSkillOut) => skillsApi.approve(s.id),
    invalidate: [skillKeys.all],
    success: (s) => `${s.name} approved`,
    toastErrors: true,
  });
  const reject = useCandidateMutation({
    mutationFn: (s: PendingSkillOut) => skillsApi.reject(s.id, null),
    invalidate: [skillKeys.all],
    success: (s) => `${s.name} rejected`,
    toastErrors: true,
  });

  const columns: TableColumnDefinition<PendingSkillOut>[] = [
    createTableColumn<PendingSkillOut>({
      columnId: "name",
      renderHeaderCell: () => "Skill",
      renderCell: (s) => <Text weight="semibold">{s.name}</Text>,
    }),
    createTableColumn<PendingSkillOut>({
      columnId: "from",
      renderHeaderCell: () => "Found in",
      renderCell: (s) => s.created_from,
    }),
    createTableColumn<PendingSkillOut>({
      columnId: "candidates",
      renderHeaderCell: () => "Candidates",
      renderCell: (s) => s.candidate_count,
    }),
    createTableColumn<PendingSkillOut>({
      columnId: "created",
      renderHeaderCell: () => "Added",
      renderCell: (s) => formatDateTime(s.created_at),
    }),
    createTableColumn<PendingSkillOut>({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (s) => (
        <div className={styles.badges}>
          <Button size="small" icon={<Checkmark20Regular />} disabled={approve.isPending} onClick={() => approve.mutate(s)}>
            Approve
          </Button>
          <Button size="small" icon={<Merge20Regular />} onClick={() => setMerging(s)}>
            Merge into…
          </Button>
          <Button size="small" appearance="subtle" icon={<Dismiss20Regular />} onClick={() => setRejecting(s)}>
            Reject
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <>
      <AdminGrid
        label="Pending skills"
        items={list.data?.items}
        columns={columns}
        getRowId={(s) => s.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No skills are waiting for review."
        columnSizing={{ name: { minWidth: 180 }, actions: { minWidth: 330, idealWidth: 340 } }}
        footer={
          list.data && (
            <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />
          )
        }
      />
      <ConfirmDialog
        open={!!rejecting}
        title="Reject skill?"
        confirmLabel="Reject"
        onClose={() => setRejecting(null)}
        onConfirm={() => reject.mutateAsync(rejecting!)}
      >
        {rejecting &&
          `"${rejecting.name}" will not be added to the catalog. It stays on the ${rejecting.candidate_count} candidate profile(s) that use it. To move them to an existing skill instead, use Merge into.`}
      </ConfirmDialog>
      {merging && <MergeSkillDialog skill={merging} onClose={() => setMerging(null)} />}
    </>
  );
}

function MergeSkillDialog({ skill, onClose }: { skill: PendingSkillOut; onClose: () => void }) {
  const [target, setTarget] = useState<SkillOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useCandidateMutation({
    mutationFn: () => skillsApi.reject(skill.id, target ? { kind: target.kind, id: target.id } : null),
    invalidate: [skillKeys.all],
    success: () => `"${skill.name}" merged into ${target?.name ?? "the selected skill"}`,
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Merge “{skill.name}” into another skill</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ErrorBar message={error} />
            <Text>
              Candidates with “{skill.name}” are moved to the selected skill, and “{skill.name}” becomes an alias of it.
            </Text>
            {target ? (
              <Field label="Merge into">
                <span>
                  <Subtitle2>{target.name}</Subtitle2>{" "}
                  <Button size="small" appearance="subtle" onClick={() => setTarget(null)}>
                    Change
                  </Button>
                </span>
              </Field>
            ) : (
              <SkillPicker
                label="Merge into"
                allowNew={false}
                excludeKeys={[`tenant:${skill.id}`]}
                onPick={(s) => s && s.status !== "pending" && setTarget(s)}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!target || save.isPending}
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
              Merge
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
