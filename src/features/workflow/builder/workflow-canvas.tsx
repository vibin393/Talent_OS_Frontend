"use client";

import "@xyflow/react/dist/style.css";
import {
  Body1,
  Button,
  Caption1,
  Card,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  Text,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import {
  Add12Regular,
  BranchFork20Regular,
  CheckmarkCircle20Regular,
  Flash20Regular,
  Play20Regular,
  Stop20Regular,
  Timer20Regular,
} from "@fluentui/react-icons";
import {
  Background,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { forwardRef, useImperativeHandle, useMemo } from "react";
import { allEdges, handlesOf, layoutOf, NODE_LABELS, nodeText } from "./graph-model";
import type { Graph, GraphNode, NodeType } from "./types";

const ADDABLE: NodeType[] = ["condition", "delay", "approval", "action", "end"];

const useStyles = makeStyles({
  wrap: {
    height: "560px",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  card: {
    width: "220px",
    padding: tokens.spacingHorizontalM,
    gap: tokens.spacingVerticalXS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
  },
  selected: { outline: `${tokens.strokeWidthThick} solid ${tokens.colorBrandStroke1}` },
  error: { outline: `${tokens.strokeWidthThick} solid ${tokens.colorPaletteRedBorder2}` },
  walked: { backgroundColor: tokens.colorPaletteGreenBackground1 },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  icon: {
    width: "28px",
    height: "28px",
    borderRadius: tokens.borderRadiusMedium,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForegroundOnBrand,
    flexShrink: 0,
  },
  condition: { backgroundColor: tokens.colorPaletteDarkOrangeBackground3 },
  delay: { backgroundColor: tokens.colorPaletteBlueBackground2 },
  approval: { backgroundColor: tokens.colorPalettePurpleBackground2 },
  action: { backgroundColor: tokens.colorPaletteGreenBackground3 },
  end: { backgroundColor: tokens.colorNeutralForeground3 },
  text: { color: tokens.colorNeutralForeground2, overflowWrap: "anywhere" },
  handles: { display: "flex", justifyContent: "space-around", marginTop: tokens.spacingVerticalXS },
  handle: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" },
  start: { color: tokens.colorBrandForeground1 },
});

const ICONS: Record<NodeType, React.ReactElement> = {
  condition: <BranchFork20Regular />,
  delay: <Timer20Regular />,
  approval: <CheckmarkCircle20Regular />,
  action: <Play20Regular />,
  end: <Stop20Regular />,
};

type StepData = {
  node: GraphNode;
  text: string;
  isStart: boolean;
  selected: boolean;
  error: boolean;
  walked: boolean;
  readOnly: boolean;
  onAdd: (fromId: string, field: string, type: NodeType) => void;
};
type StepNode = Node<StepData, "step">;

export function AddStepMenu({ onAdd, label, disabled }: { onAdd: (type: NodeType) => void; label: string; disabled?: boolean }) {
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Tooltip content={label} relationship="label">
          <Button size="small" appearance="subtle" icon={<Add12Regular />} disabled={disabled} className="nodrag" />
        </Tooltip>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {ADDABLE.map((t) => (
            <MenuItem key={t} icon={ICONS[t]} onClick={() => onAdd(t)}>
              {NODE_LABELS[t]}
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

function StepCard({ data }: NodeProps<StepNode>) {
  const styles = useStyles();
  const { node } = data;
  const handles = handlesOf(node);
  return (
    <Card
      className={mergeClasses(styles.card, data.walked && styles.walked, data.selected && styles.selected, data.error && styles.error)}
      aria-label={`${NODE_LABELS[node.type]}: ${data.text}`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className={styles.head}>
        <span className={mergeClasses(styles.icon, styles[node.type])} aria-hidden>
          {ICONS[node.type]}
        </span>
        <div style={{ minWidth: 0 }}>
          <Text weight="semibold">{NODE_LABELS[node.type]}</Text>
          {data.isStart && (
            <Caption1 className={styles.start}>
              {" "}
              <Flash20Regular style={{ width: 12, height: 12 }} aria-hidden /> Start
            </Caption1>
          )}
        </div>
      </div>
      {node.type !== "end" && <Body1 className={styles.text}>{data.text}</Body1>}
      {handles.length > 0 && (
        <div className={styles.handles}>
          {handles.map((h, i) => (
            <div key={h.field} className={styles.handle}>
              {handles.length > 1 && <Caption1>{h.label}</Caption1>}
              {!data.readOnly && <AddStepMenu label={`Add a step after ${h.label}`} onAdd={(type) => data.onAdd(node.id, h.field, type)} />}
              <Handle
                type="source"
                id={h.field}
                position={Position.Bottom}
                isConnectable={false}
                style={{ left: `${((i + 1) / (handles.length + 1)) * 100}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const NODE_TYPES = { step: StepCard };

export type CanvasHandle = { fit: () => void; focusNode: (id: string) => void };

type CanvasProps = {
  graph: Graph;
  labels: { fields?: Record<string, string>; actions?: Record<string, string> };
  selectedId: string | null;
  errorIds: ReadonlySet<string>;
  walked: { nodes: ReadonlySet<string>; edges: ReadonlySet<string> } | null;
  readOnly: boolean;
  onSelect: (id: string | null) => void;
  onAdd: (fromId: string, field: string, type: NodeType) => void;
  onMove: (id: string, x: number, y: number) => void;
};

const Inner = forwardRef<CanvasHandle, CanvasProps>(function Inner(props, ref) {
  const { graph, labels, selectedId, errorIds, walked, readOnly, onSelect, onAdd, onMove } = props;
  const flow = useReactFlow();
  useImperativeHandle(ref, () => ({
    fit: () => void flow.fitView({ padding: 0.2, duration: 200 }),
    focusNode: (id: string) => {
      const n = flow.getNode(id);
      if (n) void flow.setCenter(n.position.x + 110, n.position.y + 60, { zoom: 1, duration: 200 });
    },
  }));
  const positions = useMemo(() => layoutOf(graph), [graph]);
  const nodes: StepNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: "step",
    position: positions[node.id] ?? { x: 0, y: 0 },
    data: {
      node,
      text: nodeText(node, labels),
      isStart: graph.start === node.id,
      selected: node.id === selectedId,
      error: errorIds.has(node.id),
      walked: !!walked?.nodes.has(node.id),
      readOnly,
      onAdd,
    },
    selected: node.id === selectedId,
  }));
  const edges: Edge[] = allEdges(graph).map((e) => {
    const from = graph.nodes.find((n) => n.id === e.from);
    const many = from ? handlesOf(from).length > 1 : false;
    const label = from ? handlesOf(from).find((h) => h.field === e.field)?.label : undefined;
    const hot = !!walked?.edges.has(`${e.from}:${e.field}`);
    return {
      id: `${e.from}:${e.field}`,
      source: e.from,
      sourceHandle: e.field,
      target: e.to,
      label: many ? label : undefined,
      animated: hot,
      style: { stroke: hot ? tokens.colorPaletteGreenBorder2 : tokens.colorNeutralStroke1, strokeWidth: hot ? 2.5 : 1.5 },
    };
  });
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      fitView
      nodesDraggable={!readOnly}
      nodesConnectable={false}
      elementsSelectable
      onNodeClick={(_, n) => onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      onNodesChange={(changes) => {
        // Controlled positions: drags write the graph layout (cosmetic, not a step).
        for (const c of changes) if (c.type === "position" && c.position) onMove(c.id, Math.round(c.position.x), Math.round(c.position.y));
      }}
      proOptions={{ hideAttribution: true }}
      aria-label="Workflow canvas. Use the Outline tab for a keyboard-friendly view."
    >
      <Background />
    </ReactFlow>
  );
});

/** The React Flow canvas: nodes are Fluent cards, one icon per type, token colours only (Epic 32 B1). */
export const WorkflowCanvas = forwardRef<CanvasHandle, CanvasProps>(function WorkflowCanvas(props, ref) {
  const styles = useStyles();
  return (
    <div className={styles.wrap}>
      <ReactFlowProvider>
        <Inner ref={ref} {...props} />
      </ReactFlowProvider>
    </div>
  );
});
