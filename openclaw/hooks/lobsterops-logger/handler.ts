/**
 * LobsterOps Logger Hook - Comprehensive OpenClaw Event Capture
 *
 * Captures ALL OpenClaw event streams:
 * - Internal Hooks (gateway:startup, agent:bootstrap, message:received/sent/preprocessed, session:compact)
 * - Agent Events (lifecycle, thinking, assistant streams)
 * - Heartbeat Events (periodic health/activity pings)
 *
 * Writes to both agent_events (legacy) and agent_events_v2 (new schema).
 */

import { createClient } from '@supabase/supabase-js';
import { PIIFilter } from '../../../src/core/PIIFilter.js';

// ---------------------------------------------------------------------------
// Config & Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const INSTANCE_ID = process.env.INSTANCE_ID || 'lobster-ops';
const WRITE_TO_V2_TABLE = process.env.WRITE_TO_V2_TABLE !== 'false';

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;

// ---------------------------------------------------------------------------
// Supabase Client
// ---------------------------------------------------------------------------

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase && SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

// ---------------------------------------------------------------------------
// PII Filter
// ---------------------------------------------------------------------------

const piiFilter = new PIIFilter({ enabled: true });

function filterPII<T>(data: T): T {
  return piiFilter.filter(data) as T;
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function isCircuitOpen(): boolean {
  if (Date.now() < circuitOpenUntil) return true;
  if (circuitOpenUntil > 0) {
    // Cooldown ended, reset
    consecutiveFailures = 0;
    circuitOpenUntil = 0;
  }
  return false;
}

function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.error(`[lobsterops-logger] Circuit breaker OPEN — skipping writes for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s`);
  }
}

function recordSuccess(): void {
  consecutiveFailures = 0;
}

// ---------------------------------------------------------------------------
// Event Shapes
// ---------------------------------------------------------------------------

interface InternalHookEvent {
  type: string;
  action: string;
  sessionKey?: string;
  context?: Record<string, unknown>;
  timestamp?: Date;
  messages?: unknown[];
}

interface AgentEventPayload {
  runId: string;
  seq: number;
  stream: string;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
}

interface HeartbeatEventPayload {
  ts: number;
  status: string;
  to?: string;
  accountId?: string;
  preview?: string;
  durationMs?: number;
  hasMedia?: boolean;
  reason?: string;
  channel?: string;
  silent?: boolean;
  indicatorType?: string;
}

// ---------------------------------------------------------------------------
// In-Memory Stream Aggregation
// ---------------------------------------------------------------------------

interface LifecycleStartRecord {
  runId: string;
  sessionKey?: string;
  model?: string;
  agentId?: string;
  startedAt: number;
  data: Record<string, unknown>;
}

interface StreamAccumulator {
  runId: string;
  sessionKey?: string;
  content: string;
  startedAt: number;
  model?: string;
  agentId?: string;
}

// Map: runId → LifecycleStartRecord
const lifecycleStarts = new Map<string, LifecycleStartRecord>();

// Map: runId → StreamAccumulator (for thinking or assistant)
const thinkingStreams = new Map<string, StreamAccumulator>();
const assistantStreams = new Map<string, StreamAccumulator>();

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

function nowISO(): string {
  return new Date().toISOString();
}

function previewText(content: unknown, maxLen = 200): string {
  const str = typeof content === 'string' ? content : JSON.stringify(content ?? '');
  return str.slice(0, maxLen);
}

function previewMessage(content: unknown, maxLen = 500): string {
  return previewText(content, maxLen);
}

// ---------------------------------------------------------------------------
// Supabase Write Helpers
// ---------------------------------------------------------------------------

