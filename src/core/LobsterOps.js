const { StorageFactory } = require('../storage/StorageFactory');
const { v4: uuidv4 } = require('uuid');

/**
 * LobsterOps - AI Agent Observability & Debug Console
 * 
 * Main class for recording, querying, and analyzing AI agent events.
 * Designed to be flexible, dependency-free, and easy to integrate.
 * 
 * Features:
 * - Pluggable storage backends (JSON files, memory, SQLite, Supabase coming soon)
 * - Structured event logging with automatic enrichment
 * - Powerful querying capabilities
 * - OpenClaw integration ready
 * - Zero configuration required to get started
 */
class LobsterOps {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.storageType - Storage backend type ('json', 'memory', etc.)
   * @param {Object} options.storageConfig - Configuration for the storage backend
   * @param {boolean} options.enabled - Whether LobsterOps is enabled (default: true)
   * @param {string} options.instanceId - Unique identifier for this LobsterOps instance
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
    
    // Bind methods for easier use
    this.logEvent = this.logEvent.bind(this);
    this.queryEvents = this.queryEvents.bind(this);
    this.getEvent = this.getEvent.bind(this);
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
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize LobsterOps: ${error.message}`);
    }
  }

  /**
   * Log an agent event
   * @param {Object} event - The agent event to log
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The ID of the logged event
   */
  async logEvent(event, options = {}) {
    if (!this.enabled) {
      return null; // Silently ignore if disabled
    }
    
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      // Enrich the event with metadata
      const enrichedEvent = {
        ...event,
        id: event.id || uuidv4(),
        timestamp: event.timestamp || new Date().toISOString(),
        lobsterOpsInstanceId: this.instanceId,
        loggedAt: new Date().toISOString(),
        ...options
      };
      
      // Save to storage
      const eventId = await this.storage.saveEvent(enrichedEvent);
      return eventId;
    } catch (error) {
      throw new Error(`Failed to log event: ${error.message}`);
    }
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
    
    if (!this.initialized) {
      await this.init();
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
    
    if (!this.initialized) {
      await this.init();
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
    
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      return await this.storage.updateEvent(eventId, updates);
    } catch (error) {
      throw new Error(`Failed to update event: ${error.message}`);
    }
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
    
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      const stats = await this.storage.getStats();
      return {
        enabled: true,
        instanceId: this.instanceId,
        storageType: this.storageType,
        ...stats
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
    if (!this.initialized) {
      return;
    }
    
    try {
      if (this.storage) {
        await this.storage.close();
      }
      this.initialized = false;
    } catch (error) {
      throw new Error(`Failed to close LobsterOps: ${error.message}`);
    }
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