"use client";

/**
 * "Portals" section of `/settings/ai/copilot` (Epic 77 B3): turn the Client / Vendor / Candidate portal Copilots on
 * (disabled until AI agents are on), limits, retention, the hand-off role, and the usage table (metadata only).
 */
import {
  Caption1,
  Card,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  SpinButton,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoles } from "@/features/admin/use-admin-data";
import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/use-me";
import { errorMessage } from "@/lib/api/errors";
import { portalCopilotAdminApi, portalCopilotKeys } from "./api";
import type { PortalCopilotSettingsIn, PortalKind } from "./types";

const useStyles = makeStyles({
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: tokens.spacingHorizontalL },
  hint: { color: tokens.colorNeutralForeground3 },
});

const SWITCHES: { key: "client_enabled" | "vendor_enabled" | "candidate_enabled"; label: string }[] = [
  { key: "client_enabled", label: "Client Portal Copilot" },
  { key: "vendor_enabled", label: "Vendor Portal Copilot" },
  { key: "candidate_enabled", label: "Candidate Portal Copilot" },
];
const PORTAL_LABEL: Record<PortalKind, string> = { client: "Client", vendor: "Vendor", candidate: "Candidate" };

export function PortalCopilotSettingsSection() {
  const styles = useStyles();
  const me = useMe();
  const canConfigure = hasPermission(me.data?.permissions, "ai:agent_configure");
  const canGovern = hasPermission(me.data?.permissions, "ai:govern");
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: portalCopilotKeys.settings, queryFn: ({ signal }) => portalCopilotAdminApi.settings(signal) });
  const usage = useQuery({ queryKey: portalCopilotKeys.usage, queryFn: ({ signal }) => portalCopilotAdminApi.usage(signal), enabled: canGovern });
  const roles = useRoles(canConfigure);
  const save = useMutation({
    mutationFn: (body: PortalCopilotSettingsIn) => portalCopilotAdminApi.save(body),
    onSuccess: (data) => qc.setQueryData(portalCopilotKeys.settings, data),
  });
  const s = settings.data;
  if (!s) return null;
  const agentsOff = !s.agentic_enabled;
  return (
    <Card className={styles.card} aria-label="Portals">
      <Subtitle2 as="h2">Portals</Subtitle2>
      {save.error && (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(save.error)}</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.grid}>
        {SWITCHES.map((sw) => (
          <Field key={sw.key} hint={agentsOff ? "Turn on AI agents first" : undefined}>
            <Switch
              label={sw.label}
              checked={s[sw.key]}
              disabled={agentsOff || !canConfigure || save.isPending}
              onChange={(_, d) => save.mutate({ [sw.key]: d.checked })}
            />
          </Field>
        ))}
      </div>
      <div className={styles.grid}>
        <Field label="Questions per hour — client and vendor users">
          <SpinButton
            min={5}
            max={120}
            value={s.questions_per_hour_external}
            disabled={!canConfigure}
            onChange={(_, d) => d.value != null && save.mutate({ questions_per_hour_external: d.value })}
          />
        </Field>
        <Field label="Questions per hour — candidates">
          <SpinButton
            min={5}
            max={60}
            value={s.questions_per_hour_candidate}
            disabled={!canConfigure}
            onChange={(_, d) => d.value != null && save.mutate({ questions_per_hour_candidate: d.value })}
          />
        </Field>
        <Field label="Keep conversations for (days)">
          <SpinButton
            min={7}
            max={90}
            value={s.retention_days}
            disabled={!canConfigure}
            onChange={(_, d) => d.value != null && save.mutate({ retention_days: d.value })}
          />
        </Field>
        <Field label="Hand-off role for candidate questions">
          <Dropdown
            placeholder="Application owner, else a Tenant Admin"
            value={roles.data?.find((r) => r.key === s.handoff_queue_role_key)?.name ?? ""}
            selectedOptions={s.handoff_queue_role_key ? [s.handoff_queue_role_key] : []}
            disabled={!canConfigure}
            onOptionSelect={(_, d) => save.mutate({ handoff_queue_role_key: d.optionValue ?? null })}
          >
            {(roles.data ?? []).map((r) => (
              <Option key={r.id} value={r.key ?? ""}>
                {r.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      {canGovern && usage.data && (
        <Table aria-label="Portal Copilot usage" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Portal</TableHeaderCell>
              <TableHeaderCell>Questions</TableHeaderCell>
              <TableHeaderCell>Helpful %</TableHeaderCell>
              <TableHeaderCell>Drafts confirmed</TableHeaderCell>
              <TableHeaderCell>Cost (USD)</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.data.rows.map((r) => (
              <TableRow key={r.portal}>
                <TableCell>{PORTAL_LABEL[r.portal]}</TableCell>
                <TableCell>{r.questions}</TableCell>
                <TableCell>{r.helpful_pct == null ? "—" : `${r.helpful_pct}%`}</TableCell>
                <TableCell>{r.drafts_confirmed}</TableCell>
                <TableCell>{r.cost_usd.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Caption1 className={styles.hint}>Conversation text is private to each portal user; this page shows metadata only.</Caption1>
    </Card>
  );
}