async function writeToSupabase(
  table: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (isCircuitOpen()) return;

  const client = getSupabaseClient();
  if (!client) {
    console.warn('[lobsterops-logger] No Supabase client — skipping write');
    return;
  }

  try {
    const { error } = await client.from(table).insert([payload]);
    if (error) throw error;
    recordSuccess();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[lobsterops-logger] Supabase write error (${table}): ${msg}`);
    recordFailure();
  }
}

// ---------------------------------------------------------------------------
// Legacy payload (agent_events table)
// ---------------------------------------------------------------------------

function buildLegacyPayload(
  type: string,
  action: string,
  data: Record<string, unknown>,
  agentId = 'lobster-actual',
  sessionKey?: string
) {
  return {
    type,
    agentId,
    action,
    timestamp: nowISO(),
    storedAt: nowISO(),
    data: filterPII({
      sessionKey: sessionKey || null,
      ...data,
    }),
  };
}

// ---------------------------------------------------------------------------
// V2 payload (agent_events_v2 table)
// ---------------------------------------------------------------------------

function buildV2Payload(
  type: string,
  action: string,
  agentId: string,
  sessionKey: string | undefined,
  runId: string,
  data: Record<string, unknown>,
  extra: Partial<{
    duration_ms: number;
    content_preview: string;
    model: string;
    cost_usd: number;
  }> = {}
) {
  return {
    type,
    action,
    agentId: agentId || 'gateway',
    sessionKey: sessionKey || '',
    runId: runId || '',
    timestamp: nowISO(),
    data: filterPII(data),
    duration_ms: extra.duration_ms ?? null,
    content_preview: extra.content_preview ?? null,
    model: extra.model ?? null,
    cost_usd: extra.cost_usd ?? null,
  };
}

// ---------------------------------------------------------------------------
// Handlers — Internal Hook Events
// ---------------------------------------------------------------------------

async function handleGatewayStartup(event: InternalHookEvent): Promise<void> {
  const ctx = event.context ?? {};
  const data = {
    version: (ctx as Record<string, unknown>).version ?? null,
    environment: (ctx as Record<string, unknown>).environment ?? null,
    instanceId: INSTANCE_ID,
  };

  await writeToSupabase('agent_events', buildLegacyPayload('gateway', 'startup', data));
  await writeToSupabase('agent_events_v2', buildV2Payload('gateway', 'startup', 'gateway', event.sessionKey, '', data));
}

async function handleAgentBootstrap(event: InternalHookEvent): Promise<void> {
  const ctx = event.context as Record<string, unknown> | undefined;
  const data = {
    workspaceDir: ctx?.workspaceDir ?? null,
    bootstrapFiles: Array.isArray(ctx?.bootstrapFiles) ? ctx.bootstrapFiles : [],
    model: ctx?.model ?? null,
  };

  await writeToSupabase('agent_events', buildLegacyPayload('agent', 'bootstrap', data, 'lobster-actual', event.sessionKey));
  await writeToSupabase('agent_events_v2', buildV2Payload('agent', 'bootstrap', 'lobster-actual', event.sessionKey, '', data));
}

async function handleMessageReceived(event: InternalHookEvent): Promise<void> {
  const ctx = event.context as Record<string, unknown> | undefined;
  const content = (ctx?.content as string) || '';
  const data = {
    from: ctx?.from ?? null,
    to: ctx?.to ?? null,
    channelId: ctx?.channelId ?? null,
    conversationId: ctx?.conversationId ?? null,
    content,
    contentPreview: previewMessage(content),
  };

  await writeToSupabase('agent_events', buildLegacyPayload('message', 'received', data, 'lobster-actual', event.sessionKey));
  await writeToSupabase('agent_events_v2', buildV2Payload('message', 'received', 'lobster-actual', event.sessionKey, '', data, {
    content_preview: previewMessage(content),
  }));
}

async function handleMessageSent(event: InternalHookEvent): Promise<void> {
  const ctx = event.context as Record<string, unknown> | undefined;
  const content = (ctx?.content as string) || '';
  const data = {
    to: ctx?.to ?? null,
    channelId: ctx?.channelId ?? null,
    conversationId: ctx?.conversationId ?? null,
    success: ctx?.success ?? false,
    error: ctx?.error ?? null,
    content,
    contentPreview: previewMessage(content),
  };

  await writeToSupabase('agent_events', buildLegacyPayload('message', 'sent', data, 'lobster-actual', event.sessionKey));
  await writeToSupabase('agent_events_v2', buildV2Payload('message', 'sent', 'lobster-actual', event.sessionKey, '', data, {
    content_preview: previewMessage(content),
  }));
}

async function handleMessagePreprocessed(event: InternalHookEvent): Promise<void> {
  const ctx = event.context as Record<string, unknown> | undefined;
  const transcript = (ctx?.transcript as string) || '';
  const data = {
    channelId: ctx?.channelId ?? null,
    conversationId: ctx?.conversationId ?? null,
    transcript,
    transcriptPreview: previewText(transcript, 500),
  };

  await writeToSupabase('agent_events', buildLegacyPayload('message', 'preprocessed', data, 'lobster-actual', event.sessionKey));
  await writeToSupabase('agent_events_v2', buildV2Payload('message', 'preprocessed', 'lobster-actual', event.sessionKey, '', data, {
    content_preview: previewText(transcript, 200),
  }));
}

async function handleSessionCompactBefore(event: InternalHookEvent): Promise<void> {
  const ctx = event.context as Record<string, unknown> | undefined;
  const data = {
    tokenCount: ctx?.tokenCount ?? null,
    messageCount: ctx?.messageCount ?? null,
  };

  await writeToSupabase('agent_events', buildLegacyPayload('session', 'compact_before', data, 'lobster-actual', event.sessionKey));
  await writeToSupabase('agent_events_v2', buildV2Payload('session', 'compact_before', 'lobster-actual', event.sessionKey, '', data));
}

async function handleSessionCompactAfter(event: InternalHookEvent): Promise<void> {
  const ctx = event.context as Record<string, unknown> | undefined;
  const data = {
    tokensSaved: ctx?.tokensSaved ?? null,
    messagesCompacted: ctx?.messagesCompacted ?? null,
    summaryLength: ctx?.summaryLength ?? null,
    tokenCountBefore: ctx?.tokenCountBefore ?? null,
    tokenCountAfter: ctx?.tokenCountAfter ?? null,
  };

  await writeToSupabase('agent_events', buildLegacyPayload('session', 'compact_after', data, 'lobster-actual', event.sessionKey));
  await writeToSupabase('agent_events_v2', buildV2Payload('session', 'compact_after', 'lobster-actual', event.sessionKey, '', data));
}

// ---------------------------------------------------------------------------
// Handlers — Agent Events
// ---------------------------------------------------------------------------

async function handleAgentEvent(evt: AgentEventPayload): Promise<void> {
  const { runId, stream, data, sessionKey } = evt;
  const phase = typeof data.phase === 'string' ? data.phase : null;

  if (stream === 'lifecycle') {
    if (phase === 'start') {
      await handleLifecycleStart(evt);
    } else if (phase === 'end') {
      await handleLifecycleEnd(evt);
    } else if (phase === 'error') {
      await handleLifecycleError(evt);
    }
    return;
  }

  if (stream === 'thinking') {
    handleThinkingChunk(evt);
    return;
  }

  if (stream === 'assistant') {
    handleAssistantChunk(evt);
    return;
  }
}

async function handleLifecycleStart(evt: AgentEventPayload): Promise<void> {
  const { runId, data, sessionKey } = evt;
  const startedAt = typeof data.startedAt === 'number' ? data.startedAt : Date.now();
  const model = typeof data.model === 'string' ? data.model : undefined;
  const agentId = typeof data.agentId === 'string' ? data.agentId : 'lobster-actual';

  lifecycleStarts.set(runId, {
    runId,
    sessionKey,
    model,
    agentId,
    startedAt,
    data,
  });

  const payload = buildV2Payload('agent', 'lifecycle_start', agentId, sessionKey, runId, data, {
    model,
  });

  await writeToSupabase('agent_events_v2', payload);
  await writeToSupabase('agent_events', buildLegacyPayload('agent', 'lifecycle_start', { runId, ...data }, agentId, sessionKey));
}

async function handleLifecycleEnd(evt: AgentEventPayload): Promise<void> {
  const { runId, data, sessionKey } = evt;
  const start = lifecycleStarts.get(runId);
  const agentId = (start?.agentId as string) || (data.agentId as string) || 'lobster-actual';
  const durationMs = start
    ? Date.now() - start.startedAt
    : (typeof data.durationMs === 'number' ? data.durationMs : null);

  lifecycleStarts.delete(runId);

  const payload = buildV2Payload('agent', 'lifecycle_end', agentId, sessionKey, runId, data, {
    duration_ms: durationMs ?? undefined,
    model: start?.model,
  });

  await writeToSupabase('agent_events_v2', payload);
  await writeToSupabase('agent_events', buildLegacyPayload('agent', 'lifecycle_end', { runId, ...data, durationMs }, agentId, sessionKey));
}

async function handleLifecycleError(evt: AgentEventPayload): Promise<void> {
  const { runId, data, sessionKey } = evt;
  const start = lifecycleStarts.get(runId);
  const agentId = (start?.agentId as string) || (data.agentId as string) || 'lobster-actual';
  const errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error ?? 'unknown');
  const durationMs = start ? Date.now() - start.startedAt : null;

  lifecycleStarts.delete(runId);

  const payload = buildV2Payload('agent', 'lifecycle_error', agentId, sessionKey, runId, data, {
    duration_ms: durationMs ?? undefined,
    content_preview: errorMsg.slice(0, 200),
  });

  await writeToSupabase('agent_events_v2', payload);
  await writeToSupabase('agent_events', buildLegacyPayload('agent', 'lifecycle_error', { runId, error: errorMsg }, agentId, sessionKey));
}

function handleThinkingChunk(evt: AgentEventPayload): void {
  const { runId, data, sessionKey } = evt;
  const text = typeof data.text === 'string' ? data.text : '';

  let acc = thinkingStreams.get(runId);
  if (!acc) {
    acc = { runId, sessionKey, content: '', startedAt: Date.now() };
    thinkingStreams.set(runId, acc);
  }
  acc.content += text;
}

async function handleThinkingEnd(runId: string): Promise<void> {
  const acc = thinkingStreams.get(runId);
  if (!acc || !acc.content) return;
  thinkingStreams.delete(runId);

  const content = acc.content;
  const data = { content, contentLength: content.length };

  await writeToSupabase('agent_events_v2', buildV2Payload('thinking', 'thinking_chunk', 'lobster-actual', acc.sessionKey, runId, data, {
    content_preview: previewText(content, 200),
  }));
}

function handleAssistantChunk(evt: AgentEventPayload): void {
  const { runId, data, sessionKey } = evt;
  const text = typeof data.text === 'string' ? data.text : '';

  let acc = assistantStreams.get(runId);
  if (!acc) {
    acc = { runId, sessionKey, content: '', startedAt: Date.now() };
    assistantStreams.set(runId, acc);
  }
  acc.content += text;
}

async function handleAssistantEnd(runId: string): Promise<void> {
  const acc = assistantStreams.get(runId);
  if (!acc || !acc.content) return;
  assistantStreams.delete(runId);

  const content = acc.content;
  const data = { content, contentLength: content.length };

  await writeToSupabase('agent_events_v2', buildV2Payload('assistant', 'assistant_chunk', 'lobster-actual', acc.sessionKey, runId, data, {
    content_preview: previewText(content, 200),
  }));
}

// ---------------------------------------------------------------------------
// Handlers — Heartbeat Events
// ---------------------------------------------------------------------------

async function handleHeartbeatEvent(evt: HeartbeatEventPayload): Promise<void> {
  const data = {
    status: evt.status,
    to: evt.to ?? null,
    accountId: evt.accountId ?? null,
    preview: evt.preview ?? null,
    durationMs: evt.durationMs ?? null,
    hasMedia: evt.hasMedia ?? false,
    reason: evt.reason ?? null,
    channel: evt.channel ?? null,
    silent: evt.silent ?? false,
    indicatorType: evt.indicatorType ?? null,
  };

  await writeToSupabase('agent_events_v2', buildV2Payload('heartbeat', 'heartbeat', 'gateway', undefined, '', data));
}

// ---------------------------------------------------------------------------
// Main Internal Hook Handler
// ---------------------------------------------------------------------------

async function internalHookHandler(event: InternalHookEvent): Promise<void> {
  const { type, action } = event;

  // session:compact events use 'patch' action in the raw event system
  if (type === 'session') {
    if (action === 'compact' || action === 'compact:before' || action === 'patch') {
      await handleSessionCompactBefore(event);
    } else if (action === 'compact:after') {
      await handleSessionCompactAfter(event);
    }
    return;
  }

  if (type === 'gateway' && action === 'startup') {
    await handleGatewayStartup(event);
    return;
  }

  if (type === 'agent' && action === 'bootstrap') {
    await handleAgentBootstrap(event);
    return;
  }

  if (type === 'message') {
    if (action === 'received') {
      await handleMessageReceived(event);
    } else if (action === 'sent') {
      await handleMessageSent(event);
    } else if (action === 'preprocessed') {
      await handleMessagePreprocessed(event);
    }
    return;
  }
}

// ---------------------------------------------------------------------------
// Stream End Detection
//
// Agent events arrive with seq numbers. We detect stream ends by watching
// for a lifecycle:end or lifecycle:error for a runId, and flush any
// accumulated thinking/assistant chunks at that point.
// ---------------------------------------------------------------------------

async function handleAgentEventWithStreamFlush(evt: AgentEventPayload): Promise<void> {
  const { runId, stream, data } = evt;
  const phase = typeof data.phase === 'string' ? data.phase : null;

  // Flush streams when lifecycle ends
  if (stream === 'lifecycle' && (phase === 'end' || phase === 'error')) {
    await Promise.all([
      handleThinkingEnd(runId),
      handleAssistantEnd(runId),
    ]);
  }

  await handleAgentEvent(evt);
}

// ---------------------------------------------------------------------------
// Initialization — called once when the hook is first loaded
// ---------------------------------------------------------------------------

let initialized = false;
let unsubscribers: Array<() => void> = [];

function initialize() {
  if (initialized) return;
  initialized = true;

  // Import the OpenClaw event subscription functions at runtime.
  // These are loaded from the plugin-sdk that OpenClaw makes available
  // to hooks at runtime.
  importOpenClawEvents().catch((err) => {
    console.error('[lobsterops-logger] Failed to import OpenClaw event APIs:', err);
  });
}

async function importOpenClawEvents(): Promise<void> {
  try {
    // onAgentEvent and onHeartbeatEvent are exported from the plugin-sdk infra modules
    // We pull them from the global openclaw module or via dynamic import of the dist bundle
    const { onAgentEvent, onHeartbeatEvent } = await importOpenClawAPIs();

    const unsubAgent = onAgentEvent((evt: AgentEventPayload) => {
      handleAgentEventWithStreamFlush(evt).catch((err) => {
        console.error('[lobsterops-logger] onAgentEvent handler error:', err);
      });
    });

    const unsubHeartbeat = onHeartbeatEvent((evt: HeartbeatEventPayload) => {
      handleHeartbeatEvent(evt).catch((err) => {
        console.error('[lobsterops-logger] onHeartbeatEvent handler error:', err);
      });
    });

    unsubscribers.push(unsubAgent, unsubHeartbeat);
    console.log('[lobsterops-logger] Subscribed to onAgentEvent and onHeartbeatEvent');
  } catch (err) {
    console.error('[lobsterops-logger] Could not subscribe to OpenClaw event streams:', err);
  }
}

/**
 * Dynamically load onAgentEvent / onHeartbeatEvent from the OpenClaw runtime.
 * Tries multiple import paths for compatibility across OpenClaw versions.
 */
async function importOpenClawAPIs(): Promise<{
  onAgentEvent: (listener: (evt: AgentEventPayload) => void) => () => void;
  onHeartbeatEvent: (listener: (evt: HeartbeatEventPayload) => void) => () => void;
}> {
  // Try loading from the plugin-sdk dist first
  const pluginSdkPaths = [
    '/opt/homebrew/lib/node_modules/openclaw/dist/plugin-sdk/src/infra/agent-events.js',
    '/opt/homebrew/lib/node_modules/openclaw/dist/plugin-sdk/src/infra/heartbeat-events.js',
  ];

  for (const path of pluginSdkPaths) {
    try {
      const mod = await import(path);
      if (mod.onAgentEvent && mod.onHeartbeatEvent) return mod;
    } catch {
      // Try next path
    }
  }

  // Fallback: try resolving from the main openclaw package
  try {
    const openclawPath = require.resolve('openclaw', { paths: ['/opt/homebrew/lib/node_modules'] });
    const { onAgentEvent, onHeartbeatEvent } = await import(openclawPath);
    if (onAgentEvent && onHeartbeatEvent) return { onAgentEvent, onHeartbeatEvent };
  } catch {
    // Fallback not available
  }

  throw new Error('Could not resolve onAgentEvent / onHeartbeatEvent from OpenClaw');
}

// ---------------------------------------------------------------------------
// Cleanup — called by OpenClaw when unloading the hook
// ---------------------------------------------------------------------------

function cleanup(): void {
  for (const unsub of unsubscribers) {
    try { unsub(); } catch { /* ignore */ }
  }
  unsubscribers = [];
  lifecycleStarts.clear();
  thinkingStreams.clear();
  assistantStreams.clear();
  initialized = false;
  console.log('[lobsterops-logger] Cleaned up event subscriptions');
}

// ---------------------------------------------------------------------------
// Export for OpenClaw
// ---------------------------------------------------------------------------

// OpenClaw hooks can export an init/cleanup lifecycle.
// The default export is the internal hook handler.
export { initialize as init, cleanup };
export default internalHookHandler;
