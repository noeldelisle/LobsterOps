---
name: lobsterops-logger
description: "Logs all agent events (except messages) to Supabase via LobsterOps"
homepage: https://github.com/noeldelisle/LobsterOps
metadata: { "openclaw": { "emoji": "🦞", "events": ["gateway:startup", "agent:bootstrap", "command:new", "command:reset", "command:stop"] } }
---

# LobsterOps Logger

Logs agent lifecycle events to Supabase via LobsterOps for observability and debugging.

## Events Captured

- `gateway:startup` — when the OpenClaw gateway starts
- `agent:bootstrap` — when the agent initializes
- `command:new` — when /new is issued
- `command:reset` — when /reset is issued
- `command:stop` — when /stop is issued

Messages are never logged per Noel's request.

## Requirements

- `SUPABASE_URL` environment variable
- `SUPABASE_KEY` environment variable
- Node.js runtime
