const { StorageAdapter } = require('./StorageAdapter');
const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase Storage Backend
 * Cloud-based PostgreSQL storage via Supabase
 * Ideal for production, team collaboration, and cross-device sync
 */
class SupabaseStorage extends StorageAdapter {
  /**
   * @param {Object} config - Configuration options
   * @param {string} config.supabaseUrl - Supabase project URL
   * @param {string} config.supabaseKey - Supabase anon key or service role key
   * @param {string} config.tableName - Table name for events (default: 'agent_events')
   * @param {number} config.maxRetries - Max retry attempts for failed operations (default: 3)
   */
  constructor(config = {}) {
    super();
    this.supabaseUrl = config.supabaseUrl;
    this.supabaseKey = config.supabaseKey;
    this.tableName = config.tableName || 'agent_events';
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // Start with 1 second delay
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase storage requires supabaseUrl and supabaseKey configuration');
    }
    
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    this.initialized = false;
    this.tableExists = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Test connection by trying to query the table (will create if doesn't exist)
      await this._ensureTableExists();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Supabase storage: ${error.message}`);
    }
  }

  async _ensureTableExists() {
    if (this.tableExists) return;
    
    try {
      // Try to select from the table to see if it exists
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id')
        .limit(1);
      
      if (error && error.code === '42P01') { // Table doesn't exist
        await this._createTable();
      } else if (error) {
        throw error;
      }
      // If no error, table exists
      
      this.tableExists = true;
    } catch (error) {
      // If we can't determine table existence, try to create it
      // (handles permission issues where we can't check but can create)
      await this._createTable();
      this.tableExists = true;
    }
  }

  async _createTable() {
    // Note: Supabase doesn't allow direct DDL execution via client
    // Tables need to be created through the Supabase dashboard or SQL editor
    // For now, we'll throw an informative error guiding the user to create the table
    throw new Error(
      `Supabase table '${this.tableName}' does not exist. Please create it in your Supabase project:\n\n` +
      `CREATE TABLE ${this.tableName} (\n` +
      `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n` +
      `  type TEXT NOT NULL,\n` +
      `  agentId TEXT,\n` +
      `  action TEXT,\n` +
      `  timestamp TIMESTAMPTZ NOT NULL,\n` +
      `  storedAt TIMESTAMPTZ NOT NULL,\n` +
      `  data JSONB,\n` +
      `  updatedAt TIMESTAMPTZ,\n` +
      `  createdAt TIMESTAMPTZ DEFAULT NOW()\n` +
      `);\n\n` +
      `-- Create indexes for common query patterns\n` +
      `CREATE INDEX idx_${this.tableName}_timestamp ON ${this.tableName}(timestamp);\n` +
      `CREATE INDEX idx_${this.tableName}_type ON ${this.tableName}(type);\n` +
      `CREATE INDEX idx_${this.tableName}_agentId ON ${this.tableName}(agentId);\n` +
      `CREATE INDEX idx_${this.tableName}_action ON ${this.tableName}(action);`
    );
  }

  async _executeWithRetry(operation, attempt = 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw new Error(`Operation failed after ${this.maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1)));
      return this._executeWithRetry(operation, attempt + 1);
    }
  }

  async saveEvent(event) {
    if (!this.initialized) await this.init();
    
    try {
      const enrichedEvent = {
        ...event,
        id: event.id || this._generateId(),
        timestamp: event.timestamp || new Date().toISOString(),
        storedAt: new Date().toISOString()
      };
      
      const { data, error } = await this._executeWithRetry(() =>
        this.supabase
          .from(this.tableName)
          .insert([enrichedEvent])
          .select()
      );
      
      if (error) throw error;
      
      return data[0].id;
    } catch (error) {
      throw new Error(`Failed to save event: ${error.message}`);
    }
  }

  async queryEvents(filter = {}, options = {}) {
    if (!this.initialized) await this.init();
    
    try {
      let query = this.supabase.from(this.tableName).select('*');
      
      const {
        startDate, endDate, eventTypes, agentIds, actions, 
        limit = 100, offset = 0, 
        sortBy = 'timestamp', sortOrder = 'desc'
      } = { 
        startDate: null, endDate: null, eventTypes: [], agentIds: [], actions: [],
        limit: 100, offset: 0, sortBy: 'timestamp', sortOrder: 'desc' 
      , ...filter, ...options };

      // Apply filters
      if (startDate) {
        query = query.gte('timestamp', startDate);
      }
      
      if (endDate) {
        query = query.lte('timestamp', endDate);
      }
      
      if (eventTypes.length > 0) {
        query = query.in('type', eventTypes);
      }
      
      if (agentIds.length > 0) {
        query = query.in('agentId', agentIds);
      }
      
      if (actions.length > 0) {
        query = query.in('action', actions);
      }
      
      // Apply sorting
      const ascending = sortOrder.toLowerCase() === 'asc';
      query = query.order(sortBy, { ascending });
      
      // Apply pagination
      query = query.range(offset, offset + limit - 1);
      
      const { data, error } = await this._executeWithRetry(() => query);
      
      if (error) throw error;
      
      // Supabase returns data with timestamps as strings, which is what we want
      return data;
    } catch (error) {
      throw new Error(`Failed to query events: ${error.message}`);
    }
  }

  async getEventById(eventId) {
    if (!this.initialized) await this.init();
    
    try {
      const { data, error } = await this._executeWithRetry(() =>
        this.supabase
          .from(this.tableName)
          .select('*')
          .eq('id', eventId)
          .single()
      );
      
      if (error) throw error;
      
      // If no data returned, Supabase throws an error for .single()
      if (!data) {
        return null;
      }
      
      return data;
    } catch (error) {
      // Handle case where event doesn't exist
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      throw new Error(`Failed to get event: ${error.message}`);
    }
  }

  async updateEvent(eventId, updates) {
    if (!this.initialized) await this.init();
    
    try {
      const updateWithTime = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      const { data, error } = await this._executeWithRetry(() =>
        this.supabase
          .from(this.tableName)
          .update(updateWithTime)
          .eq('id', eventId)
      );
      
      if (error) throw error;
      
      // Check if any rows were updated
      return data && data.length > 0;
    } catch (error) {
      throw new Error(`Failed to update event: ${error.message}`);
    }
  }

  async deleteEvents(filter = {}) {
    if (!this.initialized) await this.init();
    
    try {
      let query = this.supabase.from(this.tableName).delete();
      
      const {
        startDate, endDate, eventTypes, agentIds, actions
      } = { 
        startDate: null, endDate: null, eventTypes: [], agentIds: [], actions: [] 
      , ...filter };

      // Apply filters (same as queryEvents)
      if (startDate) {
        query = query.gte('timestamp', startDate);
      }
      
      if (endDate) {
        query = query.lte('timestamp', endDate);
      }
      
      if (eventTypes.length > 0) {
        query = query.in('type', eventTypes);
      }
      
      if (agentIds.length > 0) {
        query = query.in('agentId', agentIds);
      }
      
      if (actions.length > 0) {
        query = query.in('action', actions);
      }
      
      // First, get count of events to delete
      const countQuery = this.supabase.from(this.tableName).select('id', { count: 'exact' });
      
      if (startDate) {
        countQuery.gte('timestamp', startDate);
      }
      
      if (endDate) {
        countQuery.lte('timestamp', endDate);
      }
      
      if (eventTypes.length > 0) {
        countQuery.in('type', eventTypes);
      }
      
      if (agentIds.length > 0) {
        countQuery.in('agentId', agentIds);
      }
      
      if (actions.length > 0) {
        countQuery.in('action', actions);
      }
      
      const { data: countData, error: countError } = await this._executeWithRetry(() => countQuery);
      
      if (countError) throw countError;
      
      const countToDelete = countData.length;
      
      // Then perform the deletion
      const { data, error } = await this._executeWithRetry(() => query);
      
      if (error) throw error;
      
      return countToDelete;
    } catch (error) {
      throw new Error(`Failed to delete events: ${error.message}`);
    }
  }

  async cleanupOld(maxAgeDays = 30) {
    if (!this.initialized) await this.init();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
      const cutoffISO = cutoffDate.toISOString();

      // Count events to delete
      const { data: countData, error: countError } = await this._executeWithRetry(() =>
        this.supabase
          .from(this.tableName)
          .select('id', { count: 'exact' })
          .lt('timestamp', cutoffISO)
      );

      if (countError) throw countError;
      const countToDelete = countData ? countData.length : 0;

      if (countToDelete === 0) return 0;

      // Delete old events
      const { error: deleteError } = await this._executeWithRetry(() =>
        this.supabase
          .from(this.tableName)
          .delete()
          .lt('timestamp', cutoffISO)
      );

      if (deleteError) throw deleteError;

      return countToDelete;
    } catch (error) {
      throw new Error(`Failed to cleanup old events: ${error.message}`);
    }
  }

  async getStats() {
    if (!this.initialized) await this.init();
    
    try {
      const { data, error } = await this._executeWithRetry(() =>
        this.supabase
          .from(this.tableName)
          .select('*', { count: 'exact' })
          .limit(0) // We only want the count
      );
      
      if (error) throw error;
      
      return {
        backend: 'supabase',
        tableName: this.tableName,
        eventCount: data.count,
        url: this.supabaseUrl
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  async close() {
    // Supabase client doesn't need explicit closing
    this.initialized = false;
    return Promise.resolve();
  }

  /**
   * Generate a simple unique ID
   * @returns {string} - Unique ID
   */
  _generateId() {
    return Math.random().toString(36).substr(2, 9) + 
           Date.now().toString(36) +
           Math.random().toString(36).substr(2, 9);
  }
}

module.exports = { SupabaseStorage };