const { JsonFileStorage } = require('./JsonFileStorage');
const { MemoryStorage } = require('./MemoryStorage');

/**
 * Storage Factory
 * Creates and configures storage backends based on environment or explicit configuration
 * 
 * Supports:
 * - json: JSON file storage (zero dependency, works everywhere)
 * - memory: In-memory storage (for testing/temporary use)
 * - sqlite: SQLite storage (coming soon)
 * - supabase: Supabase storage (coming soon)
 */
class StorageFactory {
  /**
   * Create a storage backend based on configuration
   * @param {string} type - Storage type ('json', 'memory', 'sqlite', 'supabase')
   * @param {Object} config - Configuration specific to the storage type
   * @returns {StorageAdapter} - Configured storage backend instance
   */
  static createStorage(type = 'json', config = {}) {
    switch (type.toLowerCase()) {
      case 'json':
        return new JsonFileStorage(config);
      case 'memory':
        return new MemoryStorage(config);
      case 'sqlite':
        // TODO: Implement SQLite storage
        throw new Error('SQLite storage not yet implemented');
      case 'supabase':
        // TODO: Implement Supabase storage
        throw new Error('Supabase storage not yet implemented');
      default:
        throw new Error(`Unsupported storage type: ${type}. Supported types: json, memory`);
    }
  }

  /**
   * Automatically detect and create the best available storage backend
   * @param {Object} config - Configuration options
   * @returns {StorageAdapter} - Best available storage backend
   */
  static createAutoStorage(config = {}) {
    // Check for explicit storage type in config
    if (config.type) {
      return this.createStorage(config.type, config);
    }
    
    // Check environment variables
    const envType = process.env.LOBSTER_STORAGE || process.env.STORAGE_TYPE;
    if (envType) {
      return this.createStorage(envType, config);
    }
    
    // Auto-detection logic
    // 1. If we're in a testing environment, prefer memory
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return new MemoryStorage(config);
    }
    
    // 2. Otherwise, default to JSON file storage (works everywhere)
    return new JsonFileStorage(config);
  }

  /**
   * Get list of supported storage types
   * @returns {Array<string>} - Supported storage types
   */
  static getSupportedTypes() {
    return ['json', 'memory']; // SQLite and Supabase coming soon
  }
}

module.exports = { StorageFactory };