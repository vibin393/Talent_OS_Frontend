"use client";

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
} from "@fluentui/react-components";
import { Add20Regular, ArrowLeft20Regular, Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { campusApi, campusKeys } from "../api";
import { isE164, isEmail, type ProgramDraft, programsFromDraft, TIER_LABELS, TIERS } from "../logic";
import type { ContactOut, InstitutionDetailOut, InstitutionIn, Program, Tier } from "../types";
import { useCampusPermissions, useInstitution } from "../use-campus";
import { useCampusStyles } from "../ui";

function toDraft(programs: Program[]): ProgramDraft[] {
  return programs.map((p) => ({ name: p.name, branches: p.branches.join(", ") }));
}

/** `/campus/institutions/[id]` (or `new`): institution details, programs with branches and placement officers. */
export function InstitutionEditor({ id }: { id: string | null }) {
  const { canRead } = useCampusPermissions();
  const inst = useInstitution(id);
  if (!canRead) return <NoAccess what="campus institutions" />;
  if (id && inst.isPending) return <GridSkeleton rows={8} />;
  if (id && inst.isError) return <ErrorBar title="Could not load the institution." message={errorMessage(inst.error)} />;
  return <EditorBody key={inst.data?.updated_at ?? "new"} initial={inst.data ?? null} />;
}

function EditorBody({ initial }: { initial: InstitutionDetailOut | null }) {
  const styles = useCampusStyles();
  const router = useRouter();
  const toast = useAppToast();
  const qc = useQueryClient();
  const { canManage } = useCampusPermissions();
  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [country, setCountry] = useState(initial?.country ?? "IN");
  const [tier, setTier] = useState<Tier>(initial?.tier ?? "other");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [programs, setPrograms] = useState<ProgramDraft[]>(() => toDraft(initial?.programs ?? []));
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const ro = !canManage;

  const save = useMutation({
    mutationFn: (body: InstitutionIn) =>
      initial ? campusApi.updateInstitution(initial.id, body) : campusApi.createInstitution(body),
    onSuccess: async (out) => {
      qc.setQueryData(campusKeys.institution(out.id), out);
      await qc.invalidateQueries({ queryKey: campusKeys.institutionsRoot });
      toast.success(initial ? "Institution saved" : "Institution created");
      if (!initial) router.replace(`/campus/institutions/${out.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Give the institution a name of at least 2 characters.");
      return;
    }
    if (!/^[A-Za-z]{2}$/.test(country.trim())) {
      setError("Country is a 2-letter code, for example IN.");
      return;
    }
    setError(null);
    save.mutate({
      name: name.trim(),
      city: city.trim() || null,
      state: state.trim() || null,
      country: country.trim().toUpperCase(),
      tier,
      website: website.trim() || null,
      notes: notes.trim() || null,
      programs: programsFromDraft(programs),
    });
  };

  return (
    <>
      <AppLink href="/campus/institutions">
        <ArrowLeft20Regular aria-hidden style={{ verticalAlign: "middle" }} /> Institutions
      </AppLink>
      <PageHeader
        title={initial ? initial.name : "New institution"}
        subtitle={initial?.status === "archived" ? "Archived" : "Programs and branches drive the registration form's choices"}
      />
      <form className={styles.stack} onSubmit={submit} noValidate>
        <section className={styles.card} aria-labelledby="inst-details">
          <Subtitle2 as="h2" id="inst-details">
            Details
          </Subtitle2>
          <div className={styles.grid2}>
            <Field label="Name" required>
              <Input value={name} maxLength={300} disabled={ro} onChange={(_, d) => setName(d.value)} />
            </Field>
            <Field label="Tier">
              <Dropdown value={TIER_LABELS[tier]} selectedOptions={[tier]} disabled={ro} onOptionSelect={(_, d) => setTier(d.optionValue as Tier)}>
                {TIERS.map((t) => (
                  <Option key={t} value={t}>
                    {TIER_LABELS[t]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="City">
              <Input value={city} maxLength={120} disabled={ro} onChange={(_, d) => setCity(d.value)} />
            </Field>
            <Field label="State">
              <Input value={state} maxLength={120} disabled={ro} onChange={(_, d) => setState(d.value)} />
            </Field>
            <Field label="Country" hint="2-letter code">
              <Input value={country} maxLength={2} disabled={ro} onChange={(_, d) => setCountry(d.value)} />
            </Field>
            <Field label="Website">
              <Input type="url" value={website} maxLength={500} disabled={ro} onChange={(_, d) => setWebsite(d.value)} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={notes} maxLength={5000} resize="vertical" disabled={ro} onChange={(_, d) => setNotes(d.value)} />
          </Field>
        </section>

        <section className={styles.card} aria-labelledby="inst-programs">
          <Subtitle2 as="h2" id="inst-programs">
            Programs and branches
          </Subtitle2>
          {programs.length === 0 && <span className={styles.muted}>No programs yet.</span>}
          {programs.map((p, i) => (
            <div key={i} className={styles.row}>
              <Field label={`Program ${i + 1}`} style={{ minWidth: 200 }}>
                <Input
                  value={p.name}
                  placeholder="B.Tech"
                  maxLength={200}
                  disabled={ro}
                  onChange={(_, d) => setPrograms((rows) => rows.map((r, j) => (j === i ? { ...r, name: d.value } : r)))}
                />
              </Field>
              <Field label="Branches" hint="Separate with commas" className={styles.grow} style={{ minWidth: 220 }}>
                <Input
                  value={p.branches}
                  placeholder="Computer Science, Information Technology"
                  disabled={ro}
                  onChange={(_, d) => setPrograms((rows) => rows.map((r, j) => (j === i ? { ...r, branches: d.value } : r)))}
                />
              </Field>
              {!ro && (
                <Button
                  appearance="subtle"
                  icon={<Delete20Regular />}
                  aria-label={`Remove program ${p.name || i + 1}`}
                  onClick={() => setPrograms((rows) => rows.filter((_, j) => j !== i))}
                />
              )}
            </div>
          ))}
          {!ro && (
            <div>
              <Button icon={<Add20Regular />} disabled={programs.length >= 100} onClick={() => setPrograms((rows) => [...rows, { name: "", branches: "" }])}>
                Add program
              </Button>
            </div>
          )}
        </section>

        {error && (
          <MessageBar intent="error" role="alert">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
        {!ro && (
          <div className={styles.row}>
            <Button appearance="primary" type="submit" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
              {initial ? "Save" : "Create institution"}
            </Button>
            {initial && initial.status === "active" && (
              <Button onClick={() => setArchiving(true)}>Archive</Button>
            )}
            {initial && initial.status === "archived" && (
              <Button
                onClick={async () => {
                  try {
                    const out = await campusApi.updateInstitution(initial.id, { status: "active" });
                    qc.setQueryData(campusKeys.institution(out.id), out);
                    await qc.invalidateQueries({ queryKey: campusKeys.institutionsRoot });
                    toast.success("Institution restored");
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                }}
              >
                Restore
              </Button>
            )}
          </div>
        )}
      </form>

      {initial && <ContactsSection institution={initial} readOnly={ro} />}

      <ConfirmDialog
        open={archiving}
        title="Archive this institution?"
        confirmLabel="Archive"
        onClose={() => setArchiving(false)}
        onConfirm={async () => {
          if (!initial) return;
          try {
            const out = await campusApi.archiveInstitution(initial.id);
            qc.setQueryData(campusKeys.institution(out.id), out);
            await qc.invalidateQueries({ queryKey: campusKeys.institutionsRoot });
            toast.success("Institution archived");
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        It can no longer be added to new drives. Existing drives and registrations are kept.
      </ConfirmDialog>
    </>
  );
}

function ContactsSection({ institution, readOnly }: { institution: InstitutionDetailOut; readOnly: boolean }) {
  const styles = useCampusStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [editing, setEditing] = useState<ContactOut | "new" | null>(null);
  const [archiving, setArchiving] = useState<ContactOut | null>(null);
  const contacts = institution.contacts.filter((c) => !c.archived_at);
  const refresh = () => qc.invalidateQueries({ queryKey: campusKeys.institution(institution.id) });

  return (
    <section className={`${styles.card} ${styles.section}`} aria-labelledby="inst-contacts">
      <div className={styles.row}>
        <Subtitle2 as="h2" id="inst-contacts" className={styles.grow}>
          Placement officers
        </Subtitle2>
        {!readOnly && (
          <Button icon={<Add20Regular />} onClick={() => setEditing("new")}>
            Add contact
          </Button>
        )}
      </div>
      {contacts.length === 0 ? (
        <span className={styles.muted}>No placement officers yet.</span>
      ) : (
        <div className={styles.tableWrap}>
          <Table aria-label="Placement officers" style={{ minWidth: 560 }}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.name}{" "}
                    {c.is_primary && (
                      <Badge appearance="tint" color="brand" size="small">
                        Primary
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{c.title ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    {!readOnly && (
                      <>
                        <Button appearance="subtle" icon={<Edit20Regular />} aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
                        <Button appearance="subtle" icon={<Delete20Regular />} aria-label={`Archive ${c.name}`} onClick={() => setArchiving(c)} />
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && (
        <ContactDialog
          institutionId={institution.id}
          contact={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            toast.success("Contact saved");
          }}
        />
      )}
      <ConfirmDialog
        open={!!archiving}
        title={`Archive ${archiving?.name ?? "contact"}?`}
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          try {
            await campusApi.archiveContact(institution.id, archiving.id);
            await refresh();
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        The contact is hidden from this institution. Past correspondence is kept.
      </ConfirmDialog>
    </section>
  );
}

function ContactDialog({
  institutionId,
  contact,
  onClose,
  onSaved,
}: {
  institutionId: string;
  contact: ContactOut | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const styles = useCampusStyles();
  const [name, setName] = useState(contact?.name ?? "");
  const [title, setTitle] = useState(contact?.title ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [primary, setPrimary] = useState(contact?.is_primary ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = "Enter a name.";
    if (email.trim() && !isEmail(email)) found.email = "Enter a valid email address.";
    if (phone.trim() && !isE164(phone)) found.phone = "Use international format, for example +919876543210.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      title: title.trim() || null,
      email: email.trim() || null,
      phone: phone.replace(/[\s-]/g, "") || null,
      is_primary: primary,
    };
    try {
      if (contact) await campusApi.updateContact(institutionId, contact.id, body);
      else await campusApi.addContact(institutionId, body);
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <DialogTitle>{contact ? "Edit placement officer" : "Add placement officer"}</DialogTitle>
            <DialogContent className={styles.stack}>
              <Field label="Name" required validationState={errors.name ? "error" : "none"} validationMessage={errors.name}>
                <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
              </Field>
              <Field label="Title">
                <Input value={title} maxLength={200} onChange={(_, d) => setTitle(d.value)} />
              </Field>
              <Field label="Email" validationState={errors.email ? "error" : "none"} validationMessage={errors.email}>
                <Input type="email" value={email} maxLength={320} onChange={(_, d) => setEmail(d.value)} />
              </Field>
              <Field
                label="Phone"
                hint="International format (E.164), for example +919876543210"
                validationState={errors.phone ? "error" : "none"}
                validationMessage={errors.phone}
              >
                <Input type="tel" value={phone} maxLength={40} onChange={(_, d) => setPhone(d.value)} />
              </Field>
              <Checkbox label="Primary contact" checked={primary} onChange={(_, d) => setPrimary(Boolean(d.checked))} />
              {error && (
                <MessageBar intent="error" role="alert">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button appearance="primary" type="submit" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined}>
                Save
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
