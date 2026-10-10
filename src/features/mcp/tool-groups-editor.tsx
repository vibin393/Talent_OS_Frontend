"use client";

import { Badge, Caption1, Card, Checkbox, makeStyles, tokens } from "@fluentui/react-components";
import { useState } from "react";
import type { LowToolMode, McpGroup } from "./api";
import { executionBadge } from "./logic";

const useStyles = makeStyles({
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: tokens.spacingHorizontalM },
  card: { padding: tokens.spacingHorizontalM, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  tools: { margin: 0, paddingLeft: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  toggle: { background: "none", border: "none", padding: 0, color: tokens.colorBrandForeground1, cursor: "pointer", textAlign: "left" },
});

/** "Tool groups" (spec B2): a checkbox card per group with its tools and execution class. */
export function ToolGroupsEditor({
  groups,
  value,
  modes,
  disabled,
  onChange,
}: {
  groups: McpGroup[];
  value: string[];
  modes: Record<string, LowToolMode>;
  disabled: boolean;
  onChange: (groups: string[]) => void;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className={styles.grid}>
      {groups.map((g) => (
        <Card key={g.key} className={styles.card}>
          <Checkbox
            label={g.label}
            checked={value.includes(g.key)}
            disabled={disabled}
            onChange={(_, d) => onChange(d.checked ? [...new Set([...value, g.key])] : value.filter((k) => k !== g.key))}
          />
          <Caption1>{g.description}</Caption1>
          <button type="button" className={styles.toggle} aria-expanded={open === g.key} onClick={() => setOpen(open === g.key ? null : g.key)}>
            {g.tools.length} tools
          </button>
          {open === g.key ? (
            <ul className={styles.tools}>
              {g.tools.map((t) => (
                <li key={t.key}>
                  {t.title}{" "}
                  <Badge appearance="tint" color={t.execution === "read" ? "informative" : t.execution === "propose" ? "warning" : "brand"}>
                    {executionBadge(t.execution, modes[t.key])}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
