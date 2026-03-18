const { LobsterOps } = require('../src/core/LobsterOps');
const { JsonFileStorage } = require('../src/storage/JsonFileStorage');
const { MemoryStorage } = require('../src/storage/MemoryStorage');
const { StorageFactory } = require('../src/storage/StorageFactory');

describe('LobsterOps Core Functionality', () => {
  let lobsterOps;
  const testDir = './test-lobsterops-data';

  beforeEach(async () => {
    // Clean up any previous test data
    const fs = require('fs').promises;
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore if directory doesn't exist
    }
    
    lobsterOps = new LobsterOps({
      storageType: 'json',
      storageConfig: {
        dataDir: testDir
      }
    });
    
    await lobsterOps.init();
  });

  afterEach(async () => {
    await lobsterOps.close();
    // Clean up test data
    const fs = require('fs').promises;
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore if directory doesn't exist
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with JSON storage', async () => {
      expect(lobsterOps.isReady()).toBe(true);
    });

    test('should be disabled when enabled: false', async () => {
      const disabledOps = new LobsterOps({ enabled: false });
      await disabledOps.init();
      expect(disabledOps.isReady()).toBe(false);
      await disabledOps.close();
    });
  });

  describe('Event Logging', () => {
    test('should log a basic event and return an ID', async () => {
      const event = {
        type: 'test-event',
        message: 'This is a test event',
        data: { key: 'value' }
      };
      
      const eventId = await lobsterOps.logEvent(event);
      
      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
      expect(eventId.length).toBeGreaterThan(0);
    });

    test('should enrich events with metadata', async () => {
      const event = {
        type: 'enrichment-test',
        message: 'Testing event enrichment'
      };
      
      const eventId = await lobsterOps.logEvent(event);
      const retrievedEvent = await lobsterOps.getEvent(eventId);
      
      expect(retrievedEvent).toBeDefined();
      expect(retrievedEvent.id).toBe(eventId);
      expect(retrievedEvent.timestamp).toMatch(/\d{4}-\d{2}-\d{2}/); // ISO date format
      expect(retrievedEvent.lobsterOpsInstanceId).toBeDefined();
      expect(retrievedEvent.loggedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    test('should preserve original event data', async () => {
      const originalEvent = {
        type: 'preservation-test',
        agentId: 'agent-123',
        action: 'test-action',
        input: { query: 'test query' },
        output: { result: 'success' },
        durationMs: 150
      };
      
      const eventId = await lobsterOps.logEvent(originalEvent);
      const retrievedEvent = await lobsterOps.getEvent(eventId);
      
      expect(retrievedEvent.agentId).toBe(originalEvent.agentId);
      expect(retrievedEvent.action).toBe(originalEvent.action);
      expect(retrievedEvent.input).toEqual(originalEvent.input);
      expect(retrievedEvent.output).toEqual(originalEvent.output);
      expect(retrievedEvent.durationMs).toBe(originalEvent.durationMs);
    });
  });

  describe('Event Querying', () => {
    test('should be able to query events by various criteria', async () => {
      // Log several test events
      const eventsToLog = [
        {
          type: 'query-test',
          agentId: 'agent-alpha',
          action: 'action-one',
          timestamp: '2026-03-18T10:00:00Z'
        },
        {
          type: 'query-test',
          agentId: 'agent-beta',
          action: 'action-two',
          timestamp: '2026-03-18T11:00:00Z'
        },
        {
          type: 'other-type',
          agentId: 'agent-alpha',
          action: 'action-three',
          timestamp: '2026-03-18T12:00:00Z'
        }
      ];
      
      const eventIds = [];
      for (const event of eventsToLog) {
        const id = await lobsterOps.logEvent(event);
        eventIds.push(id);
      }
      
      // Query by type
      const typeResults = await lobsterOps.queryEvents({ eventTypes: ['query-test'] });
      expect(typeResults).toHaveLength(2);
      
      // Query by agentId
      const agentResults = await lobsterOps.queryEvents({ agentIds: ['agent-alpha'] });
      expect(agentResults).toHaveLength(2);
      
      // Query by multiple criteria
      const combinedResults = await lobsterOps.queryEvents({ 
        eventTypes: ['query-test'],
        agentIds: ['agent-alpha']
      });
      expect(combinedResults).toHaveLength(1);
      expect(combinedResults[0].action).toBe('action-one');
    });

    test('should respect limit and offset parameters', async () => {
      // Log 5 events
      for (let i = 0; i < 5; i++) {
        await lobsterOps.logEvent({
          type: 'pagination-test',
          index: i
        });
      }
      
      // Get first 2
      const firstPage = await lobsterOps.queryEvents({
        eventTypes: ['pagination-test'],
        limit: 2,
        offset: 0
      });
      expect(firstPage).toHaveLength(2);
      
      // Get next 2
      const secondPage = await lobsterOps.queryEvents({
        eventTypes: ['pagination-test'],
        limit: 2,
        offset: 2
      });
      expect(secondPage).toHaveLength(2);
      
      // Get last 1
      const thirdPage = await lobsterOps.queryEvents({
        eventTypes: ['pagination-test'],
        limit: 2,
        offset: 4
      });
      expect(thirdPage).toHaveLength(1);
    });

    test('should sort results correctly', async () => {
      // Log events with specific timestamps
      const times = [
        '2026-03-18T10:00:00Z',
        '2026-03-18T12:00:00Z', 
        '2026-03-18T11:00:00Z'
      ];
      
      for (const time of times) {
        await lobsterOps.logEvent({
          type: 'sort-test',
          timestamp: time
        });
      }
      
      // Ascending order
      const ascResults = await lobsterOps.queryEvents({
        eventTypes: ['sort-test'],
        sortBy: 'timestamp',
        sortOrder: 'asc'
      });
      
      expect(ascResults[0].timestamp).toBe('2026-03-18T10:00:00Z');
      expect(ascResults[1].timestamp).toBe('2026-03-18T11:00:00Z');
      expect(ascResults[2].timestamp).toBe('2026-03-18T12:00:00Z');
      
      // Descending order
      const descResults = await lobsterOps.queryEvents({
        eventTypes: ['sort-test'],
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });
      
      expect(descResults[0].timestamp).toBe('2026-03-18T12:00:00Z');
      expect(descResults[1].timestamp).toBe('2026-03-18T11:00:00Z');
      expect(descResults[2].timestamp).toBe('2026-03-18T10:00:00Z');
    });
  });

  describe('Event Updates', () => {
    test('should be able to update an existing event', async () => {
      const event = {
        type: 'update-test',
        status: 'pending',
        progress: 0
      };
      
      const eventId = await lobsterOps.logEvent(event);
      
      // Update the event
      const updateResult = await lobsterOps.updateEvent(eventId, {
        status: 'completed',
        progress: 100,
        result: 'success'
      });
      
      expect(updateResult).toBe(true);
      
      // Verify the update
      const updatedEvent = await lobsterOps.getEvent(eventId);
      expect(updatedEvent.status).toBe('completed');
      expect(updatedEvent.progress).toBe(100);
      expect(updatedEvent.result).toBe('success');
      expect(updatedEvent.updatedAt).toBeDefined();
    });

    test('should return false when updating non-existent event', async () => {
      const result = await lobsterOps.updateEvent('non-existent-id', { 
        status: 'updated' 
      });
      expect(result).toBe(false);
    });
  });

  describe('Event Deletion', () => {
    test('should be able to delete events by criteria', async () => {
      // Log events to delete and keep
      await lobsterOps.logEvent({
        type: 'delete-test',
        agentId: 'to-delete',
        shouldKeep: false
      });
      
      await lobsterOps.logEvent({
        type: 'delete-test',
        agentId: 'to-keep',
        shouldKeep: true
      });
      
      await lobsterOps.logEvent({
        type: 'other-type',
        agentId: 'to-delete',
        shouldKeep: false
      });
      
      // Delete events with agentId: 'to-delete'
      const deletedCount = await lobsterOps.deleteEvents({
        agentIds: ['to-delete']
      });
      
      expect(deletedCount).toBe(2);
      
      // Verify only the keep event remains
      const remainingEvents = await lobsterOps.queryEvents({
        eventTypes: ['delete-test']
      });
      expect(remainingEvents).toHaveLength(1);
      expect(remainingEvents[0].agentId).toBe('to-keep');
    });
  });

  describe('Storage Statistics', () => {
    test('should return accurate storage statistics', async () => {
      // Log some events
      await lobsterOps.logEvent({ type: 'stats-test', count: 1 });
      await lobsterOps.logEvent({ type: 'stats-test', count: 2 });
      
      const stats = await lobsterOps.getStats();
      
      expect(stats.enabled).toBe(true);
      expect(stats.instanceId).toBeDefined();
      expect(stats.storageType).toBe('json');
      expect(stats.backend).toBe('json-file');
      expect(stats.totalEvents).toBeGreaterThanOrEqual(2);
      expect(stats.dataDir).toBe('./test-lobsterops-data');
    });
  });

  describe('Cleanup Functionality', () => {
    test('should be able to cleanup old events', async () => {
      // This test mainly verifies the cleanup method doesn't throw
      // Actual age-based cleanup would require manipulating timestamps
      const initialStats = await lobsterOps.getStats();
      
      const cleanedCount = await lobsterOps.cleanupOld();
      
      const finalStats = await lobsterOps.getStats();
      
      expect(typeof cleanedCount).toBe('number');
      expect(cleanedCount >= 0).toBe(true);
    });
  });
});

describe('Storage Factory', () => {
  test('should create JSON storage by default', () => {
    const storage = StorageFactory.createStorage();
    expect(storage).toBeInstanceOf(JsonFileStorage);
  });

  test('should create memory storage when requested', () => {
    const storage = StorageFactory.createStorage('memory');
    expect(storage).toBeInstanceOf(MemoryStorage);
  });

  test('should throw error for unsupported storage type', () => {
    expect(() => StorageFactory.createStorage('unsupported-type'))
      .toThrow('Unsupported storage type');
  });

  test('should auto-detect storage in test environment', () => {
    process.env.NODE_ENV = 'test';
    const storage = StorageFactory.createAutoStorage();
    expect(storage).toBeInstanceOf(MemoryStorage);
    delete process.env.NODE_ENV;
  });

  test('should respect explicit type over auto-detection', () => {
    process.env.NODE_ENV = 'test';
    const storage = StorageFactory.createAutoStorage({ type: 'json' });
    expect(storage).toBeInstanceOf(JsonFileStorage);
    delete process.env.NODE_ENV;
  });

  test('should list supported storage types', () => {
    const types = StorageFactory.getSupportedTypes();
    expect(types).toContain('json');
    expect(types).toContain('memory');
  });
});