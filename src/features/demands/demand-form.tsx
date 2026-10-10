"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Dropdown,
  Field,
  Input,
  type InputProps,
  makeStyles,
  Option,
  Text,
  Textarea,
  tokens,
  Tag,
  TagGroup,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { Controller, type FieldPath, useFieldArray, type UseFormReturn } from "react-hook-form";
import { SkillPicker } from "@/features/candidates/skill-picker";
import { clientKeys, clientsApi } from "@/features/clients/api";
import { MAX_PAGE_SIZE } from "@/features/admin/query";
import { usePermission } from "@/features/auth/use-permission";
import { AiFieldBadge } from "./ai-field-badge";
import { ClientPicker } from "./client-picker";
import {
  type DemandFormValues,
  EMPLOYMENT_LABELS,
  EMPLOYMENT_TYPES,
  RATE_UNIT_LABELS,
  RATE_UNITS,
  WORK_MODE_LABELS,
  WORK_MODES,
} from "./form";
import { PRIORITIES, PRIORITY_LABELS } from "./status";
import { RateCheckBadge } from "@/features/commercials/rate-cards/rate-check-badge";

const useStyles = makeStyles({
  panel: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, paddingBlock: tokens.spacingVerticalS },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: tokens.spacingHorizontalM,
    alignItems: "start",
  },
  tags: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  planRow: { display: "grid", gridTemplateColumns: "1fr 180px auto", gap: tokens.spacingHorizontalS, alignItems: "end" },
});

export type AiContext = { demandId: string; extracted: readonly string[]; canConfirm: boolean };

type Form = UseFormReturn<DemandFormValues>;

const INTERVIEW_KINDS: Record<string, string> = {
  screening: "Screening",
  technical: "Technical",
  managerial: "Managerial",
  client: "Client round",
  hr: "HR",
  interview: "Interview",
  other: "Other",
};

function badge(ai: AiContext | undefined, fields: readonly string[]) {
  if (!ai) return undefined;
  const has = fields.some((f) => ai.extracted.includes(f));
  return has ? <AiFieldBadge demandId={ai.demandId} extracted={ai.extracted} fields={fields} canConfirm={ai.canConfirm} /> : undefined;
}

function TextInput({
  ctl: form,
  name,
  label,
  ai,
  aiFields,
  hint,
  required,
  ...input
}: {
  ctl: Form;
  name: FieldPath<DemandFormValues>;
  label: string;
  ai?: AiContext;
  aiFields?: readonly string[];
  hint?: string;
  required?: boolean;
} & Omit<InputProps, "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "form">) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          required={required}
          hint={badge(ai, aiFields ?? []) ?? hint}
          validationState={fieldState.error ? "error" : "none"}
          validationMessage={fieldState.error?.message}
        >
          <Input
            {...input}
            ref={field.ref}
            name={field.name}
            value={(field.value as string | undefined) ?? ""}
            onChange={(_, d) => field.onChange(d.value)}
            onBlur={field.onBlur}
          />
        </Field>
      )}
    />
  );
}

function SelectInput<V extends string>({
  ctl: form,
  name,
  label,
  options,
  labels,
  allowEmpty,
  ai,
  aiFields,
}: {
  ctl: Form;
  name: FieldPath<DemandFormValues>;
  label: string;
  options: readonly V[];
  labels: Record<V, string>;
  allowEmpty?: boolean;
  ai?: AiContext;
  aiFields?: readonly string[];
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string) ?? "";
        return (
          <Field
            label={label}
            hint={badge(ai, aiFields ?? [])}
            validationState={fieldState.error ? "error" : "none"}
            validationMessage={fieldState.error?.message}
          >
            <Dropdown
              ref={field.ref}
              value={value ? (labels[value as V] ?? value) : allowEmpty ? "Not set" : ""}
              selectedOptions={[value]}
              onOptionSelect={(_, d) => field.onChange(d.optionValue ?? "")}
              onBlur={field.onBlur}
            >
              {allowEmpty && <Option value="">Not set</Option>}
              {options.map((o) => (
                <Option key={o} value={o}>
                  {labels[o]}
                </Option>
              ))}
            </Dropdown>
          </Field>
        );
      }}
    />
  );
}

