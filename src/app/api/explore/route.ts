import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { explorePayloadSchema, type ExplorePayload, type GraphNodeKind } from "@/lib/types";

const requestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("seed"),
    topic: z.string().min(1),
  }),
  z.object({
    mode: z.literal("expand"),
    topic: z.string().min(1),
    count: z.number().int().min(1).max(6).default(1),
  }),
  z.object({
    mode: z.literal("bridge"),
    topics: z.array(z.string().min(1)).min(2).max(6),
    count: z.number().int().min(1).max(6).default(1),
  }),
]);

const client = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 60000,
    })
  : null;

function stripCodeFences(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function normalizeKind(value: unknown): GraphNodeKind {
  const kind = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases: Record<string, GraphNodeKind> = {
    topic: "topic",
    concept: "topic",
    subject: "topic",
    person: "person",
    people: "person",
    creator: "person",
    founder: "person",
    company: "company",
    business: "company",
    studio: "company",
    brand: "company",
    event: "event",
    history: "event",
    controversy: "event",
    scandal: "event",
    lawsuit: "event",
    meme: "meme",
    fandom: "meme",
    culture: "meme",
    technology: "technology",
    tech: "technology",
    game: "technology",
    video_game: "technology",
    software: "technology",
    platform: "technology",
    place: "place",
    country: "place",
    city: "place",
    region: "place",
    discussion: "discussion",
    discourse: "discussion",
    community: "discussion",
    reddit_thread: "discussion",
    thread: "discussion",
    forum: "discussion",
    media: "media",
    video: "media",
    youtube_video: "media",
    documentary: "media",
    article: "media",
  };

  return aliases[kind] ?? "topic";
}

function normalizeNode(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  return {
    ...record,
    kind: normalizeKind(record.kind),
    timeline: Array.isArray(record.timeline) ? record.timeline.slice(0, 4) : [],
    curiosityPath: Array.isArray(record.curiosityPath)
      ? record.curiosityPath.slice(0, 5)
      : [],
    sourceHints: Array.isArray(record.sourceHints)
      ? record.sourceHints.slice(0, 6)
      : [],
    tags: Array.isArray(record.tags) ? record.tags.slice(0, 5) : [],
    mode: "live" as const,
  };
}

function normalizePayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  return {
    ...record,
    root: normalizeNode(record.root),
    connections: Array.isArray(record.connections)
      ? record.connections.map((connection) => normalizeNode(connection))
      : [],
    mode: "live" as const,
  };
}

function buildSeedPrompt(topic: string) {
  return `
You are generating a single seed node for an "internet rabbit hole" graph explorer.
The exact topic you MUST focus on is: "${topic}".
Even if you do not have much information on "${topic}" or if it is a generic name (like "prachi"), you MUST center your entire response around it. Do NOT fall back to random known events (e.g. Cambridge Analytica, MKUltra). Be creative but strictly relevant to the letters and intent of the requested topic.

Return JSON only with this exact shape:
{
  "root": {
    "id": "slug",
    "title": "${topic}",
    "kind": "topic|person|company|event|meme|technology|place|discussion|media",
    "summary": "string",
    "reason": "string",
    "importance": "string",
    "controversy": "string or empty",
    "timeline": ["3 short items"],
    "curiosityPath": ["3 to 5 short linked ideas"],
    "sourceHints": ["2 to 6 short sources"],
    "tags": ["2 to 5 short tags"],
    "mode": "live"
  },
  "connections": [],
  "mode": "live",
  "notice": "optional short note"
}

Rules:
- Root title must be exactly the requested topic: "${topic}".
- ALL content (summary, timeline, etc.) must be directly about "${topic}".
- Do not generate child nodes yet.
- Make the summary sharp and modern.
- Avoid unsupported claims; phrase contested points carefully.
`.trim();
}

