"use client";

import { Button, Dropdown, Field, Input, makeStyles, Option, Spinner, Subtitle2, Text, tokens } from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { PersonPicker } from "@/features/activity/person-picker";
import { activityKeys } from "@/features/activity/api";
import { DetailsDrawer, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { fieldErrors, isApiError } from "@/lib/api/errors";
import type { ClientCreatedOut, ClientOut, ClientStatus } from "@/lib/api/types";
import { clientKeys, clientsApi } from "./api";
import { clientErrorMessage } from "./errors";
import {
  buildClientCreate,
  buildClientUpdate,
  type ClientDraft,
  clientDraft,
  type FieldErrors,
  mapServerFields,
  validateClientDraft,
} from "./form";
import { CLIENT_STATUS_LABELS, CLIENT_STATUSES } from "./format";

const useStyles = makeStyles({
  locRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr auto",
    gap: tokens.spacingHorizontalS,
    alignItems: "end",
    "@media (max-width: 479px)": { gridTemplateColumns: "1fr 1fr" },
  },
  locError: { color: tokens.colorPaletteRedForeground1 },
});

/**
 * New / edit client form in a right-side `OverlayDrawer`. On create, near-duplicate names reported by
 * the API (`warnings`) are shown as a toast; `onSaved` receives the saved client.
 */
export function ClientDrawer({
  client,
  onClose,
  onSaved,
}: {
  client?: ClientOut | null;
  onClose: () => void;
  onSaved?: (client: ClientOut | ClientCreatedOut) => void;
}) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const editing = !!client;
  const [draft, setDraft] = useState<ClientDraft>(() => {
    const d = clientDraft(client);
    if (!client && me) return { ...d, ownerId: me.user.id, ownerName: me.user.name || me.user.email };
    return d;
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const update = (patch: Partial<ClientDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      if (client) return clientsApi.update(client.id, buildClientUpdate(client, draft));
      // The owner defaults to the caller server-side; only send it when someone else was picked.
      const body = buildClientCreate(draft);
      if (body.owner_id === me?.user.id) delete body.owner_id;
      return clientsApi.create(body);
    },
  });

  const unchanged = client ? Object.keys(buildClientUpdate(client, draft)).length === 0 : false;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const v = validateClientDraft(draft);
    setErrors(v);
    if (Object.keys(v).length) return;
    try {
      const saved = await save.mutateAsync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: clientKeys.all }),
        queryClient.invalidateQueries({ queryKey: activityKeys.timeline("clients", saved.id) }),
      ]);
      toast.success(editing ? `Saved ${saved.name}` : `Created ${saved.name}`);
      const warnings = editing ? [] : ((saved as ClientCreatedOut).warnings ?? []);
      if (warnings.length > 0) {
        toast.info(`Similar clients already exist: ${warnings.map((w) => w.name).join(", ")}`);
      }
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.status === 422) {
        const mapped = mapServerFields(fieldErrors(err), err.details.fields);
        if (Object.keys(mapped).length) {
          setErrors(mapped);
          return;
        }
      }
      if (isApiError(err) && err.code === "client_exists") {
        setErrors({ name: clientErrorMessage(err) });
        return;
      }
      setFormError(clientErrorMessage(err));
    }
  }

  const setLocation = (i: number, patch: Partial<ClientDraft["locations"][number]>) =>
    update({ locations: draft.locations.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const err = (name: string) =>
    errors[name] ? { validationState: "error" as const, validationMessage: errors[name] } : {};

  return (
    <DetailsDrawer
      open
      size="medium"
      title={editing ? `Edit ${client.name}` : "New client"}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button
            appearance="primary"
            type="submit"
            form="client-form"
            disabled={save.isPending || unchanged}
            icon={save.isPending ? <Spinner size="tiny" /> : undefined}
          >
            {editing ? "Save changes" : "Create client"}
          </Button>
          <Button appearance="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="client-form" className={admin.form} onSubmit={onSubmit} noValidate>
        <ErrorBar message={formError} />
        <Field label="Name" required {...err("name")}>
          <Input value={draft.name} maxLength={200} onChange={(_, d) => update({ name: d.value })} autoFocus />
        </Field>
        <Field label="Status">
          <Dropdown
            value={CLIENT_STATUS_LABELS[draft.status]}
            selectedOptions={[draft.status]}
            onOptionSelect={(_, d) => d.optionValue && update({ status: d.optionValue as ClientStatus })}
          >
            {CLIENT_STATUSES.map((s) => (
              <Option key={s} value={s}>
                {CLIENT_STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <PersonPicker
          label="Owner"
          value={draft.ownerId}
          valueLabel={draft.ownerName}
          onChange={(p) => p && update({ ownerId: p.id, ownerName: p.name })}
          unavailableHint={editing ? "You cannot browse people, so the owner cannot be changed here." : "You will be the owner."}
          hint={errors.owner_id}
        />
        <Field label="Industry" {...err("industry")}>
          <Input value={draft.industry} maxLength={200} onChange={(_, d) => update({ industry: d.value })} />
        </Field>
        <Field label="Website" hint="https:// is added when missing" {...err("website")}>
          <Input
            value={draft.website}
            maxLength={500}
            type="url"
            placeholder="www.example.com"
            onChange={(_, d) => update({ website: d.value })}
          />
        </Field>
        <Field label="GSTIN" hint="15 characters, for example 22AAAAA0000A1Z5" {...err("gstin")}>
          <Input
            value={draft.gstin}
            maxLength={15}
            onChange={(_, d) => update({ gstin: d.value.toUpperCase() })}
            spellCheck={false}
          />
        </Field>

        <Subtitle2 as="h3" className={admin.sectionTitle}>
          Locations
        </Subtitle2>
        {draft.locations.length === 0 && (
          <Text size={200} className={admin.muted}>
            No locations yet.
          </Text>
        )}
        {draft.locations.map((l, i) => (
          <div key={i}>
            <div className={styles.locRow}>
              <Field label="City" size="small">
                <Input size="small" value={l.city} maxLength={100} onChange={(_, d) => setLocation(i, { city: d.value })} />
              </Field>
              <Field label="State" size="small">
                <Input size="small" value={l.state} maxLength={100} onChange={(_, d) => setLocation(i, { state: d.value })} />
              </Field>
              <Field label="Country" size="small">
                <Input
                  size="small"
                  value={l.country}
                  maxLength={100}
                  onChange={(_, d) => setLocation(i, { country: d.value })}
                />
              </Field>
              <Button
                appearance="subtle"
                icon={<Delete20Regular />}
                aria-label={`Remove location ${i + 1}`}
                onClick={() => update({ locations: draft.locations.filter((_, j) => j !== i) })}
              />
            </div>
            {errors[`locations.${i}`] && (
              <Text size={200} className={styles.locError} role="alert">
                {errors[`locations.${i}`]}
              </Text>
            )}
          </div>
        ))}
        <div>
          <Button
            appearance="subtle"
            icon={<Add20Regular />}
            disabled={draft.locations.length >= 50}
            onClick={() => update({ locations: [...draft.locations, { city: "", state: "", country: "India" }] })}
          >
            Add location
          </Button>
        </div>
      </form>
    </DetailsDrawer>
  );
}
