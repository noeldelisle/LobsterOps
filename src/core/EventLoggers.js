const { v4: uuidv4 } = require('uuid');
const { PIIFilter } = require('./PIIFilter');
const { AlertManager } = require('./AlertManager');

/**
 * EventLoggers - Extracted event logging helpers for LobsterOps
 * 
 * Contains all specialized logging methods: logEvent, logThought, logToolCall,
 * logDecision, logError, logSpawning, logLifecycle
 */
class EventLoggers {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.storage - Storage adapter instance
   * @param {Object} options.instanceId - LobsterOps instance ID
   * @param {boolean} options.enabled - Whether logging is enabled
   * @param {Object} options.piiFiltering - PII filtering configuration
   */
  constructor(options = {}) {
    this.storage = options.storage;
    this.instanceId = options.instanceId;
    this.enabled = options.enabled !== false;
    this.piiFilter = new PIIFilter(options.piiFiltering || {});
    this.alertManager = new AlertManager();

    // Bind all logging methods
    this.logEvent = this.logEvent.bind(this);
    this.logThought = this.logThought.bind(this);
    this.logToolCall = this.logToolCall.bind(this);
    this.logDecision = this.logDecision.bind(this);
    this.logError = this.logError.bind(this);
    this.logSpawning = this.logSpawning.bind(this);
    this.logLifecycle = this.logLifecycle.bind(this);
  }

  /**
   * Update storage reference (called after LobsterOps.init())
   * @param {Object} storage - Storage adapter
   */
  setStorage(storage) {
    this.storage = storage;
  }

  /**
   * Update enabled state
   * @param {boolean} enabled 
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Log a general agent event
   * @param {Object} event - The agent event to log
   * @param {Object} options - Additional options
   * @returns {Promise<string|null>} - The ID of the logged event
   */
  async logEvent(event, options = {}) {
    if (!this.enabled) {
      return null;
    }

    try {
      // Apply PII filtering
      const filteredEvent = this.piiFilter.filter(event);

      // Enrich the event with metadata
      const enrichedEvent = {
        ...filteredEvent,
        id: event.id || uuidv4(),
        timestamp: event.timestamp || new Date().toISOString(),
        lobsterOpsInstanceId: this.instanceId,
        loggedAt: new Date().toISOString(),
        ...options
      };

      // Evaluate alert rules
      this.alertManager.evaluate(enrichedEvent);

      // Save to storage
      const eventId = await this.storage.saveEvent(enrichedEvent);
      return eventId;
    } catch (error) {
      throw new Error(`Failed to log event: ${error.message}`);
    }
  }

  /**
   * Log an agent thought/reasoning step
   * @param {Object} thought - The thought content and metadata
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged thought
   */
  async logThought(thought, options = {}) {
    return this.logEvent({
      type: 'agent-thought',
      ...thought
    }, {
      category: 'reasoning',
      ...options
    });
  }

  /**
   * Log a tool call execution
   * @param {Object} toolCall - Tool call details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged tool call
   */
  async logToolCall(toolCall, options = {}) {
    return this.logEvent({
      type: 'tool-call',
      ...toolCall
    }, {
      category: 'action',
      ...options
    });
  }

  /**
   * Log an agent decision
   * @param {Object} decision - Decision details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged decision
   */
  async logDecision(decision, options = {}) {
    return this.logEvent({
      type: 'agent-decision',
      ...decision
    }, {
      category: 'decision',
      ...options
    });
  }

  /**
   * Log an agent error
   * @param {Object} error - Error details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged error
   */
  async logError(error, options = {}) {
    return this.logEvent({
      type: 'agent-error',
      ...error
    }, {
      category: 'error',
      severity: options.severity || 'medium',
      ...options
    });
  }

  /**
   * Log agent spawning/subagent creation
   * @param {Object} spawnInfo - Spawning details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged spawn event
   */
  async logSpawning(spawnInfo, options = {}) {
    return this.logEvent({
      type: 'agent-spawn',
      ...spawnInfo
    }, {
      category: 'lifecycle',
      ...options
    });
  }

  /**
   * Log agent lifecycle event (startup, shutdown, etc.)
   * @param {Object} lifecycleInfo - Lifecycle event details
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged lifecycle event
   */
  async logLifecycle(lifecycleInfo, options = {}) {
    return this.logEvent({
      type: 'agent-lifecycle',
      ...lifecycleInfo
    }, {
      category: 'lifecycle',
      ...options
    });
  }
}

module.exports = { EventLoggers };
