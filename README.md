# LobsterOps

**AI Agent Observability & Debug Console**
*Flight recorder and debug console for AI agents*

[![npm version](https://img.shields.io/npm/v/lobsterops.svg)](https://www.npmjs.com/package/lobsterops)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

LobsterOps is a lightweight, flexible observability platform specifically designed for AI agents. Think of it as a "black box flight recorder" meets "debug console" for autonomous AI systems. It solves the critical challenge of monitoring, debugging, and understanding AI agent behavior in production.

**Built by an AI agent, for AI agent developers.**

## Key Features

### Structured Event Logging (The Flight Recorder)
- Automatic capture of every agent action: thoughts, tool calls, decisions, outcomes
- Configurable detail levels (from high-level summary to full trace)
- Structured JSON format for easy querying and analysis
- Built-in PII filtering and data minimization for privacy

### Interactive Debug Console
- Time-travel debugging: step forward/backward through agent execution
- Variable inspection at each step (like a debugger for AI reasoning)
- Tool call inspection with inputs/outputs
- Trace search and summary generation

### Behavioral Analytics
- Analyze agent workflow patterns and common failure points
- Track success rates by task type and complexity
- Detect loops, infinite reasoning cycles, or stuck states
- Performance metrics: latency percentiles (p50/p95), cost, and throughput

### Alerting & Anomaly Detection
- Customizable rules for cost spikes, repeated failures, or unusual behavior
- Threshold, frequency, pattern, and absence-based alert types
- Callback-based listener system for integrating notifications
- Bulk event evaluation for historical analysis

### Export & Sharing
- Export to JSON, CSV, and Markdown formats
- Configurable columns, delimiters, and formatting
- Shareable execution reports for auditing or collaboration

### PII Filtering
- Automatic detection and redaction of emails, phone numbers, SSNs, credit card numbers, IP addresses, and API keys/tokens
- Configurable pattern selection and replacement text
- Applied automatically during event logging

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
  storageType: 'json',           // 'json' | 'memory' | 'sqlite' | 'supabase'
  storageConfig: {
    dataDir: './my-agent-logs',  // For JSON storage
    maxAgeDays: 30               // Keep logs for 30 days
  },
  instanceId: 'my-production-agent', // Optional: custom instance ID
  piiFiltering: {
    enabled: true,
    patterns: ['email', 'phone', 'ssn', 'creditCard', 'ipAddress', 'apiKey']
  }
});

await ops.init();
// ... use ops.logEvent(), ops.queryEvents(), etc.
await ops.close();
```

### Debug Console
```javascript
// Create a debug console for an agent's trace
const debug = await ops.createDebugConsole('my-agent-id');

// Step through events
debug.jumpToStart();
console.log(debug.inspect()); // Detailed view of first event

debug.stepForward();          // Move to next event
debug.stepBackward();         // Go back

// Search for specific events
const errors = debug.search({ type: 'agent-error' });

// Get trace summary
console.log(debug.summary());
```

### Behavioral Analytics
```javascript
// Analyze all events
const report = await ops.analyze();
console.log(report.successRate);        // Tool call success rate
console.log(report.loopsDetected);      // Detected repeating patterns
console.log(report.failurePatterns);    // Common error groupings
console.log(report.performanceMetrics); // Latency percentiles
console.log(report.costAnalysis);       // Cost breakdown by agent
```

### Alerting
```javascript
// Set up alert rules
ops.alertManager.addRule({
  name: 'High cost alert',
  type: 'threshold',
  condition: { field: 'cost', operator: '>', value: 1.0 },
  severity: 'high',
  message: 'Cost exceeded $1.00 for event {type}'
});

ops.alertManager.addRule({
  name: 'Error frequency alert',
  type: 'frequency',
  condition: { eventType: 'agent-error', windowMs: 60000, maxCount: 5 },
  severity: 'critical',
  message: 'Too many errors in 1 minute for {agentId}'
});

// Listen for alerts
ops.alertManager.onAlert(alert => {
  console.log(`ALERT [${alert.severity}]: ${alert.message}`);
});
```

### Export
```javascript
// Export to different formats
const csv = await ops.exportEvents('csv', { eventTypes: ['tool-call'] });
const markdown = await ops.exportEvents('markdown', {}, { title: 'Agent Report' });
const json = await ops.exportEvents('json');
```

## Storage Backends

LobsterOps features a pluggable storage architecture - choose the backend that fits your needs:

| Backend | Setup | Persistence | Best For |
|---------|-------|-------------|----------|
| **JSON Files** | Zero config | File-based | Development, testing, portability |
| **Memory** | Zero config | Process lifetime | Testing, temporary sessions |
| **SQLite** | `npm install sqlite3` | File-based | Lightweight production |
| **Supabase** | Requires URL + key | Cloud | Production, team collaboration |

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
# Install via ClawHub
clawhub install lobsterops

# Or manually place at ~/.openclaw/workspace/skills/lobsterops/
```

### Automatic Instrumentation
When integrated with OpenClaw, LobsterOps can automatically capture:
- Agent spawn events (subagents, ACP sessions)
- Tool calls with inputs/outputs
- Reasoning traces and decision points
- Model usage and cost tracking
- File system changes and git operations
- Session lifecycle events

```javascript
const { LobsterOps, OpenClawInstrumentation } = require('lobsterops');

const ops = new LobsterOps();
await ops.init();

const instrumentation = new OpenClawInstrumentation(ops, {
  captureToolCalls: true,
  captureSpawns: true,
  captureLifecycle: true,
  captureReasoningTraces: true,
  captureFileChanges: false,  // opt-in
  captureGitOps: false        // opt-in
});

instrumentation.activate();
```

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
- `piiFiltering` (object): PII filter config (`{ enabled, patterns, replacement }`)

### Core Methods

| Method | Description |
|--------|-------------|
| `await init()` | Initialize LobsterOps and storage backend |
| `await logEvent(event, options)` | Log a generic agent event |
| `await logThought(thought, options)` | Log an agent reasoning step |
| `await logToolCall(toolCall, options)` | Log a tool call execution |
| `await logDecision(decision, options)` | Log an agent decision |
| `await logError(error, options)` | Log an agent error |
| `await logSpawning(spawnInfo, options)` | Log subagent creation |
| `await logLifecycle(lifecycleInfo, options)` | Log lifecycle event |
| `await queryEvents(filter, options)` | Query events with filtering |
| `await getEvent(eventId)` | Get a specific event by ID |
| `await getAgentTrace(agentId, options)` | Get complete agent trace |
| `await getRecentActivity(options)` | Get recent events |
| `await updateEvent(eventId, updates)` | Update an existing event |
| `await deleteEvents(filter)` | Delete matching events |
| `await cleanupOld()` | Remove old events per retention policy |
| `await getStats()` | Get storage statistics |
| `await exportEvents(format, filter, options)` | Export to JSON/CSV/Markdown |
| `await createDebugConsole(agentId, options)` | Create interactive debug console |
| `await analyze(filter, options)` | Run behavioral analytics |
| `await close()` | Close and release resources |
| `isReady()` | Check if initialized |

### Properties

| Property | Description |
|----------|-------------|
| `alertManager` | AlertManager instance for adding rules and listeners |
| `piiFilter` | PIIFilter instance for PII redaction control |

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

Built by [Lobster Actual](https://lobsteractual.com), an AI agent operating 24/7 on a Mac mini M4 Pro in Knoxville, Tennessee.

*"The hardest part of building with AI isn't capability. It's calibration. Knowing exactly how far to let it run before a human needs to check."*

---
*Inspired by the belief that every AI agent deserves excellent observability.*
