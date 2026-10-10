"use client";

import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Radio,
  RadioGroup,
  Subtitle2,
  Textarea,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Sparkle16Regular, Warning16Regular } from "@fluentui/react-icons";
import type { CompensationUnit } from "@/lib/api/types";
import { COMPENSATION_UNITS, SOURCE_LABELS, SOURCES, UNIT_LABELS } from "./format";
import {
  type CandidateFormValues,
  type CompensationGroup,
  emptyCertification,
  emptyEducation,
  emptyEmployment,
  type FormErrors,
  type LinkKind,
  type SkillRow,
} from "./form";
import { SkillPicker } from "./skill-picker";
import { TagNamesPicker } from "./tags-picker";

export const useFormStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  sectionHead: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    alignItems: "start",
  },
  row: {
    display: "grid",
    gap: tokens.spacingHorizontalS,
    gridTemplateColumns: "1fr auto auto",
    alignItems: "end",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  chips: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  skill: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1fr) 90px 150px auto",
    gap: tokens.spacingHorizontalS,
    alignItems: "end",
  },
  skillName: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, minHeight: "32px" },
  warn: { color: tokens.colorPaletteMarigoldForeground1 },
});

/** "AI" badge shown next to fields pre-filled from a parsed resume. */
export function AiBadge() {
  return (
    <Tooltip content="Filled from the resume by AI. Check before saving." relationship="description">
      <Badge size="small" appearance="tint" color="brand" icon={<Sparkle16Regular />} style={{ marginLeft: 6 }}>
        AI
      </Badge>
    </Tooltip>
  );
}

type Patch = (patch: Partial<CandidateFormValues>) => void;

function label(text: string, ai: boolean) {
  return (
    <>
      {text}
      {ai && <AiBadge />}
    </>
  );
}

function TextInput({
  text,
  value,
  onChange,
  error,
  ai = false,
  required,
  type,
  maxLength = 200,
  disabled,
  hint,
}: {
  text: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  ai?: boolean;
  required?: boolean;
  type?: "text" | "date" | "number" | "email" | "tel" | "url";
  maxLength?: number;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Field
      label={label(text, ai)}
      required={required}
      hint={hint}
      validationState={error ? "error" : "none"}
      validationMessage={error}
    >
      <Input type={type} value={value} maxLength={maxLength} disabled={disabled} onChange={(_, d) => onChange(d.value)} />
    </Field>
  );
}

function CompensationFields({
  title,
  value,
  onChange,
  errors,
  prefix,
  ai,
  disabled,
}: {
  title: string;
  value: CompensationGroup;
  onChange: (v: CompensationGroup) => void;
  errors: FormErrors;
  prefix: "current_ctc" | "expected_ctc";
  ai: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      <TextInput
        text={`${title} amount`}
        type="number"
        value={value.amount}
        ai={ai}
        disabled={disabled}
        error={errors[`${prefix}.amount`]}
        onChange={(amount) => onChange({ ...value, amount })}
      />
      <TextInput
        text="Currency"
        value={value.currency}
        maxLength={3}
        disabled={disabled}
        error={errors[`${prefix}.currency`]}
        onChange={(currency) => onChange({ ...value, currency: currency.toUpperCase() })}
      />
      <Field label="Per">
        <Dropdown
          disabled={disabled}
          value={value.unit ? UNIT_LABELS[value.unit] : ""}
          selectedOptions={value.unit ? [value.unit] : []}
          onOptionSelect={(_, d) => onChange({ ...value, unit: (d.optionValue as CompensationUnit) ?? "" })}
        >
          {COMPENSATION_UNITS.map((u) => (
            <Option key={u} value={u}>
              {UNIT_LABELS[u]}
            </Option>
          ))}
        </Dropdown>
      </Field>
    </>
  );
}

const LINK_KINDS: { id: LinkKind; label: string }[] = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "github", label: "GitHub" },
  { id: "portfolio", label: "Portfolio" },
  { id: "other", label: "Other" },
];

