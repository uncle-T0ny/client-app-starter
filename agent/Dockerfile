# The voice worker as a container, for your own server (README, "Optional: voice (LiveKit)").
#   docker build -t voice-agent .
#   docker run -d --name voice-agent --env-file .env.production --restart unless-stopped voice-agent
# The worker only makes outbound connections (LiveKit, OpenRouter, Convex): publish no ports.
FROM node:24-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Node runs the TypeScript sources directly (type stripping), so there is no build step.
COPY src ./src

# The plugins' model files are fetched now, at build time, not on the first session.
RUN npx livekit-agents download-files

USER node
CMD ["node", "src/main.ts", "start"]
