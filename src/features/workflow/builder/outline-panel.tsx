"use client";

import { Badge, makeStyles, mergeClasses, Text, tokens } from "@fluentui/react-components";
import { useRef } from "react";
import { HANDLES, nodeById } from "./graph-model";
import type { Graph, NodeType, OutlineRow } from "./types";
import { AddStepMenu } from "./workflow-canvas";

const useStyles = makeStyles({
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px", maxWidth: "960px" },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minHeight: "32px",
    borderRadius: tokens.borderRadiusMedium,
    paddingInlineEnd: tokens.spacingHorizontalS,
    ":focus-within": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  button: {
    flex: 1,
    textAlign: "start",
    background: "none",
    border: 0,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    cursor: "pointer",
    borderRadius: tokens.borderRadiusMedium,
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}` },
  },
  selected: { backgroundColor: tokens.colorBrandBackground2 },
  error: { color: tokens.colorPaletteRedForeground1 },
  branch: { color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightSemibold },
});

/**
 * Read-only, keyboard-navigable outline (the form-based equivalent of the canvas, FR-169). Up / Down move
 * between rows, Enter selects the step; "Add step after…" builds without dragging.
 */
export function OutlinePanel({
  graph,
  rows,
  selectedId,
  errorIds,
  readOnly,
  onSelect,
  onAdd,
}: {
  graph: Graph;
  rows: readonly OutlineRow[];
  selectedId: string | null;
  errorIds: ReadonlySet<string>;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onAdd: (fromId: string | null, field: string | null, type: NodeType) => void;
}) {
  const styles = useStyles();
  const listRef = useRef<HTMLUListElement>(null);
  const move = (from: HTMLElement, delta: 1 | -1) => {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-outline-row]") ?? []);
    const i = buttons.indexOf(from as HTMLButtonElement);
    buttons[Math.min(Math.max(i + delta, 0), buttons.length - 1)]?.focus();
  };
  // A branch row adds on that branch; a step row adds on its single "next" handle.
  const addTarget = (row: OutlineRow, index: number): { fromId: string; field: string } | null => {
    const node = nodeById(graph, row.node_id);
    if (!node) return null;
    if (row.kind === "branch") {
      const branchIndex = rows.slice(0, index).filter((r) => r.kind === "branch" && r.node_id === row.node_id).length;
      const field = HANDLES[node.type][branchIndex]?.field;
      return field ? { fromId: node.id, field } : null;
    }
    if (node.type === "delay" || node.type === "action") return { fromId: node.id, field: "next" };
    return null;
  };

  return (
    <div>
      {!readOnly && (
        <div style={{ marginBottom: tokens.spacingVerticalS, display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
          <Text>Add a first step</Text>
          <AddStepMenu label="Add a step at the start" onAdd={(t) => onAdd(null, null, t)} />
        </div>
      )}
      <ul ref={listRef} className={styles.list} aria-label="Workflow outline">
        {rows.map((row, i) => {
          const target = !readOnly ? addTarget(row, i) : null;
          return (
            <li key={`${row.node_id}-${i}`} className={styles.row} style={{ paddingInlineStart: `calc(${row.depth} * ${tokens.spacingHorizontalXXL})` }}>
              <button
                type="button"
                data-outline-row
                className={mergeClasses(styles.button, row.node_id === selectedId && row.kind !== "branch" && styles.selected, row.kind === "branch" && styles.branch, errorIds.has(row.node_id) && row.kind !== "branch" && styles.error)}
                onClick={() => onSelect(row.node_id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    move(e.currentTarget, 1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    move(e.currentTarget, -1);
                  }
                }}
              >
                {row.text}
              </button>
              {errorIds.has(row.node_id) && row.kind !== "branch" && (
                <Badge appearance="tint" color="danger">
                  Check
                </Badge>
              )}
              {target && <AddStepMenu label="Add step after…" onAdd={(t) => onAdd(target.fromId, target.field, t)} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
