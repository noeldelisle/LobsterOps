/**
 * QueryEngine - Extracted query and retrieval methods for LobsterOps
 * 
 * Contains: queryEvents, getEvent, getAgentTrace, getRecentActivity, updateEvent
 */
class QueryEngine {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.storage - Storage adapter instance
   * @param {boolean} options.enabled - Whether querying is enabled
   */
  constructor(options = {}) {
    this.storage = options.storage;
    this.enabled = options.enabled !== false;

    // Bind all query methods
    this.queryEvents = this.queryEvents.bind(this);
    this.getEvent = this.getEvent.bind(this);
    this.getAgentTrace = this.getAgentTrace.bind(this);
    this.getRecentActivity = this.getRecentActivity.bind(this);
    this.updateEvent = this.updateEvent.bind(this);
  }

  /**
   * Update storage reference
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
   * Query events with filtering options
   * @param {Object} filter - Filter criteria
   * @param {Object} options - Query options (limit, offset, sort, etc.)
   * @returns {Promise<Array>} - Matching events
   */
  async queryEvents(filter = {}, options = {}) {
    if (!this.enabled) {
      return [];
    }

    try {
      return await this.storage.queryEvents(filter, options);
    } catch (error) {
      throw new Error(`Failed to query events: ${error.message}`);
    }
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

    try {
      return await this.storage.getEventById(eventId);
    } catch (error) {
      throw new Error(`Failed to get event: ${error.message}`);
    }
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

    try {
      return await this.storage.updateEvent(eventId, updates);
    } catch (error) {
      throw new Error(`Failed to update event: ${error.message}`);
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

    try {
      const traceOptions = {
        agentIds: [agentId],
        limit: options.limit || 1000,
        offset: options.offset || 0,
        sortBy: 'timestamp',
        sortOrder: options.sortOrder || 'asc', // Chronological by default for traces
        ...options
      };

      // Remove agentIds from options since we handle it separately
      delete traceOptions.agentIds;

      return await this.queryEvents(
        { agentId },
        traceOptions
      );
    } catch (error) {
      throw new Error(`Failed to get agent trace: ${error.message}`);
    }
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

    try {
      const activityOptions = {
        limit: options.limit || 50,
        offset: options.offset || 0,
        sortBy: 'timestamp',
        sortOrder: 'desc', // Most recent first
        ...options
      };

      return await this.queryEvents({}, activityOptions);
    } catch (error) {
      throw new Error(`Failed to get recent activity: ${error.message}`);
    }
  }
}

module.exports = { QueryEngine };
