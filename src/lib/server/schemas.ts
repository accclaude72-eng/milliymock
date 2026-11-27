import "server-only";
import { z } from "zod";

const letter = z.enum(["A", "B", "C", "D", "E", "F", "G", "H"]);
const topic = z.string().trim().max(200).optional();

export const KeyItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Y1"), correct: letter, topic }),
  z.object({
    type: z.literal("Y2"),
    left: z.number().int().min(1).max(10),
    right: z.number().int().min(2).max(8),
    pairs: z.array(z.union([letter, z.literal("")])).max(10),
    topic,
  }),
  z.object({
    type: z.literal("O1"),
    accepted: z.array(z.string().trim().max(200)).max(20),
    tolerance: z.number().min(0).max(1e9).nullable().optional(),
    caseSensitive: z.boolean().optional(),
    unit: z.string().trim().max(30).optional(),
    topic,
  }),
  z.object({
    type: z.literal("O"),
    accepted: z.array(z.string().trim().max(200)).max(20),
    tolerance: z.number().min(0).max(1e9).nullable().optional(),
    caseSensitive: z.boolean().optional(),
    unit: z.string().trim().max(30).optional(),
    topic,
  }),
  z.object({
    type: z.literal("O2"),
    criteria: z
      .array(
        z.object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
          label: z.string().trim().max(200), // empty allowed in drafts; validateKey blocks publishing
          component: z.enum(["M", "A"]),
          max: z.number().min(0).max(100),
        }),
      )
      .max(30),
    topic,
  }),
]);

export const KeySchema = z.record(z.string().regex(/^\d{1,3}$/), KeyItemSchema);

export const StructureSchema = z.object({
  y1Options: z.number().int().min(2).max(8),
  y1ByTask: z.record(z.string().regex(/^\d{1,3}$/), z.number().int().min(2).max(8)).optional(),
  y2: z.record(z.string().regex(/^\d{1,3}$/), z.object({ left: z.number().int().min(1).max(10), right: z.number().int().min(2).max(8) })),
});

/** Editable at any time. Mode, range and timing are fixed at creation (they shape the answer sheet). */
export const MaterialMetaSchema = z.object({
  title: z.string().trim().min(3, "kamida 3 ta belgi").max(160),
  description: z.string().trim().max(1000).default(""),
  revealAnswers: z.boolean(),
  attemptLimit: z.number().int().min(1).max(50).nullable(),
});

export const MaterialCreateSchema = MaterialMetaSchema.extend({
  mode: z.enum(["full", "practice", "diagnostic"]),
  timed: z.boolean(),
  range: z.object({ from: z.number().int().min(1).max(200), to: z.number().int().min(1).max(200) }).nullable().default(null),
  minutes: z.number().int().min(1).max(600).nullable().default(null),
});

export const HtmlUploadSchema = z.object({
  path: z
    .string()
    .regex(/^materials\/[a-zA-Z0-9_-]{8,64}\/[a-zA-Z0-9_.-]{1,120}\.html$/, "fayl manzili noto‘g‘ri"),
  fileName: z.string().trim().min(1).max(200),
  inlinedImages: z.number().int().min(0).max(10_000),
  warnings: z.array(z.string().max(300)).max(50),
});
