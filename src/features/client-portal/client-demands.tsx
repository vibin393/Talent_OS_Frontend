"use client";

import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  SpinButton,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/features/billing/money";
import { errorMessage } from "@/lib/api/errors";
import { cpApi, cpKeys } from "./api";
import { availabilityLabel, canCompare, COMPARE_MAX, experienceLabel, FEEDBACK_LABEL, toggleCompare } from "./logic";
import type { ClientDemandRequestIn } from "./types";
import { Empty, Failure, formatDate, Loading, PageTitle, useCpStyles } from "./ui";

/** `/client/demands`: the client's demands and portal requests. */
export function ClientDemands() {
  const s = useCpStyles();
  const q = useQuery({ queryKey: cpKeys.demands, queryFn: ({ signal }) => cpApi.demands(signal) });
  return (
    <div className={s.page}>
      <PageTitle
        actions={
          <Button as="a" href="/client/demands/new" appearance="primary">
            Request a new role
          </Button>
        }
      >
        Demands
      </PageTitle>
      {q.error ? <Failure error={q.error} /> : null}
      {!q.data && !q.error ? <Loading /> : null}
      {q.data && q.data.length === 0 ? <Empty>No demands yet.</Empty> : null}
      <div className={s.list}>
        {q.data?.map((d) => (
          <div key={d.id} className={s.card}>
            <div className={s.row}>
              <div className={s.grow}>
                <Link className={s.link} href={`/client/demands/${d.id}`}>
                  <Text weight="semibold">{d.title}</Text>
                </Link>
                <br />
                <Text size={200} className={s.muted}>
                  {`${d.req_id} · ${d.positions} position(s)${d.location ? ` · ${d.location}` : ""}${d.start_date ? ` · starts ${formatDate(d.start_date)}` : ""}`}
                </Text>
              </div>
              <Badge appearance="tint">{d.status.replace("_", " ")}</Badge>
              {d.requested_via_portal ? <Badge appearance="outline">Requested</Badge> : null}
              <Text className={s.num}>{`${d.sent_submissions} candidate(s)`}</Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** `/client/demands/new`: Demand request form (FR-100). */
export function ClientDemandRequestForm() {
  const s = useCpStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [positions, setPositions] = useState(1);
  const [skills, setSkills] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [budget, setBudget] = useState("");
  const [unit, setUnit] = useState<ClientDemandRequestIn["budget_unit"]>("month");
  const [description, setDescription] = useState("");
  const [jd, setJd] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const budgetOk = !budget || /^\d+(\.\d{1,2})?$/.test(budget);
  const m = useMutation({
    mutationFn: () =>
      cpApi.requestDemand(
        {
          title: title.trim(),
          positions,
          skills: skills.split(",").map((x) => x.trim()).filter(Boolean),
          location: location.trim() || null,
          start_date: start || null,
          budget_amount: budget || null,
          budget_currency: budget ? "INR" : null,
          budget_unit: budget ? unit : null,
          description: description.trim() || null,
        },
        jd,
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: cpKeys.demands });
      router.push("/client/demands");
    },
  });
  const titleError = touched && title.trim().length < 2 ? "Enter the role title" : undefined;
  return (
    <div className={s.page}>
      <PageTitle>Request a new role</PageTitle>
      <form
        className={s.card}
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (title.trim().length >= 2 && budgetOk) m.mutate();
        }}
      >
        <Field label="Role title" required validationMessage={titleError}>
          <Input value={title} onChange={(_, d) => setTitle(d.value)} />
        </Field>
        <Field label="Positions">
          <SpinButton min={1} max={500} value={positions} onChange={(_, d) => setPositions(Number(d.value ?? d.displayValue ?? 1) || 1)} />
        </Field>
        <Field label="Key skills" hint="Separate with commas">
          <Input value={skills} onChange={(_, d) => setSkills(d.value)} />
        </Field>
        <Field label="Location">
          <Input value={location} onChange={(_, d) => setLocation(d.value)} />
        </Field>
        <Field label="Preferred start date">
          <Input type="date" value={start} onChange={(_, d) => setStart(d.value)} />
        </Field>
        <div className={s.row}>
          <Field label="Budget (INR)" validationMessage={budgetOk ? undefined : "Enter an amount like 150000 or 1500.50"} className={s.grow}>
            <Input inputMode="decimal" value={budget} onChange={(_, d) => setBudget(d.value.trim())} />
          </Field>
          <Field label="Per">
            <Dropdown
              value={unit ?? "month"}
              selectedOptions={[unit ?? "month"]}
              onOptionSelect={(_, d) => setUnit(d.optionValue as ClientDemandRequestIn["budget_unit"])}
            >
              {["hour", "day", "month", "year"].map((u) => (
                <Option key={u} value={u}>
                  {u}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={5} value={description} onChange={(_, d) => setDescription(d.value)} />
        </Field>
        <Field label="Job description (PDF or Word)">
          <input type="file" accept=".pdf,.docx" onChange={(e) => setJd(e.target.files?.[0] ?? null)} />
        </Field>
        {m.error ? (
          <MessageBar intent="error" aria-live="assertive">
            <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
          </MessageBar>
        ) : null}
        <div className={s.actions}>
          <Button type="submit" appearance="primary" disabled={m.isPending}>
            Send request
          </Button>
          <Button as="a" href="/client/demands">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

/** `/client/demands/[id]`: sent submissions as cards with select-to-compare (max 4). */
export function ClientDemandDetail({ id }: { id: string }) {
  const s = useCpStyles();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const demand = useQuery({ queryKey: cpKeys.demand(id), queryFn: ({ signal }) => cpApi.demand(id, signal) });
  const subs = useQuery({ queryKey: cpKeys.submissions(id), queryFn: ({ signal }) => cpApi.submissions(id, signal) });
  if (demand.error) return <Failure error={demand.error} />;
  if (!demand.data) return <Loading />;
  return (
    <div className={s.page}>
      <PageTitle
        actions={
          <Button
            appearance="primary"
            disabled={!canCompare(selected)}
            onClick={() => router.push(`/client/compare?ids=${selected.join(",")}`)}
          >
            {`Compare (${selected.length})`}
          </Button>
        }
      >
        {demand.data.title}
      </PageTitle>
      <Text className={s.muted}>{`${demand.data.req_id} · ${demand.data.status.replace("_", " ")} · select up to ${COMPARE_MAX} to compare`}</Text>
      {subs.error ? <Failure error={subs.error} /> : null}
      {!subs.data && !subs.error ? <Loading /> : null}
      {subs.data && subs.data.length === 0 ? <Empty>No candidates have been sent yet.</Empty> : null}
      <div className={s.grid}>
        {subs.data?.map((c) => (
          <div key={c.id} className={s.card}>
            <div className={s.row}>
              <Checkbox
                aria-label={`Compare ${c.candidate_display_name}`}
                checked={selected.includes(c.id)}
                disabled={!selected.includes(c.id) && selected.length >= COMPARE_MAX}
                onChange={() => setSelected((x) => toggleCompare(x, c.id))}
              />
              <Link className={s.link} href={`/client/submissions/${c.id}`}>
                <Text weight="semibold">{c.candidate_display_name}</Text>
              </Link>
            </div>
            <Text size={200}>{c.headline ?? "—"}</Text>
            <Text size={200} className={s.muted}>
              {`${experienceLabel(c.experience_months)} · ${availabilityLabel(c.availability_days)}`}
            </Text>
            <Text className={s.num}>{`${formatMoney({ amount: c.bill_rate, currency: c.currency })} / ${c.rate_unit}`}</Text>
            <Badge appearance="tint">{FEEDBACK_LABEL[c.feedback_status] ?? c.feedback_status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
