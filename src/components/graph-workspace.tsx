"use client";

import "@xyflow/react/dist/style.css";

import { useMemo, useState, useTransition } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  Position,
  Handle,
} from "@xyflow/react";
import clsx from "clsx";
import {
  BadgeAlert,
  ChevronRight,
  Compass,
  GitMerge,
  Layers3,
  Link2,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { ExplorePayload, GraphNodeKind, NodeInsight } from "@/lib/types";

type GraphNodeData = NodeInsight & {
  onExpand: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
};

const examples = ["Minecraft", "Coca-Cola", "Taylor Swift", "Cold War", "Discord"];

const kindClasses: Record<GraphNodeKind, string> = {
  topic: "bg-sky-400",
  person: "bg-amber-400",
  company: "bg-blue-500",
  event: "bg-rose-500",
  meme: "bg-lime-400",
  technology: "bg-teal-400",
  place: "bg-violet-400",
  discussion: "bg-pink-400",
  media: "bg-indigo-400",
};

function polarPoint(index: number, total: number, radius = 240) {
  const angle = (Math.PI * 2 * index) / Math.max(total, 1);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function createGraphNode(
  insight: NodeInsight,
  x: number,
  y: number,
  callbacks: Pick<GraphNodeData, "onExpand" | "onSelect">,
): Node<GraphNodeData> {
  return {
    id: insight.id,
    type: "rabbitNode",
    position: { x, y },
    data: {
      ...insight,
      ...callbacks,
    },
  };
}

function RabbitNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  return (
    <div
      className={clsx(
        "w-72 rounded-2xl border bg-zinc-950 p-5 text-left shadow-2xl transition-all duration-300",
        selected ? "border-zinc-400 ring-4 ring-zinc-800/40 scale-[1.02]" : "border-zinc-800 hover:border-zinc-600 hover:-translate-y-1",
      )}
      onClick={() => data.onSelect(data.id)}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-0 !bg-zinc-700" />
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={clsx("size-2 rounded-full", kindClasses[data.kind])} />
          <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
            {data.kind}
          </div>
        </div>
        <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[9px] uppercase tracking-wider text-zinc-400">
          live
        </span>
      </div>
      <div className="mb-2 text-xl font-medium tracking-tight text-zinc-100">{data.title}</div>
      <p className="line-clamp-3 text-sm leading-relaxed text-zinc-400">{data.summary}</p>
      <div className="mt-5 flex items-center justify-between border-t border-zinc-900 pt-4">
        <div className="text-[11px] text-zinc-500">{data.tags.slice(0, 2).join(" • ")}</div>
        <button
          type="button"
          className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-white"
          onClick={(event) => {
            event.stopPropagation();
            data.onExpand(data.id);
          }}
        >
          Expand
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-0 !bg-zinc-700" />
    </div>
  );
}

const nodeTypes = { rabbitNode: RabbitNode };

async function postExplore(body: unknown) {
  const response = await fetch("/api/explore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Live generation failed.");
  }

  return (await response.json()) as ExplorePayload;
}

async function fetchSeed(topic: string) {
  return postExplore({ mode: "seed", topic });
}

async function fetchExpand(topic: string, count: number) {
  return postExplore({ mode: "expand", topic, count });
}

async function fetchBridge(topics: string[], count: number) {
  return postExplore({ mode: "bridge", topics, count });
}