function SkillsEditor({ form, ai }: { form: Form; ai?: AiContext }) {
  const styles = useStyles();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "skills" });
  const error = form.formState.errors.skills?.message;
  const keys = fields.filter((f) => f.skillId).map((f) => `${f.skillRefKind}:${f.skillId}`);

  const group = (kind: "mandatory" | "preferred") => {
    const items = fields.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === kind);
    return (
      <Field
        label={kind === "mandatory" ? "Mandatory skills" : "Preferred skills"}
        required={kind === "mandatory"}
        hint={badge(ai, [`${kind}_skills`])}
      >
        <div className={styles.panel}>
          {items.length === 0 ? (
            <Text size={200} className={styles.muted}>
              {kind === "mandatory" ? "At least one mandatory skill is needed to submit." : "None yet."}
            </Text>
          ) : (
            <TagGroup
              className={styles.tags}
              aria-label={kind === "mandatory" ? "Mandatory skills" : "Preferred skills"}
              onDismiss={(_, d) => remove(Number(d.value))}
            >
              {items.map(({ f, i }) => (
                <Tag
                  key={f.id}
                  value={String(i)}
                  dismissible
                  dismissIcon={{ "aria-label": `Remove ${f.label}` }}
                  appearance={f.skillId && f.status !== "pending" ? "filled" : "outline"}
                  secondaryText={!f.skillId || f.status === "pending" ? "pending" : undefined}
                >
                  {f.label}
                </Tag>
              ))}
            </TagGroup>
          )}
          <SkillPicker
            label={kind === "mandatory" ? "Add a mandatory skill" : "Add a preferred skill"}
            excludeKeys={keys}
            onPick={(skill, text) => {
              const label = (skill?.name ?? text).trim();
              if (!label || fields.some((f) => f.label.toLowerCase() === label.toLowerCase())) return;
              append({
                label,
                skillId: skill?.id ?? null,
                skillRefKind: skill?.kind ?? null,
                kind,
                status: skill?.status ?? "pending",
              });
            }}
          />
        </div>
      </Field>
    );
  };

  return (
    <>
      {group("mandatory")}
      {group("preferred")}
      {error && (
        <Text role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {error}
        </Text>
      )}
    </>
  );
}

