"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Caption1,
  Checkbox,
  Combobox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  SpinButton,
  Switch,
  Tag,
  TagGroup,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { candidateKeys, candidatesApi } from "@/features/candidates/api";
import { ClientPicker } from "@/features/demands/client-picker";
import type { SearchFacet } from "@/lib/api/types";
import { activeFilterCount, EMPTY_FILTERS, type SearchFilters } from "./url-state";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  rows: { display: "flex", flexDirection: "column" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  rowLabel: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
  count: { color: tokens.colorNeutralForeground3, fontVariantNumeric: "tabular-nums", flexShrink: 0 },
  pair: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalS },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  sub: { color: tokens.colorNeutralForeground2, marginTop: tokens.spacingVerticalXS },
  full: { width: "100%" },
});

export type FacetPanelProps = {
  filters: SearchFilters;
  facets: readonly SearchFacet[];
  labels: Record<string, string>;
  canViewComp: boolean;
  onChange: (filters: SearchFilters, labels?: Record<string, string>) => void;
};

type Row = { value: string; label: string; count: number | null };

/** Facet buckets plus any selected values missing from them (count unknown). */
function facetRows(facet: SearchFacet | undefined, selected: readonly string[], label: (v: string, fallback: string) => string): Row[] {
  const rows: Row[] = (facet?.buckets ?? []).map((b) => ({ value: b.value, label: label(b.value, b.label), count: b.count }));
  for (const v of selected) if (!rows.some((r) => r.value === v)) rows.unshift({ value: v, label: label(v, v), count: null });
  return rows;
}

function countText(count: number | null, approximate: boolean): string {
  if (count === null) return "—";
  return `${approximate ? "≈" : ""}${count.toLocaleString()}`;
}

const pretty = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : s);

function CheckRows({
  rows,
  selected,
  approximate,
  onToggle,
  name,
}: {
  rows: Row[];
  selected: readonly string[];
  approximate: boolean;
  onToggle: (value: string, label: string, on: boolean) => void;
  name: string;
}) {
  const styles = useStyles();
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0) return <Caption1 className={styles.count}>No values</Caption1>;
  const visible = showAll ? rows : rows.slice(0, 8);
  return (
    <div className={styles.rows} role="group" aria-label={name}>
      {visible.map((r) => (
        <div key={r.value} className={styles.row}>
          <Checkbox
            className={styles.rowLabel}
            label={r.label}
            checked={selected.includes(r.value)}
            onChange={(_, d) => onToggle(r.value, r.label, !!d.checked)}
          />
          <Caption1 className={styles.count} aria-label={`${r.count ?? "unknown"} candidates`}>
            {countText(r.count, approximate)}
          </Caption1>
        </div>
      ))}
      {rows.length > 8 && (
        <Button appearance="transparent" size="small" onClick={() => setShowAll((v) => !v)} style={{ alignSelf: "flex-start" }}>
          {showAll ? "Show less" : `Show all ${rows.length}`}
        </Button>
      )}
    </div>
  );
}

