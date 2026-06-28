import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../lib/auth.js";
import { mapSpeaker, mapTranscriptSegment } from "../lib/mappers.js";

const updateSegmentSchema = z.object({
  text: z.string().min(1).optional(),
  startMs: z.number().int().min(0).optional(),
  endMs: z.number().int().min(0).optional(),
  speakerId: z.string().uuid().nullable().optional(),
});

const updateSpeakerSchema = z.object({
  displayName: z.string().min(1).optional(),
});

export const transcriptRoutes = new Hono<{ Variables: AuthVariables }>()
  .patch("/:projectId/transcript/segments/:segmentId", async (c) => {
    const supabase = c.get("supabase");
    const projectId = c.req.param("projectId");
    const segmentId = c.req.param("segmentId");
    const body = updateSegmentSchema.parse(await c.req.json());

    const { data, error } = await supabase
      .from("transcript_segments")
      .update({
        text: body.text,
        start_ms: body.startMs,
        end_ms: body.endMs,
        speaker_id: body.speakerId,
      })
      .eq("id", segmentId)
      .eq("project_id", projectId)
      .select("*")
      .single();

    if (error || !data) {
      return c.json({ error: error?.message ?? "Segment not found" }, 404);
    }

    return c.json({ segment: mapTranscriptSegment(data) });
  })
  .patch("/:projectId/speakers/:speakerId", async (c) => {
    const supabase = c.get("supabase");
    const projectId = c.req.param("projectId");
    const speakerId = c.req.param("speakerId");
    const body = updateSpeakerSchema.parse(await c.req.json());

    const { data, error } = await supabase
      .from("speakers")
      .update({ display_name: body.displayName })
      .eq("id", speakerId)
      .eq("project_id", projectId)
      .select("*")
      .single();

    if (error || !data) {
      return c.json({ error: error?.message ?? "Speaker not found" }, 404);
    }

    return c.json({ speaker: mapSpeaker(data) });
  });
