const { Exporter } = require('./Exporter');
const { Analytics } = require('./Analytics');
const { DebugConsole } = require('./DebugConsole');

/**
 * Operations - Extracted operational methods for LobsterOps
 * 
 * Contains: cleanupOld, getStats, close, exportEvents, createDebugConsole, analyze
 */
class Operations {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.storage - Storage adapter instance
   * @param {Object} options.instanceId - LobsterOps instance ID
   * @param {string} options.storageType - Storage backend type
   * @param {boolean} options.enabled - Whether operations are enabled
   */
  constructor(options = {}) {
    this.storage = options.storage;
    this.instanceId = options.instanceId;
    this.storageType = options.storageType || 'json';
    this.enabled = options.enabled !== false;

    // Bind all operation methods
    this.cleanupOld = this.cleanupOld.bind(this);
    this.getStats = this.getStats.bind(this);
    this.close = this.close.bind(this);
    this.exportEvents = this.exportEvents.bind(this);
    this.createDebugConsole = this.createDebugConsole.bind(this);
    this.analyze = this.analyze.bind(this);
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
   * Clean up old events based on retention policy
   * @returns {Promise<number>} - Number of events removed
   */
  async cleanupOld() {
    if (!this.enabled) {
      return 0;
    }

    try {
      return await this.storage.cleanupOld();
    } catch (error) {
      throw new Error(`Failed to cleanup old events: ${error.message}`);
    }
  }

  /**
   * Get storage and usage statistics
   * @returns {Promise<Object>} - Statistics about storage usage
   */
  async getStats() {
    if (!this.enabled) {
      return { enabled: false };
    }

    try {
      const stats = await this.storage.getStats();
      return {
        enabled: true,
        backend: stats.backend,
        totalEvents: stats.eventCount || stats.totalEvents || 0,
        storageType: this.storageType,
        instanceId: this.instanceId,
        // Backend-specific fields
        ...(stats.filename && { filename: stats.filename }),
        ...(stats.dataDir && { dataDir: stats.dataDir }),
        ...(stats.supabaseUrl && { supabaseUrl: stats.supabaseUrl }),
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  /**
   * Close LobsterOps and release resources
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.storage) {
      return;
    }

    try {
      await this.storage.close();
    } catch (error) {
      throw new Error(`Failed to close LobsterOps: ${error.message}`);
    }
  }

  /**
   * Export events to a specific format
   * @param {string} format - Export format: 'json', 'csv', or 'markdown'
   * @param {Object} filter - Filter criteria for events to export
   * @param {Object} options - Export and query options
   * @returns {Promise<string>} - Exported data as string
   */
  async exportEvents(format = 'json', filter = {}, options = {}) {
    const events = await this.storage.queryEvents(filter, { limit: options.limit || 10000, ...options });

    switch (format.toLowerCase()) {
      case 'csv':
        return Exporter.toCSV(events, options);
      case 'markdown':
      case 'md':
        return Exporter.toMarkdown(events, options);
      case 'json':
      default:
        return Exporter.toJSON(events, options);
    }
  }

  /**
   * Create a debug console for stepping through an agent's event trace
   * @param {string} agentId - Agent ID to debug
   * @param {Object} options - Query options
   * @returns {Promise<DebugConsole>} - Interactive debug console
   */
  async createDebugConsole(agentId, options = {}) {
    // First get the trace
    const traceOptions = {
      limit: options.limit || 1000,
      offset: options.offset || 0,
      sortBy: 'timestamp',
      sortOrder: 'asc', // Chronological for debug console
      ...options
    };

    const events = await this.storage.queryEvents(
      { agentId },
      traceOptions
    );
    return new DebugConsole(events);
  }

  /**
   * Run behavioral analytics on events
   * @param {Object} filter - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Analytics report
   */
  async analyze(filter = {}, options = {}) {
    const events = await this.storage.queryEvents(filter, { limit: options.limit || 10000, ...options });
    return Analytics.analyze(events);
  }
}

module.exports = { Operations };
