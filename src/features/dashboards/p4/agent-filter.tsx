"use client";

import { makeStyles, tokens } from "@fluentui/react-components";
import { IdSelect } from "@/features/admin/ui";
import { useAgentCatalog } from "@/features/ai-governance/api";

const useStyles = makeStyles({
  bar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  field: { minWidth: "200px", maxWidth: "320px", flex: "1 1 200px" },
});

/** "Agent" filter of the P4 dashboards (`agent_key` on every tile). Hidden when the agent catalog is not readable. */
export function AgentFilter({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const styles = useStyles();
  const agents = useAgentCatalog();
  const options = (agents.data ?? []).filter((a) => !a.placeholder).map((a) => ({ id: a.key, label: a.name }));
  if (options.length === 0) return null;
  return (
    <div className={styles.bar}>
      <IdSelect label="Agent" className={styles.field} options={options} value={value} noneLabel="All agents" onChange={onChange} />
    </div>
  );
}