/**
 * All candidate fields with field arrays (emails, phones, links, employment, education, certifications,
 * optional skills and tags). Controlled: `values` + `onChange(patch)`.
 */
export function CandidateFormFields({
  values,
  onChange,
  errors,
  aiFields = [],
  compensationHidden = false,
  showSkills = true,
  showTags = true,
}: {
  values: CandidateFormValues;
  onChange: Patch;
  errors: FormErrors;
  aiFields?: readonly string[];
  /** The viewer cannot see compensation (masked): the fields are not rendered and never sent. */
  compensationHidden?: boolean;
  showSkills?: boolean;
  showTags?: boolean;
}) {
  const styles = useFormStyles();
  const ai = (f: string) => aiFields.includes(f);
  const v = values;

  const setListItem = <K extends "emails" | "phones" | "links" | "employment" | "education" | "certifications">(
    key: K,
    index: number,
    patch: Partial<CandidateFormValues[K][number]>,
  ) => {
    const list = [...v[key]] as CandidateFormValues[K][number][];
    list[index] = { ...list[index], ...patch };
    onChange({ [key]: list } as Partial<CandidateFormValues>);
  };
  const removeListItem = (key: "emails" | "phones" | "links" | "employment" | "education" | "certifications", i: number) =>
    onChange({ [key]: (v[key] as unknown[]).filter((_, j) => j !== i) } as Partial<CandidateFormValues>);

  return (
    <div className={styles.form}>
      <div className={styles.grid}>
        <TextInput
          text="Full name"
          required
          value={v.full_name}
          ai={ai("full_name")}
          error={errors.full_name}
          onChange={(full_name) => onChange({ full_name })}
        />
        <TextInput
          text="Current title"
          value={v.current_title}
          ai={ai("current_title")}
          onChange={(current_title) => onChange({ current_title })}
        />
        <TextInput
          text="Current employer"
          value={v.current_employer}
          ai={ai("current_employer")}
          onChange={(current_employer) => onChange({ current_employer })}
        />
        <TextInput
          text="Total experience (years)"
          type="number"
          value={v.experience_years}
          ai={ai("total_experience_months")}
          error={errors.experience_years}
          onChange={(experience_years) => onChange({ experience_years })}
        />
      </div>

      <section className={styles.section} aria-label="Contact">
        <Subtitle2 as="h3">
          Contact
          {(ai("emails") || ai("phones") || ai("links")) && <AiBadge />}
        </Subtitle2>
        {v.emails.map((row, i) => (
          <div key={`e${i}`} className={styles.row}>
            <TextInput
              text={i === 0 ? "Email" : `Email ${i + 1}`}
              type="email"
              maxLength={320}
              value={row.email}
              error={errors[`emails.${i}.email`]}
              onChange={(email) => setListItem("emails", i, { email })}
            />
            <Radio
              label="Primary"
              checked={row.is_primary}
              onChange={() => onChange({ emails: v.emails.map((e, j) => ({ ...e, is_primary: j === i })) })}
            />
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              aria-label={`Remove email ${i + 1}`}
              onClick={() => removeListItem("emails", i)}
            />
          </div>
        ))}
        {v.phones.map((row, i) => (
          <div key={`p${i}`} className={styles.row}>
            <TextInput
              text={i === 0 ? "Phone" : `Phone ${i + 1}`}
              type="tel"
              maxLength={40}
              hint={i === 0 ? "Indian numbers can be entered without +91." : undefined}
              value={row.phone}
              error={errors[`phones.${i}.phone`]}
              onChange={(phone) => setListItem("phones", i, { phone })}
            />
            <Radio
              label="Primary"
              checked={row.is_primary}
              onChange={() => onChange({ phones: v.phones.map((p, j) => ({ ...p, is_primary: j === i })) })}
            />
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              aria-label={`Remove phone ${i + 1}`}
              onClick={() => removeListItem("phones", i)}
            />
          </div>
        ))}
        {v.links.map((row, i) => (
          <div key={`l${i}`} className={styles.row}>
            <TextInput
              text={`Link ${i + 1}`}
              type="url"
              maxLength={1000}
              value={row.url}
              error={errors[`links.${i}.url`]}
              onChange={(url) => setListItem("links", i, { url })}
            />
            <Field label="Kind">
              <Dropdown
                value={LINK_KINDS.find((k) => k.id === row.kind)?.label ?? "Detect"}
                selectedOptions={row.kind ? [row.kind] : []}
                onOptionSelect={(_, d) => setListItem("links", i, { kind: (d.optionValue as LinkKind) ?? "" })}
              >
                {LINK_KINDS.map((k) => (
                  <Option key={k.id} value={k.id}>
                    {k.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              aria-label={`Remove link ${i + 1}`}
              onClick={() => removeListItem("links", i)}
            />
          </div>
        ))}
        <div className={styles.chips}>
          <Button icon={<Add20Regular />} onClick={() => onChange({ emails: [...v.emails, { email: "", is_primary: v.emails.length === 0 }] })}>
            Email
          </Button>
          <Button icon={<Add20Regular />} onClick={() => onChange({ phones: [...v.phones, { phone: "", is_primary: v.phones.length === 0 }] })}>
            Phone
          </Button>
          <Button icon={<Add20Regular />} onClick={() => onChange({ links: [...v.links, { url: "", kind: "" }] })}>
            Link
          </Button>
        </div>
      </section>

      <section className={styles.section} aria-label="Location and availability">
        <Subtitle2 as="h3">Location and availability</Subtitle2>
        <div className={styles.grid}>
          <TextInput text="City" value={v.city} ai={ai("location")} onChange={(city) => onChange({ city })} />
          <TextInput text="State" value={v.state} ai={ai("location")} onChange={(state) => onChange({ state })} />
          <TextInput text="Country" value={v.country} ai={ai("location")} onChange={(country) => onChange({ country })} />
          <TextInput
            text="Notice period (days)"
            type="number"
            value={v.notice_period_days}
            error={errors.notice_period_days}
            onChange={(notice_period_days) => onChange({ notice_period_days })}
          />
          <TextInput
            text="Available from"
            type="date"
            value={v.availability_date}
            onChange={(availability_date) => onChange({ availability_date })}
          />
          <TextInput
            text="Last working day"
            type="date"
            value={v.last_working_date}
            onChange={(last_working_date) => onChange({ last_working_date })}
          />
          <TextInput
            text="Work authorization"
            value={v.work_authorization}
            onChange={(work_authorization) => onChange({ work_authorization })}
          />
          <Field label="Willing to relocate">
            <RadioGroup
              layout="horizontal"
              value={v.willing_to_relocate}
              onChange={(_, d) => onChange({ willing_to_relocate: d.value as CandidateFormValues["willing_to_relocate"] })}
            >
              <Radio value="yes" label="Yes" />
              <Radio value="no" label="No" />
              <Radio value="" label="Unknown" />
            </RadioGroup>
          </Field>
        </div>
      </section>

      <section className={styles.section} aria-label="Compensation">
        <Subtitle2 as="h3">Compensation</Subtitle2>
        {compensationHidden ? (
          <span className={styles.warn}>Compensation is hidden for you. It is kept unchanged.</span>
        ) : (
          <>
            <div className={styles.grid}>
              <CompensationFields
                title="Current"
                prefix="current_ctc"
                value={v.current_ctc}
                errors={errors}
                ai={ai("current_ctc_amount")}
                onChange={(current_ctc) => onChange({ current_ctc })}
              />
            </div>
            <div className={styles.grid}>
              <CompensationFields
                title="Expected"
                prefix="expected_ctc"
                value={v.expected_ctc}
                errors={errors}
                ai={ai("expected_ctc_amount")}
                onChange={(expected_ctc) => onChange({ expected_ctc })}
              />
            </div>
          </>
        )}
      </section>

      <section className={styles.section} aria-label="Source">
        <Subtitle2 as="h3">Source</Subtitle2>
        <div className={styles.grid}>
          <Field label="Source">
            <Dropdown
              value={v.source ? SOURCE_LABELS[v.source] : ""}
              selectedOptions={v.source ? [v.source] : []}
              onOptionSelect={(_, d) => onChange({ source: (d.optionValue as CandidateFormValues["source"]) ?? "" })}
            >
              {SOURCES.map((src) => (
                <Option key={src} value={src}>
                  {SOURCE_LABELS[src]}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <TextInput
            text="Source detail"
            maxLength={500}
            value={v.source_detail}
            onChange={(source_detail) => onChange({ source_detail })}
          />
        </div>
      </section>

      <section className={styles.section} aria-label="Employment">
        <div className={styles.cardHead}>
          <Subtitle2 as="h3">
            Employment
            {ai("employment") && <AiBadge />}
          </Subtitle2>
          <Button icon={<Add20Regular />} onClick={() => onChange({ employment: [...v.employment, emptyEmployment()] })}>
            Add
          </Button>
        </div>
        {v.employment.map((row, i) => (
          <div key={`emp${i}`} className={styles.card}>
            <div className={styles.grid}>
              <TextInput text="Employer" value={row.employer} onChange={(employer) => setListItem("employment", i, { employer })} />
              <TextInput text="Title" value={row.title} onChange={(title) => setListItem("employment", i, { title })} />
              <TextInput text="Location" value={row.location} onChange={(location) => setListItem("employment", i, { location })} />
              <TextInput
                text="Start"
                type="date"
                value={row.start_date}
                onChange={(start_date) => setListItem("employment", i, { start_date })}
              />
              <TextInput
                text="End"
                type="date"
                disabled={row.is_current}
                value={row.is_current ? "" : row.end_date}
                error={errors[`employment.${i}.end_date`]}
                onChange={(end_date) => setListItem("employment", i, { end_date })}
              />
              <Checkbox
                label="Current job"
                checked={row.is_current}
                onChange={(_, d) => setListItem("employment", i, { is_current: !!d.checked })}
              />
            </div>
            <Field label="Description">
              <Textarea
                value={row.description}
                maxLength={10000}
                resize="vertical"
                onChange={(_, d) => setListItem("employment", i, { description: d.value })}
              />
            </Field>
            <div>
              <Button appearance="subtle" icon={<Delete20Regular />} onClick={() => removeListItem("employment", i)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className={styles.section} aria-label="Education">
        <div className={styles.cardHead}>
          <Subtitle2 as="h3">
            Education
            {ai("education") && <AiBadge />}
          </Subtitle2>
          <Button icon={<Add20Regular />} onClick={() => onChange({ education: [...v.education, emptyEducation()] })}>
            Add
          </Button>
        </div>
        {v.education.map((row, i) => (
          <div key={`edu${i}`} className={styles.card}>
            <div className={styles.grid}>
              <TextInput
                text="Institution"
                maxLength={300}
                value={row.institution}
                onChange={(institution) => setListItem("education", i, { institution })}
              />
              <TextInput text="Degree" value={row.degree} onChange={(degree) => setListItem("education", i, { degree })} />
              <TextInput text="Field of study" value={row.field} onChange={(field) => setListItem("education", i, { field })} />
              <TextInput
                text="Start year"
                type="number"
                value={row.start_year}
                error={errors[`education.${i}.start_year`]}
                onChange={(start_year) => setListItem("education", i, { start_year })}
              />
              <TextInput
                text="End year"
                type="number"
                value={row.end_year}
                error={errors[`education.${i}.end_year`]}
                onChange={(end_year) => setListItem("education", i, { end_year })}
              />
              <TextInput text="Grade" maxLength={50} value={row.grade} onChange={(grade) => setListItem("education", i, { grade })} />
            </div>
            <div>
              <Button appearance="subtle" icon={<Delete20Regular />} onClick={() => removeListItem("education", i)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className={styles.section} aria-label="Certifications">
        <div className={styles.cardHead}>
          <Subtitle2 as="h3">
            Certifications
            {ai("certifications") && <AiBadge />}
          </Subtitle2>
          <Button
            icon={<Add20Regular />}
            onClick={() => onChange({ certifications: [...v.certifications, emptyCertification()] })}
          >
            Add
          </Button>
        </div>
        {v.certifications.map((row, i) => (
          <div key={`cert${i}`} className={styles.card}>
            <div className={styles.grid}>
              <TextInput text="Name" maxLength={300} value={row.name} onChange={(name) => setListItem("certifications", i, { name })} />
              <TextInput text="Issuer" value={row.issuer} onChange={(issuer) => setListItem("certifications", i, { issuer })} />
              <TextInput
                text="Issued on"
                type="date"
                value={row.issued_on}
                onChange={(issued_on) => setListItem("certifications", i, { issued_on })}
              />
              <TextInput
                text="Expires on"
                type="date"
                value={row.expires_on}
                onChange={(expires_on) => setListItem("certifications", i, { expires_on })}
              />
              <TextInput
                text="Credential id"
                value={row.credential_id}
                onChange={(credential_id) => setListItem("certifications", i, { credential_id })}
              />
            </div>
            <div>
              <Button appearance="subtle" icon={<Delete20Regular />} onClick={() => removeListItem("certifications", i)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </section>

      {showSkills && (
        <section className={styles.section} aria-label="Skills">
          <Subtitle2 as="h3">
            Skills
            {ai("skills") && <AiBadge />}
          </Subtitle2>
          <SkillRowsEditor rows={v.skills} errors={errors} onChange={(skills) => onChange({ skills })} />
        </section>
      )}

      {showTags && (
        <section className={styles.section} aria-label="Tags">
          <TagNamesPicker label="Tags" value={v.tags} onChange={(tags) => onChange({ tags })} />
        </section>
      )}
    </div>
  );
}

function skillKey(row: SkillRow): string {
  return row.ref ? `${row.ref.kind}:${row.ref.id}` : `name:${row.name.toLowerCase()}`;
}

/** Editable skill rows (name, years, last used) + catalog typeahead. */
export function SkillRowsEditor({
  rows,
  onChange,
  errors = {},
}: {
  rows: readonly SkillRow[];
  onChange: (rows: SkillRow[]) => void;
  errors?: FormErrors;
}) {
  const styles = useFormStyles();
  const set = (i: number, patch: Partial<SkillRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <>
      {rows.map((row, i) => (
        <div key={skillKey(row)} className={styles.skill}>
          <span className={styles.skillName}>
            {row.name}
            {row.unresolved && (
              <Tooltip content="Not in the skill catalog. It will be added as a pending skill for review." relationship="description">
                <Badge size="small" appearance="tint" color="warning" icon={<Warning16Regular />}>
                  Unresolved
                </Badge>
              </Tooltip>
            )}
          </span>
          <Field
            label={i === 0 ? "Years" : undefined}
            validationState={errors[`skills.${i}.years`] ? "error" : "none"}
            validationMessage={errors[`skills.${i}.years`]}
          >
            <Input
              type="number"
              aria-label={`Years of ${row.name}`}
              value={row.years}
              onChange={(_, d) => set(i, { years: d.value })}
            />
          </Field>
          <Field label={i === 0 ? "Last used" : undefined}>
            <Input
              type="date"
              aria-label={`${row.name} last used`}
              value={row.last_used}
              onChange={(_, d) => set(i, { last_used: d.value })}
            />
          </Field>
          <Button
            appearance="subtle"
            icon={<Delete20Regular />}
            aria-label={`Remove ${row.name}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <SkillPicker
        excludeKeys={rows.map(skillKey)}
        onPick={(skill, text) => {
          const row: SkillRow = skill
            ? { name: skill.name, ref: { kind: skill.kind, id: skill.id }, years: "", last_used: "", source: "manual" }
            : { name: text, ref: null, years: "", last_used: "", source: "manual" };
          if (rows.some((r) => skillKey(r) === skillKey(row))) return;
          onChange([...rows, row]);
        }}
      />
    </>
  );
}
