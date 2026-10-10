"use client";

/** "Used tools" chips of an answer (Epic 54 B3): small outline tags; a spinner while a tool runs. */
import { makeStyles, Spinner, Tag, tokens } from "@fluentui/react-components";
import { Warning16Regular } from "@fluentui/react-icons";
import { chipFailed, chipText } from "./copy";
import type { ToolEntry } from "./types";

const useStyles = makeStyles({
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  warn: { color: tokens.colorPaletteMarigoldForeground1 },
});

export function ToolChips({ tools }: { tools: (ToolEntry & { pending?: boolean })[] }) {
  const styles = useStyles();
  if (!tools.length) return null;
  return (
    <div className={styles.row} aria-label="Tools used">
      {tools.map((t, i) => (
        <Tag
          key={`${t.tool_key}-${i}`}
          size="small"
          appearance="outline"
          icon={
            t.pending ? (
              <Spinner size="extra-tiny" />
            ) : chipFailed(t) ? (
              <Warning16Regular className={styles.warn} />
            ) : undefined
          }
        >
          {t.pending ? t.title : chipText(t)}
        </Tag>
      ))}
    </div>
  );
}
