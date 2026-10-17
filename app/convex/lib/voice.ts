import { ConvexError, v, type Infer } from "convex/values"

// The optional voice module (README, "Optional: voice (LiveKit)"): its tables' fields, the
// events the agent worker POSTs (agent/src/transcript.ts has the same shapes), and the pure
// rules convex/livekit.ts, convex/voice.ts and convex/http.ts share.

// The worker's name; agent/src/main.ts registers under the same one. The token dispatches it.
export const VOICE_AGENT_NAME = "voice-assistant"

// Where the agent POSTs its events (convex/http.ts).
export const AGENT_EVENTS_PATH = "/voice/agent-events"

// Sessions a deployment may start per UTC day when VOICE_SESSIONS_PER_DAY is unset.
export const DEFAULT_SESSIONS_PER_DAY = 20

// The longest turn text and the most turns one event may carry; the agent keeps the same limits.
export const MAX_TURN_LENGTH = 4000
export const MAX_TURNS = 500

export const VOICE_NOT_SET_UP = "Voice isn't set up on this deployment yet."
export const VOICE_CAP_REACHED =
  "Today's voice sessions are used up. They start again at 00:00 UTC."

export enum VoiceRole {
  User = "user",
  Assistant = "assistant",
}

export enum TranscriptSource {
  // Spoken in a session; the agent sent it.
  Voice = "voice",
  // Typed in the fallback form when voice didn't work.
  Typed = "typed",
}

export const voiceRoleValidator = v.union(v.literal(VoiceRole.User), v.literal(VoiceRole.Assistant))

export const transcriptSourceValidator = v.union(
  v.literal(TranscriptSource.Voice),
  v.literal(TranscriptSource.Typed),
)

// One voice session: a LiveKit room the app minted a token for.
export const voiceSessionFields = {
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  roomName: v.string(),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  endReason: v.optional(v.string()),
}

// One turn of a session's transcript, or a message typed in the fallback form (no session).
export const voiceTranscriptFields = {
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  sessionId: v.optional(v.id("voiceSessions")),
  // The turn's place in its session, from 0; a typed message has none.
  index: v.optional(v.number()),
  role: voiceRoleValidator,
  text: v.string(),
  at: v.number(),
  source: transcriptSourceValidator,
}

// The sessions started on one UTC day, for the daily cap.
export const voiceUsageFields = {
  day: v.string(),
  sessions: v.number(),
}

export const turnValidator = v.object({
  index: v.number(),
  role: voiceRoleValidator,
  text: v.string(),
  at: v.number(),
})

export const agentEventValidator = v.union(
  v.object({
    type: v.literal("turn"),
    roomName: v.string(),
    index: v.number(),
    role: voiceRoleValidator,
    text: v.string(),
    at: v.number(),
  }),
  v.object({
    type: v.literal("end"),
    roomName: v.string(),
    reason: v.string(),
    at: v.number(),
    turns: v.array(turnValidator),
  }),
)

// What startSession gives the browser to join the room.
export const voiceConnectionValidator = v.object({
  serverUrl: v.string(),
  participantToken: v.string(),
  roomName: v.string(),
  sessionId: v.id("voiceSessions"),
})

export type Turn = Infer<typeof turnValidator>
export type AgentEvent = Infer<typeof agentEventValidator>
export type VoiceConnection = Infer<typeof voiceConnectionValidator>

export interface LiveKitKeys {
  url: string
  apiKey: string
  apiSecret: string
}

type Env = Readonly<Record<string, string | undefined>>

// The deployment's LiveKit project, or a sentence for the user when it isn't set.
export function liveKitKeys(env: Env): LiveKitKeys {
  const url = env.LIVEKIT_URL?.trim() ?? ""
  const apiKey = env.LIVEKIT_API_KEY?.trim() ?? ""
  const apiSecret = env.LIVEKIT_API_SECRET?.trim() ?? ""

  if (url.length === 0 || apiKey.length === 0 || apiSecret.length === 0) {
    throw new ConvexError(VOICE_NOT_SET_UP)
  }

  return { url, apiKey, apiSecret }
}

// VOICE_SESSIONS_PER_DAY: a whole number, 0 turns voice off; unset means the default.
export function sessionsPerDay(raw: string | undefined): number {
  const value = raw?.trim() ?? ""

  if (value.length === 0) {
    return DEFAULT_SESSIONS_PER_DAY
  }

  const cap = Number(value)

  if (!Number.isInteger(cap) || cap < 0) {
    throw new ConvexError("VOICE_SESSIONS_PER_DAY must be a whole number.")
  }

  return cap
}

// The UTC day a moment falls on, as 2026-10-17: the daily cap's key.
export function usageDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

export function cleanTurnText(text: string): string {
  return text.trim().slice(0, MAX_TURN_LENGTH)
}

export function cleanTypedMessage(text: string): string {
  const cleaned = text.trim()

  if (cleaned.length === 0) {
    throw new ConvexError("Write a message first.")
  }

  if (cleaned.length > MAX_TURN_LENGTH) {
    throw new ConvexError(`Keep the message under ${MAX_TURN_LENGTH} characters.`)
  }

  return cleaned
}

// The secret from an "Authorization: Bearer <secret>" header, or null.
export function bearerSecret(header: string | null): string | null {
  const match = header === null ? null : /^Bearer\s+(\S+)\s*$/.exec(header)

  return match?.[1] ?? null
}

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))
}

// Compares in constant time: both sides are hashed to 32 bytes first, so neither the length nor
// the first differing byte shows in the timing. The default runtime has no timingSafeEqual.
export async function secretsMatch(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)])
  let difference = 0

  for (let i = 0; i < a.length; i += 1) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }

  return difference === 0
}

// Whether a request carries the agent's secret. An unset VOICE_AGENT_SECRET lets nobody in.
export async function isAgentRequest(
  authorization: string | null,
  expected: string | undefined,
): Promise<boolean> {
  const secret = expected?.trim() ?? ""
  const given = bearerSecret(authorization)

  if (secret.length === 0 || given === null) {
    return false
  }

  return await secretsMatch(given, secret)
}