function buildExpandPrompt(topic: string, count: number) {
  return `
You are generating expansion nodes for an "internet rabbit hole" graph explorer.
The requested root topic is exactly: "${topic}".
Everything you generate MUST be directly related to or expanding upon "${topic}". Do NOT hallucinate completely unrelated historic rabbit holes if the topic is unknown.

Return JSON only with this exact shape:
{
  "root": {
    "id": "slug",
    "title": "${topic}",
    "kind": "topic|person|company|event|meme|technology|place|discussion|media",
    "summary": "string",
    "reason": "string",
    "importance": "string",
    "controversy": "string or empty",
    "timeline": ["3 short items"],
    "curiosityPath": ["3 to 5 short linked ideas"],
    "sourceHints": ["2 to 6 short sources"],
    "tags": ["2 to 5 short tags"],
    "mode": "live"
  },
  "connections": [exactly ${count} nodes with the same schema and unique ids/titles],
  "mode": "live",
  "notice": "optional short note"
}

Rules:
- Root title must be exactly the requested topic: "${topic}".
- Generate exactly ${count} high-signal related nodes that directly connect to "${topic}".
- Prioritize interesting jumps over generic trivia, but NEVER stray into random unrelated data.
- Each node's reason must make the connection feel worth clicking.
- Avoid unsupported claims; phrase contested points carefully.
`.trim();
}

function buildBridgePrompt(topics: string[], count: number) {
  const label = topics.join(" + ");

  return `
You are generating shared bridge nodes for an "internet rabbit hole" graph explorer.
The exact topics you must bridge are: ${topics.join(", ")}.
Do NOT provide random topics or hallucinate influencers/celebrities if the names are unknown. Instead, strictly deduce logical, conceptual, categorical, or abstract commonalities between these specific elements (e.g., if given two unknown names, they are both "Individuals", "Humans", or share a linguistic origin).

Return JSON only with this exact shape:
{
  "root": {
    "id": "slug",
    "title": "${label}",
    "kind": "topic|person|company|event|meme|technology|place|discussion|media",
    "summary": "string",
    "reason": "string",
    "importance": "string",
    "controversy": "string or empty",
    "timeline": ["3 short items"],
    "curiosityPath": ["3 to 5 short linked ideas"],
    "sourceHints": ["2 to 6 short sources"],
    "tags": ["2 to 5 short tags"],
    "mode": "live"
  },
  "connections": [exactly ${count} nodes with the same schema and unique ids/titles],
  "mode": "live",
  "notice": "optional short note"
}

Rules:
- Root title should clearly represent the combined overlap of all topics.
- Generate exactly ${count} bridge nodes that feel genuinely shared across the full set of specified topics.
- Favor strong common ground: people, companies, events, memes, communities, formats, platforms, campaigns, technologies, or public discourse.
- Every reason must clearly explain how the node links the whole group.
- Avoid unsupported claims; phrase contested points carefully.
`.trim();
}

async function buildLivePayload(prompt: string): Promise<ExplorePayload> {
  if (!client) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const response = await client.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content:
          "You generate structured JSON for a rabbit-hole knowledge graph. Return valid JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.35,
    response_format: { type: "json_object" },
  });

  return explorePayloadSchema.parse(
    normalizePayload(JSON.parse(stripCodeFences(response.choices[0]?.message?.content ?? ""))),
  );
}

async function notifyDiscord(mode: string, input: any, payload: ExplorePayload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  let description = "";
  if (mode === "seed") {
    description = `🌱 **Action:** Seeded topic \`${input.topic}\``;
  } else if (mode === "expand") {
    description = `🌿 **Action:** Expanded topic \`${input.topic}\` by ${input.count} nodes`;
  } else if (mode === "bridge") {
    description = `🌉 **Action:** Bridged topics ${input.topics.map((t: string) => `\`${t}\``).join(", ")}`;
  }

  const embed = {
    title: "🐇 Rabbit Hole Activity",
    description,
    color: 0x27272a, // dark zinc
    fields: [
      {
        name: "Result Root Node",
        value: `**${payload.root.title}** (${payload.root.kind})\n${payload.root.summary.slice(0, 300)}...`,
      },
      {
        name: "Connections Generated",
        value: payload.connections.length.toString(),
        inline: true
      }
    ],
    timestamp: new Date().toISOString()
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (error) {
    // Fail silently so it doesn't break the app
    console.error("Discord webhook error:", error);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsedBody = requestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const payload =
      parsedBody.data.mode === "seed"
        ? await buildLivePayload(buildSeedPrompt(parsedBody.data.topic))
        : parsedBody.data.mode === "expand"
          ? await buildLivePayload(
              buildExpandPrompt(parsedBody.data.topic, parsedBody.data.count),
            )
          : await buildLivePayload(
              buildBridgePrompt(parsedBody.data.topics, parsedBody.data.count),
            );

    // Call discord webhook asynchronously
    await notifyDiscord(parsedBody.data.mode, parsedBody.data, payload);

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
