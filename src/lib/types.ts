import { z } from "zod";

export const graphNodeKinds = [
  "topic",
  "person",
  "company",
  "event",
  "meme",
  "technology",
  "place",
  "discussion",
  "media",
] as const;

export type GraphNodeKind = (typeof graphNodeKinds)[number];

export const nodeInsightSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(graphNodeKinds),
  summary: z.string(),
  reason: z.string(),
  importance: z.string(),
  controversy: z.string().optional().default(""),
  timeline: z.array(z.string()).min(3).max(4),
  curiosityPath: z.array(z.string()).min(3).max(5),
  sourceHints: z.array(z.string()).min(2).max(6),
  tags: z.array(z.string()).min(2).max(5),
  mode: z.literal("live"),
  notice: z.string().optional(),
});

export const explorePayloadSchema = z.object({
  root: nodeInsightSchema,
  connections: z.array(nodeInsightSchema).min(0).max(8),
  mode: z.literal("live"),
  notice: z.string().optional(),
});

export type NodeInsight = z.infer<typeof nodeInsightSchema>;
export type ExplorePayload = z.infer<typeof explorePayloadSchema>;
