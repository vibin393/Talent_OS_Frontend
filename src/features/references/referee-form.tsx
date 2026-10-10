"use client";

import { Body1, Button, Card, Checkbox, Field, Input, makeStyles, Text, tokens } from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { InlineError, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { type PortalReferenceCheck, workReferencesApi } from "./api";
import { emptyReferee, hasErrors, normalisePhone, type RefereeDraft, type RefereeErrors, validateReferees } from "./logic";

const useStyles = makeStyles({
  referee: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM, alignItems: "end" },
  notice: { padding: tokens.spacingHorizontalM, backgroundColor: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusMedium },
});

export const workReferenceKeys = { list: ["portal", "work", "references"] as const };

/** Worker portal: reference checks awaiting referees (inline `reference_check` consent; never shows answers). */
export function WorkReferenceChecks({ ownEmail }: { ownEmail: string | null }) {
  const portal = usePortalStyles();
  const q = useQuery({ queryKey: workReferenceKeys.list, queryFn: ({ signal }) => workReferencesApi.list(signal), retry: false });
  if (q.isPending || q.isError || q.data.length === 0) return null;
  return (
    <section className={portal.page} aria-label="Reference checks">
      <Text as="h2" size={500} weight="semibold">
        Reference checks
      </Text>
      {q.data.map((rc) => (
        <ReferenceCard key={rc.id} rc={rc} ownEmail={ownEmail} />
      ))}
    </section>
  );
}

function ReferenceCard({ rc, ownEmail }: { rc: PortalReferenceCheck; ownEmail: string | null }) {
  const portal = usePortalStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const [list, setList] = useState<RefereeDraft[]>(() => Array.from({ length: Math.max(rc.min_referees - rc.referees.length, 1) }, emptyReferee));
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<RefereeErrors[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () =>
      workReferencesApi.addReferees(
        rc.id,
        list.map((r) => ({
          name: r.name.trim(),
          relationship: r.relationship.trim() || null,
          company: r.company.trim() || null,
          email: r.email.trim(),
          phone: normalisePhone(r.phone) ?? null,
        })),
        rc.consent_given ? null : rc.notice_id,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workReferenceKeys.list }),
  });
  const open = rc.status === "requested" || rc.status === "sent";
  const submit = () => {
    const result = validateReferees(list, ownEmail, Math.max(rc.min_referees - rc.referees.length, 1));
    setErrors(result.errors);
    setFormError(result.form ?? (!rc.consent_given && !agreed ? "Agree to the reference-check notice first." : null));
    if (!hasErrors(result) && (rc.consent_given || agreed)) send.mutate();
  };
  const update = (i: number, patch: Partial<RefereeDraft>) => setList((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Card className={portal.card}>
      <Body1>
        Please name at least {rc.min_referees} people who can speak about your work. We will email them a short questionnaire; you will not see their answers.
      </Body1>
      {rc.referees.length > 0 && (
        <ul className={portal.list}>
          {rc.referees.map((r) => (
            <li key={r.id}>
              {r.name} {r.company ? `(${r.company})` : ""} — {r.status}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <>
          {!rc.consent_given && rc.notice_body_md && (
            <div className={styles.notice}>
              <Text weight="semibold">{rc.notice_title}</Text>
              <MarkdownView source={rc.notice_body_md} />
              <Checkbox label="I agree to this notice" checked={agreed} onChange={(_, d) => setAgreed(Boolean(d.checked))} />
            </div>
          )}
          {list.map((r, i) => (
            <div key={i} className={styles.referee}>
              <Field label="Name" required validationMessage={errors[i]?.name}>
                <Input className={portal.input} value={r.name} onChange={(_, d) => update(i, { name: d.value })} />
              </Field>
              <Field label="Relationship">
                <Input className={portal.input} value={r.relationship} onChange={(_, d) => update(i, { relationship: d.value })} />
              </Field>
              <Field label="Company">
                <Input className={portal.input} value={r.company} onChange={(_, d) => update(i, { company: d.value })} />
              </Field>
              <Field label="Email" required validationMessage={errors[i]?.email}>
                <Input className={portal.input} type="email" value={r.email} onChange={(_, d) => update(i, { email: d.value })} />
              </Field>
              <Field label="Phone" validationMessage={errors[i]?.phone}>
                <Input className={portal.input} type="tel" value={r.phone} onChange={(_, d) => update(i, { phone: d.value })} />
              </Field>
              <Button aria-label="Remove referee" icon={<Delete20Regular />} disabled={list.length === 1} onClick={() => setList((l) => l.filter((_, j) => j !== i))} />
            </div>
          ))}
          <div className={portal.actions}>
            <Button icon={<Add20Regular />} className={portal.button} onClick={() => setList((l) => [...l, emptyReferee()])}>
              Add referee
            </Button>
            <Button appearance="primary" className={portal.button} disabled={send.isPending} onClick={submit}>
              Send to referees
            </Button>
          </div>
          <InlineError message={formError ?? (send.isError ? errorMessage(send.error) : null)} />
        </>
      )}
    </Card>
  );
}
