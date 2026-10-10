"use client";

import { Button, Dropdown, Field, Input, Option, Spinner } from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { activityKeys } from "@/features/activity/api";
import { DetailsDrawer, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { fieldErrors, isApiError } from "@/lib/api/errors";
import type { ContactOut, ContactType } from "@/lib/api/types";
import { clientKeys, clientsApi } from "./api";
import { clientErrorMessage } from "./errors";
import {
  buildContactCreate,
  buildContactUpdate,
  type ContactDraft,
  contactDraft,
  type FieldErrors,
  validateContactDraft,
} from "./form";
import { CONTACT_TYPE_LABELS, CONTACT_TYPES } from "./format";

/** Add / edit a client contact in a right-side drawer. `readOnly` shows the details without saving. */
export function ContactDrawer({
  clientId,
  contact,
  readOnly,
  onClose,
}: {
  clientId: string;
  contact?: ContactOut | null;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ContactDraft>(() => contactDraft(contact));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const update = (patch: Partial<ContactDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = useMutation({
    mutationFn: () =>
      contact
        ? clientsApi.updateContact(contact.id, buildContactUpdate(contact, draft))
        : clientsApi.createContact(clientId, buildContactCreate(draft)),
  });
  const unchanged = contact ? Object.keys(buildContactUpdate(contact, draft)).length === 0 : false;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setFormError(null);
    const v = validateContactDraft(draft);
    setErrors(v);
    if (Object.keys(v).length) return;
    try {
      const saved = await save.mutateAsync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) }),
        queryClient.invalidateQueries({ queryKey: activityKeys.timeline("clients", clientId) }),
      ]);
      toast.success(contact ? `Saved ${saved.name}` : `Added ${saved.name}`);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.status === 422) {
        const f = fieldErrors(err);
        if (Object.keys(f).length) {
          setErrors(f);
          return;
        }
      }
      if (isApiError(err) && err.code === "contact_exists") {
        setErrors({ email: clientErrorMessage(err) });
        return;
      }
      setFormError(clientErrorMessage(err));
    }
  }

  const err = (name: string) =>
    errors[name] ? { validationState: "error" as const, validationMessage: errors[name] } : {};

  return (
    <DetailsDrawer
      open
      size="small"
      title={contact ? (readOnly ? contact.name : `Edit ${contact.name}`) : "Add contact"}
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          {!readOnly && (
            <Button
              appearance="primary"
              type="submit"
              form="contact-form"
              disabled={save.isPending || unchanged}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
            >
              {contact ? "Save changes" : "Add contact"}
            </Button>
          )}
          <Button appearance="secondary" onClick={onClose} disabled={save.isPending}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
        </div>
      }
    >
      <form id="contact-form" className={styles.form} onSubmit={onSubmit} noValidate>
        <ErrorBar message={formError} />
        <Field label="Name" required {...err("name")}>
          <Input
            value={draft.name}
            maxLength={200}
            readOnly={readOnly}
            autoFocus={!readOnly}
            onChange={(_, d) => update({ name: d.value })}
          />
        </Field>
        <Field label="Job title" {...err("title")}>
          <Input value={draft.title} maxLength={200} readOnly={readOnly} onChange={(_, d) => update({ title: d.value })} />
        </Field>
        <Field label="Contact type">
          <Dropdown
            value={CONTACT_TYPE_LABELS[draft.type]}
            selectedOptions={[draft.type]}
            disabled={readOnly}
            onOptionSelect={(_, d) => d.optionValue && update({ type: d.optionValue as ContactType })}
          >
            {CONTACT_TYPES.map((t) => (
              <Option key={t} value={t}>
                {CONTACT_TYPE_LABELS[t]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Email" {...err("email")}>
          <Input
            type="email"
            value={draft.email}
            maxLength={254}
            readOnly={readOnly}
            onChange={(_, d) => update({ email: d.value })}
          />
        </Field>
        <Field label="Phone" hint={readOnly ? undefined : "Indian numbers can omit +91"} {...err("phone")}>
          <Input
            type="tel"
            value={draft.phone}
            maxLength={40}
            readOnly={readOnly}
            onChange={(_, d) => update({ phone: d.value })}
          />
        </Field>
      </form>
    </DetailsDrawer>
  );
}
