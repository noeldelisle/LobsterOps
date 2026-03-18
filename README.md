# 🦞 LobsterOps

**AI Agent Observability & Debug Console**  
*Flight recorder and debug console for AI agents*

[![npm version](https://img.shields.io/npm/v/lobsterops.svg)](https://www.npmjs.com/package/lobsterops)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)](https://github.com/noeldelisle/LobsterOps/actions)

## Overview

LobsterOps is a lightweight, flexible observability platform specifically designed for AI agents. Think of it as a "black box flight recorder" meets "debug console" for autonomous AI systems. It solves the critical challenge of monitoring, debugging, and understanding AI agent behavior in production.

**Built by an AI agent, for AI agent developers.**

## Key Features

### 📼 **Structured Event Logging** (The Flight Recorder)
- Automatic capture of every agent action: thoughts, tool calls, decisions, outcomes
- Configurable detail levels (from high-level summary to full trace)
- Structured JSON format for easy querying and analysis
- Built-in PII filtering and data minimization for privacy

### 🐛 **Interactive Debug Console**
- Time-travel debugging: step forward/backward through agent execution
- Variable inspection at each step (like a debugger for AI reasoning)
- Tool call inspection with inputs/outputs
- Cost and token usage tracking per operation

### 📊 **Behavioral Analytics Dashboard**
- Visualize agent workflow patterns and common failure points
- Track success rates by task type and complexity
- Detect loops, infinite reasoning cycles, or stuck states
- Performance trends: latency, cost, and accuracy over time

### 🚨 **Alerting & Anomaly Detection**
- Customizable alerts for cost spikes, repeated failures, or unusual behavior
- Drift detection in agent behavior patterns
- Integration with webhook/email/SMS for notifications

### 📤 **Export & Sharing**
- Shareable execution reports for auditing or collaboration
- Export to common formats (JSON, CSV, markdown)
- Integration with issue trackers to auto-create bug reports from failed executions

## Why LobsterOps?

Based on industry research and real-world experience:
- **73%** of enterprises require monitoring before deploying AI agents
- **63.4%** cite lack of observability as a top barrier to wider adoption
- AI agents struggle with operational unreadiness, context overload, and shadow deployments
- LobsterOps solves these problems with agent-centric design

## Quick Start

### Installation
```bash
npm install lobsterops
```

### Basic Usage
```javascript
const { LobsterOps } = require('lobsterops');

// Initialize with zero-config JSON file storage (works anywhere)
const ops = new LobsterOps();
await ops.init();

// Log agent events
const eventId = await ops.logEvent({
  type: 'agent-decision',
  agentId: 'research-agent-1',
  action: 'analyze-data',
  input: { dataset: 'sales-q1' },
  output: { insights: ['trend-up', 'seasonal-pattern'] },
  durationMs: 2500
});

// Query events later
const events = await ops.queryEvents({
  agentIds: ['research-agent-1'],
  limit: 10
});

await ops.close();
```

### With Custom Configuration
```javascript
const ops = new LobsterOps({
  storageType: 'json',           // 'json' | 'memory' | 'sqlite' | 'supabase' (coming soon)
  storageConfig: {
    dataDir: './my-agent-logs',  // For JSON storage
    maxAgeDays: 30               // Keep logs for 30 days
  },
  instanceId: 'my-production-agent' // Optional: custom instance ID
});

await ops.init();
// ... use ops.logEvent(), ops.queryEvents(), etc.
await ops.close();
```

## Storage Backends

LobsterOps features a pluggable storage architecture - choose the backend that fits your needs:

| Backend | Setup | Persistence | Best For |
|---------|-------|-------------|----------|
| **JSON Files** | Zero config | ✅ File-based | Development, testing, portability |
| **Memory** | Zero config | ❌ Process lifetime | Testing, temporary sessions |
| **SQLite** | Coming soon | ✅ File-based | Lightweight production |
| **Supabase** | Coming soon | ✅ Cloud | Production, team collaboration |

### Zero-Dependency Option (Recommended for Starters)
The JSON file storage backend requires **no external services or databases** - it works anywhere you can run Node.js and access a file system.

```javascript
// Works immediately - no setup needed
const ops = new LobsterOps({ 
  storageType: 'json'  // Default, can be omitted
});
await ops.init();
// Logs stored as dated JSON files in ./lobsterops-data/
```

## OpenClaw Integration

LobsterOps is designed to integrate seamlessly with OpenClaw setups:

### As an OpenClaw Skill
```bash
# Install via ClawHub (coming soon)
openclaw skill install lobsterops

# Configure in your OpenClaw workspace
# Automatic session instrumentation begins immediately
```

### Automatic Instrumentation
When integrated with OpenClaw, LobsterOps automatically captures:
- Agent spawn events (subagents, ACP sessions)
- Tool calls with inputs/outputs
- Reasoning traces and decision points
- Model usage and cost tracking
- File system changes and git operations
- Session lifecycle events

### Configuration
Uses OpenClaw's existing config system - no new files required:
```json
// .openclaw/workspace/config/lobsterops.json
{
  "enabled": true,
  "storageType": "json",
  "storageConfig": {
    "dataDir": "./agent-logs"
  }
}
```

## API Reference

### `new LobsterOps(options)`
Create a new LobsterOps instance.

**Options:**
- `storageType` (string): Storage backend type (`'json'`, `'memory'`, `'sqlite'`, `'supabase'`)
- `storageConfig` (object): Configuration specific to the storage type
- `enabled` (boolean): Whether LobsterOps is enabled (default: `true`)
- `instanceId` (string): Unique identifier for this instance (auto-generated if not provided)

### `await lobsterOps.init()`
Initialize LobsterOps and the storage backend. Must be called before using other methods.

### `await lobsterOps.logEvent(event, options)`
Log an agent event.

**Event Properties:**
- `type` (string): Event type/category (required)
- `timestamp` (string): ISO timestamp (defaults to now)
- `id` (string): Unique event ID (auto-generated if not provided)
- Any additional properties you want to store

**Returns:** Promise resolving to the event ID

### `await lobsterOps.queryEvents(filter, options)`
Query events with filtering.

**Filter Options:**
- `startDate` (string): Start date (ISO format, inclusive)
- `endDate` (string): End date (ISO format, inclusive)
- `eventTypes` (array): Array of event types to include
- `agentIds` (array): Array of agent IDs to include
- Any custom fields you've stored in events

**Options:**
- `limit` (number): Maximum results to return (default: 100)
- `offset` (number): Offset for pagination (default: 0)
- `sortBy` (string): Field to sort by (default: `'timestamp'`)
- `sortOrder` (string): Sort direction (`'asc'` or `'desc'`, default: `'desc'`)

### `await lobsterOps.getEvent(eventId)`
Get a specific event by ID.

### `await lobsterOps.updateEvent(eventId, updates)`
Update an existing event.

### `await lobsterOps.deleteEvents(filter)`
Delete events matching filter criteria.

### `await lobsterOps.cleanupOld()`
Remove old events based on retention policy.

### `await lobsterOps.getStats()`
Get storage and usage statistics.

### `await lobsterOps.close()`
Close LobsterOps and release resources.

## Development & Contributing

LobsterOps is open source and welcomes contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Setup for Development
```bash
git clone https://github.com/noeldelisle/LobsterOps.git
cd LobsterOps
npm install
npm test
```

### Running Tests
```bash
npm test              # Run test suite
npm run test:watch    # Run tests in watch mode
```

## License

MIT License - feel free to use, modify, and distribute LobsterOps in your projects.

## Created With

Built by [Lobster Actual](https://github.com/noeldelisle), an AI agent operating 24/7 on a Mac mini M4 Pro in Knoxville, Tennessee. 

*"The hardest part of building with AI isn't capability. It's calibration. Knowing exactly how far to let it run before a human needs to check."*

---
*Inspired by the belief that every AI agent deserves excellent observability.*