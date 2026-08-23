// components/graph/DependencyGraphCanvas.jsx — ReactFlow canvas with a
// deterministic layered layout (depth bands, ordered by label within band).
"use client";

import * as React from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const NODE_W = 190;

function DepNode({ data, selected }) {
  const isProject = data.kind === "project";
  return (
    <div
      style={{ width: NODE_W }}
      className={[
        "rounded-lg border bg-card px-3 py-2 shadow-sm transition-shadow",
        selected ? "ring-2 ring-ring" : "",
        data.vulnerable ? "border-red-400 dark:border-red-600" : "",
        isProject ? "border-foreground/30" : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <p
        className={`truncate text-xs font-semibold ${data.vulnerable ? "text-red-600 dark:text-red-400" : ""}`}
        title={data.label}
      >
        {isProject ? "▲ " : ""}
        {data.label}
      </p>
      {data.version ? (
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          @{data.version}
          {data.vulnerable ? " · CVE" : ""}
        </p>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { dep: DepNode };

function layout(nodes) {
  const bands = new Map();
  for (const node of nodes) {
    if (!bands.has(node.depth)) bands.set(node.depth, []);
    bands.get(node.depth).push(node);
  }
  const positioned = [];
  for (const [depth, band] of [...bands.entries()].sort((a, b) => a[0] - b[0])) {
    band.sort((a, b) => a.label.localeCompare(b.label));
    const rowWidth = band.length * NODE_W + (band.length - 1) * 60;
    band.forEach((node, index) => {
      positioned.push({
        ...node,
        type: "dep",
        position: {
          x: index * (NODE_W + 60) - rowWidth / 2,
          y: depth * 130,
        },
        data: node,
      });
    });
  }
  return positioned;
}

export default function DependencyGraphCanvas({
  nodes,
  edges,
  selectedId,
  highlightEdges,
  onSelectNode,
  loading = false,
}) {
  const flowNodes = React.useMemo(() => layout(nodes), [nodes]);

  const flowEdges = React.useMemo(
    () =>
      edges.map((edge) => ({
        id: `${edge.source}|${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: edge.label || undefined,
        animated: highlightEdges?.has(`${edge.source}|${edge.target}`),
        style: highlightEdges?.has(`${edge.source}|${edge.target}`)
          ? { stroke: "#dc2626", strokeWidth: 2 }
          : undefined,
        labelStyle: { fontSize: 10 },
      })),
    [edges, highlightEdges],
  );

  if (loading) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        Building graph…
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        No dependency data available for this project yet.
      </div>
    );
  }

  return (
    <div className="h-[520px] overflow-hidden rounded-xl border bg-card">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={1.75}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => onSelectNode?.(node.data)}
        onPaneClick={() => onSelectNode?.(null)}
      >
        <Background gap={18} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
