// The client's app settings. The brand and the app's name come from convex/lib/appConfig.ts, the
// one source for the server (emails, backups) and the client (page headers).
export { APP_NAME, BRAND } from "../convex/lib/appConfig"

// The optional voice module (README, "Optional: voice (LiveKit)"): the project pages show the
// voice card only when the build sets VITE_VOICE_ENABLED=true (in .env.local, .env.production).
// The Convex deployment also needs its LiveKit keys, and the agent worker must be running.
export const VOICE_ENABLED = import.meta.env.VITE_VOICE_ENABLED === "true"

// How long the voice card waits for the agent to join before it offers the typed fallback. An
// agent on LiveKit Cloud's free plan can take 10-20 s to start after it was idle.
export const VOICE_AGENT_JOIN_TIMEOUT_MS = 30_000
