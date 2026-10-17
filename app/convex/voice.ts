import { v } from "convex/values"
import { internalMutation } from "./_generated/server"
import { projectMutation } from "./lib/functions"
import { agentEventValidator, cleanTypedMessage, TranscriptSource, VoiceRole } from "./lib/voice"
import { recordAgentEvent } from "./lib/voiceData"

// The voice module's transcript: what the agent sends (through convex/http.ts), and the message
// a user types when voice doesn't work. convex/livekit.ts starts the sessions.

// The fallback when the microphone is blocked or the agent doesn't join: the owner or a guest
// leaves a typed message on the project instead.
export const saveTypedMessage = projectMutation({
  args: {
    projectId: v.id("projects"),
    text: v.string(),
  },
  returns: v.id("voiceTranscripts"),
  handler: async (ctx, args) => {
    const { project } = await ctx.access.requireProject(args.projectId)

    return await ctx.db.insert("voiceTranscripts", {
      ownerId: project.ownerId,
      projectId: project._id,
      role: VoiceRole.User,
      text: cleanTypedMessage(args.text),
      at: Date.now(),
      source: TranscriptSource.Typed,
    })
  },
})

// For the HTTP action only, which has checked the agent's secret.
export const recordEvent = internalMutation({
  args: {
    event: agentEventValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => await recordAgentEvent(ctx, args.event),
})
