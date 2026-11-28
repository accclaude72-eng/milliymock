import "server-only";
import { z } from "zod";

export const VideoInput = z.object({
  subjectCode: z.string().regex(/^[a-z0-9-]{1,40}$/),
  topic: z.string().trim().max(120).nullable().default(null),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).nullable().default(null),
  url: z.string().trim().min(5).max(300),
  durationMin: z.number().min(0).max(600).nullable().default(null),
  position: z.number().int().min(0).max(10000).default(0),
});
