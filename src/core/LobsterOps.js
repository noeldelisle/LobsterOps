const { StorageFactory } = require('../storage/StorageFactory');
const { EventLoggers } = require('./EventLoggers');
const { QueryEngine } = require('./QueryEngine');
const { Operations } = require('./Operations');

/**
 * LobsterOps - AI Agent Observability & Debug Console
 * 
 * Main class for recording, querying, and analyzing AI agent events.
 * Designed to be flexible, dependency-free, and easy to integrate.
 * 
 * Features:
 * - Pluggable storage backends (JSON files, memory, SQLite, Supabase)
 * - Structured event logging with automatic enrichment
 * - AI-agent specific logging helpers (thoughts, tool calls, decisions, etc.)
 * - Powerful querying capabilities
 * - OpenClaw integration ready
 * - Zero configuration required to get started
 */
class LobsterOps {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.storageType - Storage backend type ('json', 'memory', 'sqlite', 'supabase')
   * @param {Object} options.storageConfig - Configuration for the storage backend
   * @param {boolean} options.enabled - Whether LobsterOps is enabled (default: true)
   * @param {string} options.instanceId - Unique identifier for this LobsterOps instance
   * @param {Object} options.piiFiltering - PII filtering configuration
   * @param {Object} options.alerts - Alert configuration
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== false; // Default to true
    this.instanceId = options.instanceId || this._generateInstanceId();
    this.storageType = options.storageType || 'json'; // Default to JSON file storage
    this.storageConfig = options.storageConfig || {};

    // Add instance ID to storage config for backends that might need it
    this.storageConfig.instanceId = this.instanceId;

    this.storage = null;
    this.initialized = false;

    // Initialize EventLoggers with PII filter
    this.eventLoggers = new EventLoggers({
      instanceId: this.instanceId,
      enabled: this.enabled,
      piiFiltering: options.piiFiltering || {}
    });

    // Initialize QueryEngine
    this.queryEngine = new QueryEngine({
      enabled: this.enabled
    });

    // Initialize Operations
    this.operations = new Operations({
      instanceId: this.instanceId,
      storageType: this.storageType,
      enabled: this.enabled
    });

    // PII filter reference for external access
    this.piiFilter = this.eventLoggers.piiFilter;