function toNum(v: number | null | undefined, display: string | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (display === undefined || display.trim() === "") return null;
  const n = Number(display);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Min/max `SpinButton` pair. */
export function NumberPair({
  label,
  min,
  max,
  step = 1,
  upper,
  onChange,
}: {
  label: string;
  min: number | null;
  max: number | null;
  step?: number;
  upper?: number;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const styles = useStyles();
  return (
    <div className={styles.pair}>
      <Field label={`${label} min`}>
        <SpinButton
          min={0}
          max={upper}
          step={step}
          value={min}
          displayValue={min === null ? "" : undefined}
          onChange={(_, d) => onChange(toNum(d.value, d.displayValue), max)}
        />
      </Field>
      <Field label={`${label} max`}>
        <SpinButton
          min={0}
          max={upper}
          step={step}
          value={max}
          displayValue={max === null ? "" : undefined}
          onChange={(_, d) => onChange(min, toNum(d.value, d.displayValue))}
        />
      </Field>
    </div>
  );
}

const EXPERIENCE_RANGES: Record<string, [number | null, number | null]> = {
  "0-2": [0, 2],
  "2-5": [2, 5],
  "5-8": [5, 8],
  "8-12": [8, 12],
  "12+": [12, null],
};
const NOTICE_MAX: Record<string, number | null> = { "0": 0, "1-15": 15, "16-30": 30, "31-60": 60, "61-90": 90, "90+": null };
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];

function SkillsFacet({ filters, facet, labels, onChange }: Omit<FacetPanelProps, "facets" | "canViewComp"> & { facet?: SearchFacet }) {
  const styles = useStyles();
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text.trim());
  const catalog = useQuery({
    queryKey: candidateKeys.skills(deferred),
    queryFn: ({ signal }) => candidatesApi.searchSkills(deferred, signal),
    enabled: deferred.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
  const approximate = !!facet?.approximate;
  const options = new Map<string, { label: string; count: number | null }>();
  for (const id of filters.skills) options.set(id, { label: labels[id] ?? "Selected skill", count: null });
  for (const b of facet?.buckets ?? []) options.set(b.value, { label: b.label, count: b.count });
  for (const s of catalog.data?.items ?? []) if (!options.has(s.id)) options.set(s.id, { label: s.name, count: null });
  const needle = deferred.toLowerCase();
  const shown = [...options.entries()].filter(
    ([id, o]) => filters.skills.includes(id) || !needle || o.label.toLowerCase().includes(needle),
  );

  return (
    <div className={styles.stack}>
      <Field label="Skills">
        <Combobox
          multiselect
          freeform
          placeholder={filters.skills.length ? `${filters.skills.length} selected` : "Search skills"}
          value={text}
          selectedOptions={filters.skills}
          onChange={(e) => setText(e.target.value)}
          onOptionSelect={(_, d) => {
            const next = d.selectedOptions;
            const extra: Record<string, string> = {};
            for (const id of next) {
              const o = options.get(id);
              if (o) extra[id] = o.label;
            }
            setText("");
            onChange({ ...filters, skills: next }, extra);
          }}
        >
          {shown.map(([id, o]) => (
            <Option key={id} value={id} text={o.label}>
              <span style={{ flex: 1 }}>{o.label}</span>
              {o.count !== null && <Caption1 className={styles.count}>{countText(o.count, approximate)}</Caption1>}
            </Option>
          ))}
        </Combobox>
      </Field>
      {filters.skills.length > 0 && (
        <TagGroup
          aria-label="Selected skills"
          onDismiss={(_, d) => onChange({ ...filters, skills: filters.skills.filter((s) => s !== d.value) })}
        >
          {filters.skills.map((id) => (
            <Tag key={id} value={id} size="small" dismissible dismissIcon={{ "aria-label": "remove" }}>
              {labels[id] ?? options.get(id)?.label ?? "Skill"}
            </Tag>
          ))}
        </TagGroup>
      )}
      <Switch
        label="Match all"
        checked={filters.skillsMode === "all"}
        onChange={(_, d) => onChange({ ...filters, skillsMode: d.checked ? "all" : "any" })}
      />
      {/* Epic 37: skills graph expansion (default on) */}
      <Switch
        label="Include related skills"
        checked={filters.expandSkills !== false}
        onChange={(_, d) => onChange({ ...filters, expandSkills: d.checked })}
      />
    </div>
  );
}

function EmployerInput({ filters, onChange }: Pick<FacetPanelProps, "filters" | "onChange">) {
  const styles = useStyles();
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (v && !filters.employers.includes(v)) onChange({ ...filters, employers: [...filters.employers, v] });
    setText("");
  };
  return (
    <div className={styles.stack}>
      <Field label="Current employer" hint="Press Enter to add">
        <Input
          value={text}
          onChange={(_, d) => setText(d.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
      </Field>
      {filters.employers.length > 0 && (
        <TagGroup
          aria-label="Selected employers"
          onDismiss={(_, d) => onChange({ ...filters, employers: filters.employers.filter((s) => s !== d.value) })}
        >
          {filters.employers.map((e) => (
            <Tag key={e} value={e} size="small" dismissible dismissIcon={{ "aria-label": "remove" }}>
              {e}
            </Tag>
          ))}
        </TagGroup>
      )}
    </div>
  );
}

/** Faceted filters (`Accordion multiple`); each count applies every other filter but not its own. */
export function FacetPanel({ filters, facets, labels, canViewComp, onChange }: FacetPanelProps) {
  const styles = useStyles();
  const facet = (key: string) => facets.find((f) => f.key === key);
  const approx = (key: string) => !!facet(key)?.approximate;
  const toggle =
    (field: "countries" | "cities" | "workAuth" | "certifications" | "tags" | "sources" | "owners") =>
    (value: string, label: string, on: boolean) => {
      const cur = filters[field];
      const next = on ? [...cur, value] : cur.filter((v) => v !== value);
      onChange({ ...filters, [field]: next }, field === "tags" || field === "owners" ? { [value]: label } : undefined);
    };
  const labelOf = (v: string, fallback: string) => labels[v] ?? fallback;
  const count = activeFilterCount(filters);

  const expBuckets = facet("experience")?.buckets ?? [];
  const noticeBuckets = facet("notice")?.buckets ?? [];

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <Text weight="semibold">Filters{count ? ` (${count})` : ""}</Text>
        <Button appearance="transparent" size="small" disabled={count === 0} onClick={() => onChange({ ...EMPTY_FILTERS, compCurrency: filters.compCurrency })}>
          Clear all
        </Button>
      </div>
      <Accordion multiple collapsible defaultOpenItems={["skills", "experience", "location"]}>
        <AccordionItem value="skills">
          <AccordionHeader size="small">Skills</AccordionHeader>
          <AccordionPanel>
            <SkillsFacet filters={filters} facet={facet("skills")} labels={labels} onChange={onChange} />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="experience">
          <AccordionHeader size="small">Experience</AccordionHeader>
          <AccordionPanel>
            <div className={styles.stack}>
              <NumberPair
                label="Years"
                min={filters.expMin}
                max={filters.expMax}
                upper={60}
                onChange={(expMin, expMax) => onChange({ ...filters, expMin, expMax })}
              />
              <div className={styles.rows} role="group" aria-label="Experience ranges">
                {expBuckets.map((b) => {
                  const [lo, hi] = EXPERIENCE_RANGES[b.value] ?? [null, null];
                  const on = filters.expMin === lo && filters.expMax === hi;
                  return (
                    <div key={b.value} className={styles.row}>
                      <Checkbox
                        label={`${b.label} yrs`}
                        checked={on}
                        onChange={(_, d) =>
                          onChange({ ...filters, expMin: d.checked ? lo : null, expMax: d.checked ? hi : null })
                        }
                      />
                      <Caption1 className={styles.count}>{countText(b.count, approx("experience"))}</Caption1>
                    </div>
                  );
                })}
              </div>
            </div>
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="location">
          <AccordionHeader size="small">Location</AccordionHeader>
          <AccordionPanel>
            <Caption1 className={styles.sub}>Country</Caption1>
            <CheckRows
              name="Country"
              rows={facetRows(facet("country"), filters.countries, labelOf)}
              selected={filters.countries}
              approximate={approx("country")}
              onToggle={toggle("countries")}
            />
            <Caption1 className={styles.sub}>City</Caption1>
            <CheckRows
              name="City"
              rows={facetRows(facet("city"), filters.cities, labelOf)}
              selected={filters.cities}
              approximate={approx("city")}
              onToggle={toggle("cities")}
            />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="work_auth">
          <AccordionHeader size="small">Work authorization</AccordionHeader>
          <AccordionPanel>
            <CheckRows
              name="Work authorization"
              rows={facetRows(facet("work_auth"), filters.workAuth, labelOf)}
              selected={filters.workAuth}
              approximate={approx("work_auth")}
              onToggle={toggle("workAuth")}
            />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="notice">
          <AccordionHeader size="small">Notice &amp; availability</AccordionHeader>
          <AccordionPanel>
            <div className={styles.stack}>
              <Field label="Max notice (days)">
                <SpinButton
                  min={0}
                  max={365}
                  value={filters.noticeMaxDays}
                  displayValue={filters.noticeMaxDays === null ? "" : undefined}
                  onChange={(_, d) => onChange({ ...filters, noticeMaxDays: toNum(d.value, d.displayValue) })}
                />
              </Field>
              <div className={styles.rows} role="group" aria-label="Notice periods">
                {noticeBuckets.map((b) => {
                  const max = NOTICE_MAX[b.value] ?? null;
                  const text = b.value === "0" ? "Immediate" : `${b.label} days`;
                  return (
                    <div key={b.value} className={styles.row}>
                      {max === null ? (
                        <Text size={300} style={{ paddingInlineStart: 36 }}>
                          {text}
                        </Text>
                      ) : (
                        <Checkbox
                          label={text}
                          checked={filters.noticeMaxDays === max}
                          onChange={(_, d) => onChange({ ...filters, noticeMaxDays: d.checked ? max : null })}
                        />
                      )}
                      <Caption1 className={styles.count}>{countText(b.count, approx("notice"))}</Caption1>
                    </div>
                  );
                })}
              </div>
              <Field label="Available by">
                <Input
                  type="date"
                  value={filters.availableBy ?? ""}
                  onChange={(_, d) => onChange({ ...filters, availableBy: d.value || null })}
                />
              </Field>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {canViewComp && (
          <AccordionItem value="comp">
            <AccordionHeader size="small">Expected compensation</AccordionHeader>
            <AccordionPanel>
              <div className={styles.stack}>
                <NumberPair
                  label="Amount"
                  min={filters.compMin}
                  max={filters.compMax}
                  step={100000}
                  onChange={(compMin, compMax) => onChange({ ...filters, compMin, compMax })}
                />
                <Field label="Currency">
                  <Dropdown
                    value={filters.compCurrency}
                    selectedOptions={[filters.compCurrency]}
                    onOptionSelect={(_, d) => d.optionValue && onChange({ ...filters, compCurrency: d.optionValue })}
                  >
                    {CURRENCIES.map((c) => (
                      <Option key={c} value={c}>
                        {c}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>
            </AccordionPanel>
          </AccordionItem>
        )}

        <AccordionItem value="certifications">
          <AccordionHeader size="small">Certifications</AccordionHeader>
          <AccordionPanel>
            <CheckRows
              name="Certifications"
              rows={facetRows(facet("certifications"), filters.certifications, labelOf)}
              selected={filters.certifications}
              approximate={approx("certifications")}
              onToggle={toggle("certifications")}
            />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="employers">
          <AccordionHeader size="small">Current employer</AccordionHeader>
          <AccordionPanel>
            <EmployerInput filters={filters} onChange={onChange} />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="tags">
          <AccordionHeader size="small">Tags</AccordionHeader>
          <AccordionPanel>
            <CheckRows
              name="Tags"
              rows={facetRows(facet("tags"), filters.tags, labelOf)}
              selected={filters.tags}
              approximate={approx("tags")}
              onToggle={toggle("tags")}
            />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="source">
          <AccordionHeader size="small">Source</AccordionHeader>
          <AccordionPanel>
            <CheckRows
              name="Source"
              rows={facetRows(facet("source"), filters.sources, (v, f) => pretty(labelOf(v, f)))}
              selected={filters.sources}
              approximate={approx("source")}
              onToggle={toggle("sources")}
            />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="owner">
          <AccordionHeader size="small">Owner</AccordionHeader>
          <AccordionPanel>
            <CheckRows
              name="Owner"
              rows={facetRows(facet("owner"), filters.owners, labelOf)}
              selected={filters.owners}
              approximate={approx("owner")}
              onToggle={toggle("owners")}
            />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="updated">
          <AccordionHeader size="small">Last updated</AccordionHeader>
          <AccordionPanel>
            <div className={styles.pair}>
              <Field label="After">
                <Input
                  type="date"
                  value={filters.updatedAfter ?? ""}
                  onChange={(_, d) => onChange({ ...filters, updatedAfter: d.value || null })}
                />
              </Field>
              <Field label="Before">
                <Input
                  type="date"
                  value={filters.updatedBefore ?? ""}
                  onChange={(_, d) => onChange({ ...filters, updatedBefore: d.value || null })}
                />
              </Field>
            </div>
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="not_submitted">
          <AccordionHeader size="small">Not submitted to</AccordionHeader>
          <AccordionPanel>
            <ClientPicker
              label="Client"
              value={filters.notSubmittedTo}
              valueLabel={filters.notSubmittedTo ? labels[filters.notSubmittedTo] : undefined}
              clearLabel="Any client"
              hint="Hide candidates already submitted to this client."
              onChange={(c) =>
                onChange({ ...filters, notSubmittedTo: c?.id ?? null }, c ? { [c.id]: c.name } : undefined)
              }
            />
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
