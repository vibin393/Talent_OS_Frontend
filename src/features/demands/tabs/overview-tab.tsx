"use client";

import {
  Avatar,
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  makeStyles,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { PeopleTeam20Regular, PersonAdd20Regular, Star16Filled } from "@fluentui/react-icons";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { ErrorBar, formatDateTime, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { ApprovalHistory } from "@/features/approvals/approval-history";
import { errorMessage } from "@/lib/api/errors";
import type { DemandOut } from "@/lib/api/types";
import { AiFieldBadge } from "../ai-field-badge";
import { AssignmentPicker } from "../assignment-picker";
import { SlaBadge, sortClocks } from "../badges";
import { EMPLOYMENT_LABELS, WORK_MODE_LABELS } from "../form";
import { formatDate, formatExperience, formatRate } from "../format";
import { MILESTONE_LABELS } from "../status";
import { useDemandApprovals } from "../use-approvals";
import { useAssignments } from "../use-assignments";
import { DemandSkillRequirements, skillRequirementSuffix } from "@/features/skills/demand-skill-requirements";
import { useFieldSources } from "@/features/agents/demand/use-field-sources";

const useStyles = makeStyles({
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
  },
  card: { padding: tokens.spacingHorizontalL },
  muted: { color: tokens.colorNeutralForeground3 },
  tags: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  grow: { flex: 1, minWidth: 0 },
});

function Dt({ label, children, ai }: { label: string; children: React.ReactNode; ai?: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        {children} {ai}
      </dd>
    </>
  );
}

/** Demand overview: details, skills, assignments (+ Assign), SLA milestones and approval history. */
export function OverviewTab({ demand, canAssign, canUpdate }: { demand: DemandOut; canAssign: boolean; canUpdate: boolean }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const assignments = useAssignments(demand.id);
  const approvals = useDemandApprovals(demand.id);
  const [assigning, setAssigning] = useState(false);
  const ex = demand.ai_extracted_fields;
  const sources = useFieldSources(demand.id, ex.length > 0); // Epic 55: Demand Agent source quotes
  const ai = (...fields: string[]) =>
    fields.some((f) => ex.includes(f)) ? (
      <AiFieldBadge
        demandId={demand.id}
        extracted={ex}
        fields={fields}
        canConfirm={canUpdate}
        sourceQuote={sources[fields.find((f) => ex.includes(f) && sources[f]) ?? ""]}
      />
    ) : null;
  const assignable = demand.status === "open" || demand.status === "on_hold";
  const masked = new Set(demand.masked_fields ?? []);
  const mandatory = (demand.skills ?? []).filter((s) => s.kind === "mandatory");
  const preferred = (demand.skills ?? []).filter((s) => s.kind === "preferred");
  const clocks = sortClocks(demand.sla ?? []);
  const items = assignments.data?.items ?? [];

  const skillTags = (list: typeof mandatory) =>
    list.length === 0 ? (
      <Text className={styles.muted}>None</Text>
    ) : (
      <span className={styles.tags}>
        {list.map((s) => (
          <Badge key={`${s.kind}:${s.label}`} appearance={s.skill_id && s.skill_status !== "pending" ? "tint" : "outline"} color="informative">
            {s.label}
            {s.min_years ? ` · ${Number(s.min_years)}y` : ""}
            {skillRequirementSuffix(s)}
            {!s.skill_id || s.skill_status === "pending" ? " (pending)" : ""}
          </Badge>
        ))}
      </span>
    );

  return (
    <div className={styles.cards}>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2 as="h2">Details</Subtitle2>} />
        <dl className={admin.detailList}>
          <Dt label="Client">
            <AppLink href={`/clients/${demand.client_id}`}>{demand.client_name ?? "Client"}</AppLink>
          </Dt>
          <Dt label="End client">{demand.end_client || "—"}</Dt>
          <Dt label="Positions" ai={ai("positions")}>
            {demand.positions_filled > 0 ? `${demand.positions_filled} of ${demand.positions} filled` : demand.positions}
          </Dt>
          <Dt label="Employment" ai={ai("employment_type")}>
            {demand.employment_type ? EMPLOYMENT_LABELS[demand.employment_type] : "—"}
          </Dt>
          <Dt label="Department">{demand.department || "—"}</Dt>
          <Dt label="Location" ai={ai("location", "country")}>
            {[demand.location, demand.country].filter(Boolean).join(", ") || "—"}
          </Dt>
          <Dt label="Work mode" ai={ai("work_mode")}>
            {demand.work_mode ? WORK_MODE_LABELS[demand.work_mode] : "—"}
          </Dt>
          <Dt label="Experience" ai={ai("min_experience_years", "max_experience_years")}>
            {formatExperience(demand.min_experience_years, demand.max_experience_years)}
          </Dt>
          {!masked.has("bill_rate") && (
            <>
              <Dt label="Bill rate" ai={ai("bill_rate", "currency", "rate_unit")}>
                {formatRate(demand.bill_rate, demand)}
              </Dt>
              <Dt label="Pay rate" ai={ai("pay_rate_min", "pay_rate_max")}>
                {demand.pay_rate_min || demand.pay_rate_max
                  ? `${formatRate(demand.pay_rate_min, demand)} – ${formatRate(demand.pay_rate_max, demand)}`
                  : "—"}
              </Dt>
              {demand.margin_percent && <Dt label="Margin">{Number(demand.margin_percent).toFixed(1)}%</Dt>}
            </>
          )}
          <Dt label="Start date" ai={ai("start_date")}>
            {formatDate(demand.start_date)}
          </Dt>
          <Dt label="Target closure">{formatDate(demand.target_closure_date)}</Dt>
          <Dt label="Submission limit">{demand.submission_limit ?? "—"}</Dt>
          <Dt label="Certifications" ai={ai("certifications")}>
            {demand.certifications.join(", ") || "—"}
          </Dt>
          <Dt label="Languages">{demand.languages.join(", ") || "—"}</Dt>
          <Dt label="Work authorization">{demand.work_authorization.join(", ") || "—"}</Dt>
          <Dt label="Created">{formatDateTime(demand.created_at)}</Dt>
          {demand.opened_at && <Dt label="Opened">{formatDateTime(demand.opened_at)}</Dt>}
        </dl>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL }}>
        <Card className={styles.card}>
          <CardHeader
            header={<Subtitle2 as="h2">Skills</Subtitle2>}
            action={<DemandSkillRequirements demand={demand} canUpdate={canUpdate} />}
          />
          <dl className={admin.detailList}>
            <Dt label="Mandatory" ai={ai("mandatory_skills")}>
              {skillTags(mandatory)}
            </Dt>
            <Dt label="Preferred" ai={ai("preferred_skills")}>
              {skillTags(preferred)}
            </Dt>
          </dl>
          {demand.interview_plan.length > 0 && (
            <>
              <Text weight="semibold">Interview plan</Text>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {demand.interview_plan.map((p, i) => (
                  <li key={i}>
                    {String(p.name ?? "")}
                    <Text className={styles.muted}> · {String(p.kind ?? "")}</Text>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Card>

        <Card className={styles.card}>
          <CardHeader
            header={<Subtitle2 as="h2">Assignments</Subtitle2>}
            action={
              canAssign && assignable ? (
                <Button size="small" icon={<PersonAdd20Regular />} onClick={() => setAssigning(true)} disabled={assignments.isPending}>
                  Assign
                </Button>
              ) : undefined
            }
          />
          {assignments.isPending ? (
            <GridSkeleton rows={2} />
          ) : assignments.isError ? (
            <ErrorBar message={errorMessage(assignments.error)} />
          ) : items.length === 0 ? (
            <Body1 className={styles.muted}>
              {assignable ? "No recruiters assigned yet." : "Recruiters can be assigned once the demand is Open."}
            </Body1>
          ) : (
            <ul className={styles.list}>
              {items.map((a) => (
                <li key={a.id} className={styles.row}>
                  {a.team_id ? (
                    <PeopleTeam20Regular aria-hidden />
                  ) : (
                    <Avatar name={a.name ?? undefined} size={24} color="colorful" aria-hidden />
                  )}
                  <span className={styles.grow}>
                    <Text>{a.name ?? "Unknown"}</Text>
                    {a.team_id && <Text className={styles.muted}> · team</Text>}
                  </span>
                  {a.is_primary && (
                    <Badge appearance="tint" color="brand" icon={<Star16Filled />}>
                      Primary
                    </Badge>
                  )}
                  {a.first_activity_at && (
                    <Text size={200} className={styles.muted}>
                      First action {formatDateTime(a.first_activity_at)}
                    </Text>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">SLA milestones</Subtitle2>} />
          {clocks.length === 0 ? (
            <Body1 className={styles.muted}>SLA clocks start when the demand opens.</Body1>
          ) : (
            <ul className={styles.list}>
              {clocks.map((c) => (
                <li key={`${c.milestone}:${c.ref_id ?? ""}`} className={styles.row}>
                  <span className={styles.grow}>
                    <Text weight="semibold">{MILESTONE_LABELS[c.milestone]}</Text>
                    <br />
                    <Text size={200} className={styles.muted}>
                      {c.completed_at ? `Completed ${formatDateTime(c.completed_at)}` : `Due ${formatDateTime(c.due_at)}`}
                    </Text>
                  </span>
                  <SlaBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Approval history</Subtitle2>} />
          {approvals.isPending ? (
            <GridSkeleton rows={2} />
          ) : approvals.isError ? (
            <ErrorBar message={errorMessage(approvals.error)} />
          ) : (
            <ApprovalHistory requests={approvals.data} />
          )}
        </Card>
      </div>

      {assigning && <AssignmentPicker demandId={demand.id} current={items} onClose={() => setAssigning(false)} />}
    </div>
  );
}