function InterviewPlanEditor({ form }: { form: Form }) {
  const styles = useStyles();
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "interviewPlan" });
  return (
    <div className={styles.panel}>
      {fields.length === 0 && (
        <Text size={200} className={styles.muted}>
          No interview rounds yet.
        </Text>
      )}
      {fields.map((f, i) => (
        <div key={f.id} className={styles.planRow}>
          <TextInput ctl={form} name={`interviewPlan.${i}.name`} label={`Round ${i + 1}`} maxLength={200} />
          <Controller
            control={form.control}
            name={`interviewPlan.${i}.kind`}
            render={({ field }) => (
              <Field label="Kind">
                <Dropdown
                  value={INTERVIEW_KINDS[field.value] ?? field.value}
                  selectedOptions={[field.value]}
                  onOptionSelect={(_, d) => field.onChange(d.optionValue ?? "interview")}
                >
                  {Object.entries(INTERVIEW_KINDS).map(([k, label]) => (
                    <Option key={k} value={k}>
                      {label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
          />
          <div>
            <Button appearance="subtle" icon={<ArrowUp20Regular />} aria-label={`Move round ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)} />
            <Button
              appearance="subtle"
              icon={<ArrowDown20Regular />}
              aria-label={`Move round ${i + 1} down`}
              disabled={i === fields.length - 1}
              onClick={() => move(i, i + 1)}
            />
            <Button appearance="subtle" icon={<Delete20Regular />} aria-label={`Remove round ${i + 1}`} onClick={() => remove(i)} />
          </div>
        </div>
      ))}
      <div>
        <Button appearance="subtle" icon={<Add20Regular />} disabled={fields.length >= 20} onClick={() => append({ name: "", kind: "technical" })}>
          Add round
        </Button>
      </div>
    </div>
  );
}

function HiringManagerSelect({ form, clientId }: { form: Form; clientId: string }) {
  const canRead = usePermission("contact:read");
  const contacts = useQuery({
    queryKey: clientKeys.contactList(clientId, false, 1),
    queryFn: ({ signal }) => clientsApi.listContacts(clientId, false, 1, MAX_PAGE_SIZE, signal),
    enabled: canRead && !!clientId,
  });
  const options = contacts.data?.items ?? [];
  return (
    <Controller
      control={form.control}
      name="hiringManagerContactId"
      render={({ field, fieldState }) => {
        const current = options.find((c) => c.id === field.value);
        return (
          <Field
            label="Hiring manager"
            hint={!canRead ? "You cannot browse contacts." : !clientId ? "Choose a client first." : undefined}
            validationState={fieldState.error ? "error" : "none"}
            validationMessage={fieldState.error?.message}
          >
            <Dropdown
              disabled={!canRead || !clientId}
              value={current ? current.name : field.value ? "Selected contact" : "Not set"}
              selectedOptions={[field.value]}
              onOptionSelect={(_, d) => field.onChange(d.optionValue ?? "")}
            >
              <Option value="">Not set</Option>
              {options.map((c) => (
                <Option key={c.id} value={c.id} text={c.name}>
                  {c.title ? `${c.name} (${c.title})` : c.name}
                </Option>
              ))}
            </Dropdown>
          </Field>
        );
      }}
    />
  );
}

/**
 * Demand fields grouped in `Accordion` sections (Basics, Location & work, Skills & experience,
 * Commercials, Dates & limits, Interview plan). Commercials are hidden without `compensation:view`.
 * `ai` shows "AI-extracted" badges beside fields awaiting confirmation.
 */
export function DemandForm({
  form,
  ai,
  clientLocked,
  showCompensation,
}: {
  form: Form;
  ai?: AiContext;
  clientLocked?: boolean;
  showCompensation: boolean;
}) {
  const styles = useStyles();
  const clientId = form.watch("clientId");
  const clientName = form.watch("clientName");

  return (
    <Accordion multiple collapsible defaultOpenItems={["basics", "skills"]}>
      <AccordionItem value="basics">
        <AccordionHeader as="h3">Basics</AccordionHeader>
        <AccordionPanel className={styles.panel}>
          <TextInput ctl={form} name="title" label="Title" required maxLength={300} ai={ai} aiFields={["title"]} autoFocus />
          <Controller
            control={form.control}
            name="clientId"
            render={({ fieldState }) => (
              <ClientPicker
                required
                value={clientId || null}
                valueLabel={clientName}
                disabled={clientLocked}
                hint={clientLocked ? "The client can only change while the demand is a draft." : undefined}
                validationMessage={fieldState.error?.message}
                onChange={(c) => {
                  form.setValue("clientId", c?.id ?? "", { shouldDirty: true, shouldValidate: true });
                  form.setValue("clientName", c?.name ?? "", { shouldDirty: true });
                  form.setValue("hiringManagerContactId", "", { shouldDirty: true });
                }}
              />
            )}
          />
          <div className={styles.grid}>
            <HiringManagerSelect form={form} clientId={clientId} />
            <TextInput ctl={form} name="endClient" label="End client" maxLength={300} />
            <TextInput ctl={form} name="department" label="Department" maxLength={200} />
            <TextInput ctl={form} name="positions" label="Positions" required inputMode="numeric" ai={ai} aiFields={["positions"]} />
            <SelectInput ctl={form} name="priority" label="Priority" options={PRIORITIES} labels={PRIORITY_LABELS} />
            <SelectInput
              ctl={form}
              name="employmentType"
              label="Employment type"
              options={EMPLOYMENT_TYPES}
              labels={EMPLOYMENT_LABELS}
              allowEmpty
              ai={ai}
              aiFields={["employment_type"]}
            />
          </div>
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem value="location">
        <AccordionHeader as="h3">Location &amp; work</AccordionHeader>
        <AccordionPanel className={styles.panel}>
          <div className={styles.grid}>
            <TextInput ctl={form} name="country" label="Country" hint="2-letter code, e.g. IN" maxLength={2} ai={ai} aiFields={["country"]} />
            <TextInput ctl={form} name="location" label="Location" maxLength={300} ai={ai} aiFields={["location"]} />
            <SelectInput ctl={form} name="workMode" label="Work mode" options={WORK_MODES} labels={WORK_MODE_LABELS} allowEmpty ai={ai} aiFields={["work_mode"]} />
            <TextInput ctl={form} name="shift" label="Shift" maxLength={100} />
            <TextInput ctl={form} name="travelPercent" label="Travel %" inputMode="numeric" />
          </div>
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem value="skills">
        <AccordionHeader as="h3">Skills &amp; experience</AccordionHeader>
        <AccordionPanel className={styles.panel}>
          <SkillsEditor form={form} ai={ai} />
          <div className={styles.grid}>
            <TextInput ctl={form} name="minExperience" label="Min experience (years)" inputMode="decimal" ai={ai} aiFields={["min_experience_years"]} />
            <TextInput ctl={form} name="maxExperience" label="Max experience (years)" inputMode="decimal" ai={ai} aiFields={["max_experience_years"]} />
          </div>
          <Controller
            control={form.control}
            name="education"
            render={({ field }) => (
              <Field label="Education">
                <Textarea value={field.value} maxLength={500} resize="vertical" onChange={(_, d) => field.onChange(d.value)} />
              </Field>
            )}
          />
          <TextInput ctl={form} name="certifications" label="Certifications" hint="Separate with commas" ai={ai} aiFields={["certifications"]} />
          <div className={styles.grid}>
            <TextInput ctl={form} name="languages" label="Languages" hint="Separate with commas" />
            <TextInput ctl={form} name="workAuthorization" label="Work authorization" hint="Separate with commas" />
            <TextInput ctl={form} name="clearance" label="Clearance" maxLength={200} />
          </div>
        </AccordionPanel>
      </AccordionItem>

      {showCompensation && (
        <AccordionItem value="commercials">
          <AccordionHeader as="h3">Commercials</AccordionHeader>
          <AccordionPanel className={styles.panel}>
            <div className={styles.grid}>
              <TextInput ctl={form} name="billRate" label="Bill rate" inputMode="decimal" ai={ai} aiFields={["bill_rate"]} />
              <TextInput ctl={form} name="payRateMin" label="Pay rate (min)" inputMode="decimal" ai={ai} aiFields={["pay_rate_min"]} />
              <TextInput ctl={form} name="payRateMax" label="Pay rate (max)" inputMode="decimal" ai={ai} aiFields={["pay_rate_max"]} />
              <TextInput ctl={form} name="currency" label="Currency" hint="e.g. INR, USD" maxLength={3} ai={ai} aiFields={["currency"]} />
              <SelectInput ctl={form} name="rateUnit" label="Rate unit" options={RATE_UNITS} labels={RATE_UNIT_LABELS} allowEmpty ai={ai} aiFields={["rate_unit"]} />
            </div>
            {/* Epic 16: live check against the client's rate card. */}
            <RateCheckBadge
              input={{
                subject_kind: "demand",
                client_id: clientId,
                role: form.watch("title"),
                location: form.watch("location") || null,
                experience_years: form.watch("minExperience") || null,
                bill_rate: form.watch("billRate") || null,
                currency: form.watch("currency") || "",
                rate_unit: form.watch("rateUnit") || "",
              }}
            />
          </AccordionPanel>
        </AccordionItem>
      )}

      <AccordionItem value="dates">
        <AccordionHeader as="h3">Dates &amp; limits</AccordionHeader>
        <AccordionPanel className={styles.panel}>
          <div className={styles.grid}>
            <TextInput ctl={form} name="startDate" label="Start date" type="date" ai={ai} aiFields={["start_date"]} />
            <TextInput ctl={form} name="targetClosureDate" label="Target closure date" type="date" />
            <TextInput ctl={form} name="submissionLimit" label="Submission limit" inputMode="numeric" hint="Maximum candidates to submit" />
          </div>
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem value="interviews">
        <AccordionHeader as="h3">Interview plan</AccordionHeader>
        <AccordionPanel>
          <InterviewPlanEditor form={form} />
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}
