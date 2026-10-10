"use client";

import {
  Button,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  SpinButton,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { PersonPicker } from "@/features/activity/person-picker";
import { DetailsDrawer, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { clientsApi } from "@/features/clients/api";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { SERVICE_LABELS, SERVICES } from "../format";
import type { LeadOut, Service } from "../types";
import { useLeadMutations } from "../use-leads";
import { applyConvertError, buildConvertIn, initialWizard, stepErrors, type WizardState } from "./convert-logic";

const useStyles = makeStyles({
  steps: { display: "flex", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM, flexWrap: "wrap" },
  stepOn: { fontWeight: tokens.fontWeightSemibold, color: tokens.colorBrandForeground1 },
  stepOff: { color: tokens.colorNeutralForeground3 },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalM },
  line: { display: "grid", gridTemplateColumns: "1fr 120px auto", gap: tokens.spacingHorizontalS, alignItems: "end" },
});

const STEP_LABELS = ["1. Client", "2. Contact", "3. Opportunity"];

/** Convert a qualified lead: Client (link/create) → Contact (link/create/none) → Opportunity. */
export function ConvertWizard({ lead, onClose }: { lead: LeadOut; onClose: () => void }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const router = useRouter();
  const { convert } = useLeadMutations();
  const [s, setS] = useState<WizardState>(() => initialWizard(lead));
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const errs = stepErrors(s);
  const linkedClientId = s.client.mode === "link" ? s.client.clientId : null;

  const contacts = useQuery({
    queryKey: ["clients", "detail", linkedClientId ?? "", "contacts", false, 1],
    queryFn: ({ signal }) => clientsApi.listContacts(linkedClientId!, false, 1, 100, signal),
    enabled: !!linkedClientId && s.step === 1,
  });

  const patch = (p: Partial<WizardState>) => setS((x) => ({ ...x, ...p }));
  const opp = (p: Partial<WizardState["opportunity"]>) => setS((x) => ({ ...x, opportunity: { ...x.opportunity, ...p } }));

  async function submit() {
    setError(null);
    try {
      const out = await convert.mutateAsync({ id: lead.id, body: buildConvertIn(s) });
      toast.success(`Converted to ${out.opportunity.human_id}`);
      onClose();
      router.push(`/opportunities/${out.opportunity.id}`);
    } catch (e) {
      const next = applyConvertError(s, e);
      if (next) setS(next);
      else setError(errorMessage(e));
    }
  }

  function next() {
    setShowErrors(true);
    if (errs.length) return;
    setShowErrors(false);
    if (s.step < 2) patch({ step: (s.step + 1) as 1 | 2 });
    else void submit();
  }

  return (
    <DetailsDrawer
      open
      size="medium"
      title={`Convert ${lead.human_id}`}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button
            appearance="primary"
            disabled={convert.isPending}
            icon={convert.isPending ? <Spinner size="tiny" /> : undefined}
            onClick={next}
          >
            {s.step < 2 ? "Next" : "Convert"}
          </Button>
          {s.step > 0 && (
            <Button disabled={convert.isPending} onClick={() => patch({ step: (s.step - 1) as 0 | 1 })}>
              Back
            </Button>
          )}
          <Button appearance="subtle" onClick={onClose} disabled={convert.isPending}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className={styles.steps} aria-label="Steps">
        {STEP_LABELS.map((l, i) => (
          <Text key={l} className={i === s.step ? styles.stepOn : styles.stepOff} aria-current={i === s.step ? "step" : undefined}>
            {l}
          </Text>
        ))}
      </div>
      <div className={admin.form}>
        {error && <ErrorBar message={error} />}
        {s.notice && (
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>{s.notice}</MessageBarBody>
          </MessageBar>
        )}
        {showErrors && errs.length > 0 && (
          <MessageBar intent="error" layout="multiline">
            <MessageBarBody>{errs.join(" ")}</MessageBarBody>
          </MessageBar>
        )}

        {s.step === 0 && (
          <>
            <RadioGroup
              value={s.client.mode}
              onChange={(_, d) =>
                patch({
                  client:
                    d.value === "link"
                      ? { mode: "link", clientId: null, clientName: "", suggested: false }
                      : { mode: "create", name: lead.company_name, website: lead.website ?? "", industry: lead.industry ?? "", gstin: lead.gstin ?? "" },
                  contact: s.contact.mode === "link" ? { mode: "none" } : s.contact,
                })
              }
            >
              <Radio value="create" label="Create a new client from this lead" />
              <Radio value="link" label="Link to an existing client" />
            </RadioGroup>
            {s.client.mode === "link" ? (
              <ClientPicker
                value={s.client.clientId}
                valueLabel={s.client.clientName}
                required
                onChange={(c) =>
                  patch({ client: { mode: "link", clientId: c?.id ?? null, clientName: c?.name ?? "", suggested: false }, contact: { mode: "none" } })
                }
              />
            ) : (
              <div className={styles.two}>
                <Field label="Client name" required>
                  <Input
                    value={s.client.name}
                    maxLength={200}
                    onChange={(_, d) => s.client.mode === "create" && patch({ client: { ...s.client, name: d.value } })}
                  />
                </Field>
                <Field label="Website">
                  <Input
                    value={s.client.website}
                    onChange={(_, d) => s.client.mode === "create" && patch({ client: { ...s.client, website: d.value } })}
                  />
                </Field>
                <Field label="Industry">
                  <Input
                    value={s.client.industry}
                    onChange={(_, d) => s.client.mode === "create" && patch({ client: { ...s.client, industry: d.value } })}
                  />
                </Field>
                <Field label="GSTIN">
                  <Input
                    value={s.client.gstin}
                    onChange={(_, d) => s.client.mode === "create" && patch({ client: { ...s.client, gstin: d.value } })}
                  />
                </Field>
              </div>
            )}
          </>
        )}

        {s.step === 1 && (
          <>
            <RadioGroup
              value={s.contact.mode}
              onChange={(_, d) =>
                patch({
                  contact:
                    d.value === "none"
                      ? { mode: "none" }
                      : d.value === "link"
                        ? { mode: "link", contactId: null }
                        : initialWizard(lead).contact.mode === "create"
                          ? initialWizard(lead).contact
                          : { mode: "create", firstName: "", lastName: "", email: "", phone: "", title: "" },
                })
              }
            >
              <Radio value="create" label="Create a contact" />
              <Radio value="link" label="Link an existing contact" disabled={!linkedClientId} />
              <Radio value="none" label="No contact" />
            </RadioGroup>
            {s.contact.mode === "link" && (
              <Field label="Contact" required>
                <Dropdown
                  placeholder={contacts.isPending ? "Loading…" : "Choose a contact"}
                  value={contacts.data?.items.find((c) => s.contact.mode === "link" && c.id === s.contact.contactId)?.name ?? ""}
                  selectedOptions={s.contact.contactId ? [s.contact.contactId] : []}
                  onOptionSelect={(_, d) => patch({ contact: { mode: "link", contactId: d.optionValue ?? null } })}
                >
                  {(contacts.data?.items ?? []).map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.name}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            {s.contact.mode === "create" && (
              <div className={styles.two}>
                {(
                  [
                    ["firstName", "First name"],
                    ["lastName", "Last name"],
                    ["email", "Email"],
                    ["phone", "Phone"],
                    ["title", "Title"],
                  ] as const
                ).map(([k, label]) => (
                  <Field key={k} label={label} required={k === "firstName"}>
                    <Input
                      value={s.contact.mode === "create" ? s.contact[k] : ""}
                      onChange={(_, d) => s.contact.mode === "create" && patch({ contact: { ...s.contact, [k]: d.value } })}
                    />
                  </Field>
                ))}
              </div>
            )}
          </>
        )}

        {s.step === 2 && (
          <>
            <Field label="Opportunity name" required>
              <Input value={s.opportunity.name} maxLength={300} onChange={(_, d) => opp({ name: d.value })} />
            </Field>
            <div className={styles.two}>
              <Field label="Service">
                <Dropdown
                  value={SERVICE_LABELS[s.opportunity.service]}
                  selectedOptions={[s.opportunity.service]}
                  onOptionSelect={(_, d) => d.optionValue && opp({ service: d.optionValue as Service })}
                >
                  {SERVICES.map((v) => (
                    <Option key={v} value={v}>
                      {SERVICE_LABELS[v]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Expected close date">
                <Input type="date" value={s.opportunity.closeDate} onChange={(_, d) => opp({ closeDate: d.value })} />
              </Field>
              <Field label="Estimated revenue">
                <Input
                  inputMode="decimal"
                  value={s.opportunity.estimatedRevenue}
                  onChange={(_, d) => opp({ estimatedRevenue: d.value })}
                />
              </Field>
              <Field label="Currency">
                <Input value={s.opportunity.currency} maxLength={3} onChange={(_, d) => opp({ currency: d.value.toUpperCase() })} />
              </Field>
              <PersonPicker
                label="Owner"
                value={s.opportunity.ownerId}
                valueLabel={s.opportunity.ownerName}
                onChange={(p) => opp({ ownerId: p?.id ?? null, ownerName: p?.name ?? "" })}
              />
              <PersonPicker
                label="Account manager"
                value={s.opportunity.accountManagerId}
                valueLabel={s.opportunity.accountManagerName}
                clearLabel="None"
                onChange={(p) => opp({ accountManagerId: p?.id ?? null, accountManagerName: p?.name ?? "" })}
              />
            </div>
            <Subtitle2 as="h3" className={admin.sectionTitle}>
              Role lines
            </Subtitle2>
            {s.opportunity.lines.map((l, i) => (
              <div key={i} className={styles.line}>
                <Field label={i === 0 ? "Title" : undefined}>
                  <Input
                    aria-label={`Line ${i + 1} title`}
                    value={l.title}
                    onChange={(_, d) => opp({ lines: s.opportunity.lines.map((x, j) => (j === i ? { ...x, title: d.value } : x)) })}
                  />
                </Field>
                <Field label={i === 0 ? "Positions" : undefined}>
                  <SpinButton
                    aria-label={`Line ${i + 1} positions`}
                    min={1}
                    value={l.positions}
                    onChange={(_, d) => {
                      const v = d.value ?? Number(d.displayValue);
                      if (Number.isFinite(v) && (v as number) >= 1)
                        opp({ lines: s.opportunity.lines.map((x, j) => (j === i ? { ...x, positions: Math.round(v as number) } : x)) });
                    }}
                  />
                </Field>
                <Button
                  appearance="subtle"
                  icon={<Delete20Regular />}
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => opp({ lines: s.opportunity.lines.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <div>
              <Button icon={<Add20Regular />} onClick={() => opp({ lines: [...s.opportunity.lines, { title: "", positions: 1 }] })}>
                Add line
              </Button>
            </div>
          </>
        )}
      </div>
    </DetailsDrawer>
  );
}