    // Alert manager reference
    this.alertManager = this.eventLoggers.alertManager;
  }

  /**
   * Initialize LobsterOps and the storage backend
   * @returns {Promise<void>}
   */
  async init() {
    if (!this.enabled) {
      this.initialized = true;
      return;
    }
    
    try {
      // Create the storage backend using the factory
      this.storage = StorageFactory.createStorage(this.storageType, this.storageConfig);
      
      // Initialize the storage backend
      await this.storage.init();
      
      // Wire up modules to storage
      this.eventLoggers.setStorage(this.storage);
      this.queryEngine.setStorage(this.storage);
      this.operations.setStorage(this.storage);
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize LobsterOps: ${error.message}`);
    }
  }

  // --- Delegated EventLogger methods ---

  /**
   * Log a general agent event
   * @param {Object} event - The agent event to log
   * @param {Object} options - Additional options
   * @returns {Promise<string|null>} - The ID of the logged event
   */
  async logEvent(event, options = {}) {
    return this.eventLoggers.logEvent(event, options);
  }

  /**
   * Log an agent thought/reasoning step
   * @param {Object} thought - The thought content and metadata
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged thought
   */
  async logThought(thought, options = {}) {
    return this.eventLoggers.logThought(thought, options);
  }

  /**
   * Log a tool call execution
   * @param {Object} toolCall - Tool call details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged tool call
   */
  async logToolCall(toolCall, options = {}) {
    return this.eventLoggers.logToolCall(toolCall, options);
  }

  /**
   * Log an agent decision
   * @param {Object} decision - Decision details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged decision
   */
  async logDecision(decision, options = {}) {
    return this.eventLoggers.logDecision(decision, options);
  }

  /**
   * Log an agent error
   * @param {Object} error - Error details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged error
   */
  async logError(error, options = {}) {
    return this.eventLoggers.logError(error, options);
  }

  /**
   * Log agent spawning/subagent creation
   * @param {Object} spawnInfo - Spawning details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged spawn event
   */
  async logSpawning(spawnInfo, options = {}) {
    return this.eventLoggers.logSpawning(spawnInfo, options);
  }

  /**
   * Log agent lifecycle event (startup, shutdown, etc.)
   * @param {Object} lifecycleInfo - Lifecycle event details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged lifecycle event
   */
  async logLifecycle(lifecycleInfo, options = {}) {
    return this.eventLoggers.logLifecycle(lifecycleInfo, options);
  }

  // --- Delegated QueryEngine methods ---

  /**
   * Query events with filtering options
   * @param {Object} filter - Filter criteria
   * @param {Object} options - Query options (limit, offset, sort, etc.)
   * @returns {Promise<Array>} - Matching events
   */
  async queryEvents(filter = {}, options = {}) {
    if (!this.enabled) {
      return [];
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.queryEngine.queryEvents(filter, options);
  }

  /**
   * Get a specific event by ID
   * @param {string} eventId - The ID of the event to retrieve
   * @returns {Promise<Object|null>} - The event or null if not found
   */
  async getEvent(eventId) {
    if (!this.enabled) {
      return null;
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.queryEngine.getEvent(eventId);
  }

  /**
   * Update an existing event
   * @param {string} eventId - The ID of the event to update
   * @param {Object} updates - The fields to update
   * @returns {Promise<boolean>} - True if successful
   */
  async updateEvent(eventId, updates) {
    if (!this.enabled) {
      return false;
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.queryEngine.updateEvent(eventId, updates);
  }

  /**
   * Delete events matching criteria
   * @param {Object} filter - Filter criteria for deletion
   * @returns {Promise<number>} - Number of events deleted
   */
  async deleteEvents(filter = {}) {
    if (!this.enabled) {
      return 0;
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      return await this.storage.deleteEvents(filter);
    } catch (error) {
      throw new Error(`Failed to delete events: ${error.message}`);
    }
  }

  /**
   * Get a complete trace of an agent's activity
   * @param {string} agentId - The ID of the agent to trace
   * @param {Object} options - Trace options (time range, limit, etc.)
   * @returns {Promise<Array>} - Chronological trace of agent activity
   */
  async getAgentTrace(agentId, options = {}) {
    if (!this.enabled) {
      return [];
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.queryEngine.getAgentTrace(agentId, options);
  }

  /**
   * Get recent activity across all agents or for a specific agent
   * @param {Object} options - Activity options
   * @returns {Promise<Array>} - Recent events
   */
  async getRecentActivity(options = {}) {
    if (!this.enabled) {
      return [];
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.queryEngine.getRecentActivity(options);
  }

  // --- Delegated Operations methods ---

  /**
   * Clean up old events based on retention policy
   * @returns {Promise<number>} - Number of events removed
   */
  async cleanupOld() {
    if (!this.enabled) {
      return 0;
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.operations.cleanupOld();
  }

  /**
   * Get storage and usage statistics
   * @returns {Promise<Object>} - Statistics about storage usage
   */
  async getStats() {
    if (!this.enabled) {
      return { enabled: false };
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.operations.getStats();
  }

  /**
   * Close LobsterOps and release resources
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.initialized) {
      return;
    }
    
    await this.operations.close();
    this.initialized = false;
  }

  /**
   * Export events to a specific format
   * @param {string} format - Export format: 'json', 'csv', or 'markdown'
   * @param {Object} filter - Filter criteria for events to export
   * @param {Object} options - Export and query options
   * @returns {Promise<string>} - Exported data as string
   */
  async exportEvents(format = 'json', filter = {}, options = {}) {
    if (!this.enabled) {
      return '[]';
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.operations.exportEvents(format, filter, options);
  }

  /**
   * Create a debug console for stepping through an agent's event trace
   * @param {string} agentId - Agent ID to debug
   * @param {Object} options - Query options
   * @returns {Promise<DebugConsole>} - Interactive debug console
   */
  async createDebugConsole(agentId, options = {}) {
    if (!this.enabled) {
      return null;
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.operations.createDebugConsole(agentId, options);
  }

  /**
   * Run behavioral analytics on events
   * @param {Object} filter - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Analytics report
   */
  async analyze(filter = {}, options = {}) {
    if (!this.enabled) {
      return { error: 'LobsterOps is disabled' };
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    return this.operations.analyze(filter, options);
  }

  /**
   * Check if LobsterOps is initialized and ready
   * @returns {boolean} - True if ready to use
   */
  isReady() {
    return this.enabled && this.initialized && this.storage !== null;
  }

  /**
   * Generate a unique instance ID
   * @returns {string} - Unique instance ID
   */
  _generateInstanceId() {
    return `lobsterops-${Math.random().toString(36).substr(2, 9)}-${Date.now().toString(36)}`;
  }
}

module.exports = { LobsterOps };