export function GraphWorkspace() {
  const [nodes, setNodes] = useState<Node<GraphNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [joinSelection, setJoinSelection] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [expandCount, setExpandCount] = useState(1);
  const [status, setStatus] = useState(
    "Add a topic to place a single live seed node on the canvas.",
  );
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<Node<GraphNodeData>, Edge> | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const joinNodes = useMemo(
    () =>
      joinSelection
        .map((id) => nodes.find((node) => node.id === id))
        .filter((node): node is Node<GraphNodeData> => Boolean(node)),
    [joinSelection, nodes],
  );
  const inspectorOpen = Boolean(selectedNode);

  function scheduleFitView() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        reactFlowInstance?.fitView({ padding: 0.2, duration: 500 });
      });
    });
  }

  function focusNode(nodeId: string) {
    setSelectedId(nodeId);
  }

  function edgeExists(source: string, target: string) {
    return edges.some(
      (edge) =>
        (edge.source === source && edge.target === target) ||
        (edge.source === target && edge.target === source),
    );
  }

  function uniqueNodeId(baseId: string, existingIds: Set<string>) {
    if (!existingIds.has(baseId)) {
      return baseId;
    }

    let index = 2;
    while (existingIds.has(`${baseId}-${index}`)) {
      index += 1;
    }

    return `${baseId}-${index}`;
  }

  function appendPayload(
    payload: ExplorePayload,
    origin: { x: number; y: number },
    options?: {
      rootIdOverride?: string;
      preserveRoot?: boolean;
      accentColor?: string;
      attachTo?: string[];
    },
  ) {
    const rootId = options?.rootIdOverride ?? payload.root.id;

    setNodes((current) => {
      const existingIds = new Set(current.map((node) => node.id));
      const byId = new Map(current.map((node) => [node.id, node]));
      const callbacks = { onExpand: handleExpand, onSelect: focusNode };

      if (!existingIds.has(rootId) || !options?.preserveRoot) {
        byId.set(
          rootId,
          createGraphNode(
            { ...payload.root, id: rootId },
            origin.x,
            origin.y,
            callbacks,
          ),
        );
        existingIds.add(rootId);
      }

      payload.connections.forEach((connection, index) => {
        const point = polarPoint(index, payload.connections.length || 1);
        const nextId = uniqueNodeId(connection.id, existingIds);
        byId.set(
          nextId,
          createGraphNode(
            { ...connection, id: nextId },
            origin.x + point.x,
            origin.y + point.y,
            callbacks,
          ),
        );
        existingIds.add(nextId);
      });

      return Array.from(byId.values());
    });

    setEdges((current) => {
      const byId = new Map(current.map((edge) => [edge.id, edge]));
      const accentColor = options?.accentColor ?? "#6ee7f9";

      payload.connections.forEach((connection, index) => {
        const nextId =
          current.find((node) => node.id === connection.id) || byId.has(`${rootId}->${connection.id}`)
            ? `${connection.id}-${rootId}-${index + 1}`
            : connection.id;

        byId.set(`${rootId}->${nextId}`, {
          id: `${rootId}->${nextId}`,
          source: rootId,
          target: nextId,
          animated: true,
          style: { stroke: accentColor, strokeOpacity: 0.48 },
        });
      });

      options?.attachTo?.forEach((sourceId) => {
        byId.set(`${sourceId}<->${rootId}`, {
          id: `${sourceId}<->${rootId}`,
          source: sourceId,
          target: rootId,
          animated: true,
          style: { stroke: accentColor, strokeOpacity: 0.8, strokeWidth: 2 },
        });
      });

      return Array.from(byId.values());
    });

    setSelectedId(rootId);
    scheduleFitView();
  }

  function handleAddTopic(nextTopic?: string) {
    const seed = (nextTopic ?? topic).trim();
    if (!seed) {
      setStatus("Type a topic first.");
      return;
    }

    startTransition(async () => {
      setStatus(`Adding ${seed}...`);

      try {
        const existing = nodes.find(
          (node) => node.data.title.toLowerCase() === seed.toLowerCase(),
        );

        if (existing) {
          setSelectedId(existing.id);
          setStatus(`${seed} is already on the canvas.`);
          return;
        }

        const payload = await fetchSeed(seed);
        const rootCount = nodes.filter((node) => node.data.kind === "topic").length;
        const origin =
          nodes.length === 0
            ? { x: 0, y: 0 }
            : polarPoint(rootCount, Math.max(rootCount + 1, 3), 480);

        appendPayload(payload, origin);
        setTopic("");
        setStatus(`Added ${payload.root.title}. Expand it when you want related nodes.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not add topic.");
      }
    });
  }

  function handleExpand(nodeId: string) {
    const parent = nodes.find((node) => node.id === nodeId);
    if (!parent) {
      return;
    }

    startTransition(async () => {
      setStatus(`Generating ${expandCount} related node${expandCount > 1 ? "s" : ""} for ${parent.data.title}...`);

      try {
        const payload = await fetchExpand(parent.data.title, expandCount);

        setNodes((current) =>
          current.map((node) =>
            node.id === parent.id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    ...payload.root,
                    id: parent.id,
                    onExpand: handleExpand,
                    onSelect: focusNode,
                  },
                }
              : node,
          ),
        );

        appendPayload(payload, parent.position, {
          rootIdOverride: parent.id,
          preserveRoot: true,
          accentColor: "#7dd3fc",
        });

        setStatus(
          `Added ${payload.connections.length} related node${payload.connections.length > 1 ? "s" : ""} for ${parent.data.title}.`,
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Expansion failed.");
      }
    });
  }

  function removeNode(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }

    setNodes((current) => current.filter((item) => item.id !== nodeId));
    setEdges((current) =>
      current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    );
    setJoinSelection((current) => current.filter((id) => id !== nodeId));
    setSelectedId((current) => (current === nodeId ? null : current));
    setStatus(`Removed ${node.data.title}.`);
  }

  function toggleJoinSelection(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }

    setJoinSelection((current) =>
      current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId],
    );
    setStatus(`Updated join group. Select as many nodes as you want, then run Join selected.`);
  }

  function buildJoinGroup(nodeIds: string[]) {
    const group = nodeIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is Node<GraphNodeData> => Boolean(node));

    if (group.length < 2) {
      setStatus("Pick at least two nodes before joining.");
      return;
    }

    startTransition(async () => {
      const titles = group.map((node) => node.data.title);
      setStatus(`Building overlap for ${titles.join(", ")}...`);

      try {
        const payload = await fetchBridge(titles, 1);
        const midpoint = group.reduce(
          (acc, node) => ({
            x: acc.x + node.position.x / group.length,
            y: acc.y + node.position.y / group.length,
          }),
          { x: 0, y: 0 },
        );

        const bridgeRootId = slugify(titles.join("-")) + "-bridge";

        group.forEach((node) => {
          if (!edgeExists(node.id, bridgeRootId)) {
            setEdges((current) =>
              addEdge(
                {
                  id: `${node.id}<->${bridgeRootId}`,
                  source: node.id,
                  target: bridgeRootId,
                  animated: true,
                  style: { stroke: "#f8fafc", strokeOpacity: 0.75, strokeWidth: 1.8 },
                },
                current,
              ),
            );
          }
        });

        appendPayload(payload, midpoint, {
          rootIdOverride: bridgeRootId,
          accentColor: "#f8fafc",
          attachTo: group.map((node) => node.id),
        });

        setJoinSelection([]);
        setStatus(
          `Generated ${payload.connections.length} shared node${payload.connections.length > 1 ? "s" : ""} from ${group.length} connected topics.`,
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Join failed.");
      }
    });
  }

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) {
      return;
    }
    buildJoinGroup([connection.source, connection.target]);
  }

  return (
    <main className="relative flex h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-50">
      {/* Top Left Elements: Title, Status, and Controls */}
      <div className="pointer-events-none absolute left-6 top-6 z-40 flex flex-col gap-4">
        <div className="pointer-events-auto max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Layers3 className="size-5 text-zinc-100" />
            <h1 className="text-base font-semibold tracking-tight text-zinc-100">
              Rabbit Hole Studio
            </h1>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Seed a topic, expand purposefully, and merge ideas to discover overlap.
          </p>
          <div className="mt-4 flex items-center gap-2">
            {isPending ? (
              <LoaderCircle className="size-3.5 animate-spin text-zinc-500" />
            ) : (
              <Compass className="size-3.5 text-zinc-500" />
            )}
            <div className="text-xs text-zinc-300">{status}</div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <CountControl label="Expand" value={expandCount} onChange={setExpandCount} />
        </div>

        <div className="pointer-events-auto flex flex-wrap gap-2 max-w-sm">
          {examples.map((example) => (
            <button
              key={example}
              onClick={() => handleAddTopic(example)}
              className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative h-full w-full">
        {nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="text-center">
              <Sparkles className="mx-auto mb-4 size-8 text-zinc-700" />
              <h2 className="text-2xl font-medium tracking-tight text-zinc-300">
                Start Exploring
              </h2>
              <p className="mt-2 max-w-sm text-sm text-zinc-500">
                Use the command dock below to add your first topic, then expand or join nodes as you go.
              </p>
            </div>
          </div>
        ) : null}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          onInit={setReactFlowInstance}
          onNodesChange={(changes) => setNodes((c) => applyNodeChanges(changes, c))}
          onEdgesChange={(changes) => setEdges((c) => applyEdgeChanges(changes, c))}
          onConnect={handleConnect}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          className="h-full w-full bg-zinc-950"
        >
          <MiniMap
            pannable
            zoomable
            className="!bottom-28 !left-6 !rounded-xl !border-zinc-800 !bg-zinc-950/80 !shadow-2xl"
            nodeColor={() => "#52525b"} // zinc-600
            maskColor="rgba(9, 9, 11, 0.7)"
          />
          <Controls className="!bottom-28 !left-[9.5rem] !flex !bg-zinc-950/80 !shadow-2xl !backdrop-blur-xl [&_button]:!border-zinc-800" />
          <Background variant={BackgroundVariant.Dots} color="#27272a" gap={24} size={1} />
        </ReactFlow>
      </div>

      {/* Floating Command Dock (Bottom Center) */}
      <div className="absolute bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/90 p-2 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <label className="relative ml-2 flex items-center">
          <Search className="absolute left-3 size-4 text-zinc-500" />
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTopic(topic)}
            placeholder="Search topic..."
            className="w-64 rounded-full border border-transparent bg-transparent py-2 pl-9 pr-4 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:bg-zinc-900 focus:border-zinc-700"
          />
        </label>
        <div className="h-6 w-px bg-zinc-800 mx-1" />
        <ToolbarButton
          icon={<Plus className="size-4" />}
          label="Add"
          onClick={() => handleAddTopic(topic)}
          emphasis="primary"
        />
        <ToolbarButton
          icon={<GitMerge className="size-4" />}
          label={`Join (${joinSelection.length})`}
          onClick={() => buildJoinGroup(joinSelection)}
          disabled={joinSelection.length < 2}
        />
        <ToolbarButton
          icon={<Trash2 className="size-4" />}
          label="Reset"
          onClick={() => {
            setNodes([]);
            setEdges([]);
            setSelectedId(null);
            setJoinSelection([]);
            setStatus("Canvas cleared.");
          }}
        />
      </div>

      {/* Sliding Inspector Panel (Right side) */}
      <div
        className={clsx(
          "pointer-events-none absolute inset-y-6 right-6 z-40 w-full max-w-sm transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)",
          inspectorOpen ? "translate-x-0 opacity-100" : "translate-x-12 opacity-0",
        )}
      >
        <div className="pointer-events-auto h-full rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-xl flex flex-col">
          <div className="flex items-center justify-between mb-6 border-b border-zinc-900 pb-4">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Inspector</div>
            <button
              onClick={() => setSelectedId(null)}
              className="rounded-full bg-zinc-900 p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="size-4" />
            </button>
          </div>

          {selectedNode ? (
            <div className="flex-1 overflow-y-auto pr-2 pb-8 scrollbar-hide">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
                    {selectedNode.data.title}
                  </h2>
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                    {selectedNode.data.kind}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                {selectedNode.data.summary}
              </p>

              <div className="mt-6 flex flex-wrap gap-2 border-y border-zinc-900 py-6">
                <ToolbarButton
                  icon={<ChevronRight className="size-4" />}
                  label="Expand"
                  onClick={() => handleExpand(selectedNode.id)}
                  emphasis="primary"
                />
                <ToolbarButton
                  icon={<GitMerge className="size-4" />}
                  label={joinSelection.includes(selectedNode.id) ? "Queued" : "Queue Join"}
                  onClick={() => toggleJoinSelection(selectedNode.id)}
                  emphasis={joinSelection.includes(selectedNode.id) ? "primary" : "secondary"}
                />
                <ToolbarButton
                  icon={<Trash2 className="size-4 text-rose-400" />}
                  label=""
                  onClick={() => removeNode(selectedNode.id)}
                />
              </div>

              <div className="mt-6 space-y-6">
                <InfoBlock title="Why it matters" body={selectedNode.data.importance} />
                <InfoBlock title="Why this connection" body={selectedNode.data.reason} />

                {selectedNode.data.controversy && (
                  <InfoBlock
                    title="Controversy"
                    body={selectedNode.data.controversy}
                    icon={<BadgeAlert className="size-4 text-rose-400" />}
                  />
                )}

                <InfoBlock title="Timeline" body={selectedNode.data.timeline.join(" • ")} />
                <InfoBlock title="Curiosity path" body={selectedNode.data.curiosityPath.join(" → ")} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled = false,
  emphasis = "secondary",
}: {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
        label === "" && "px-3", // icon only mode
        emphasis === "primary"
          ? "bg-zinc-100 text-zinc-950 hover:bg-white"
          : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
      )}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

function CountControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1 shadow-sm backdrop-blur-xl">
      <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, value - 1))}
          className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Minus className="size-3" />
        </button>
        <span className="w-4 text-center text-xs font-medium text-zinc-100">{value}</span>
        <button
          onClick={() => onChange(Math.min(6, value + 1))}
          className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Plus className="size-3" />
        </button>
      </div>
    </div>
  );
}

function StatChip({ label }: { label: string }) {
  return null; // Deprecated in favor of minimalist design
}

function InfoBlock({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{body}</p>
    </section>
  );
}
