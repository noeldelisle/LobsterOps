// LobsterOps Usage Example
// ========================
//
// This example demonstrates basic usage of LobsterOps for AI agent observability.

const { LobsterOps } = require('./src/core/LobsterOps');

async function runExample() {
  console.log('🦞 LobsterOps Usage Example');
  console.log('====================');
  
  // Create a LobsterOps instance
  // Using SQLite storage - lightweight, file-based, works everywhere
  const ops = new LobsterOps({
    storageType: 'sqlite',           // Options: 'json', 'memory', 'sqlite', 'supabase' (coming soon)
    storageConfig: {
      filename: './example-lobsterops.db' // SQLite database file
    },
    instanceId: 'example-agent-001' // Optional: custom instance ID
  });
  
  try {
    // Initialize LobsterOps and storage backend
    await ops.init();
    console.log('✅ LobsterOps initialized');
    
    // Simulate logging various agent events
    console.log('\n📝 Logging agent events...');
    
    // 1. Agent startup event
    const startupEventId = await ops.logEvent({
      type: 'agent-lifecycle',
      agentId: 'research-agent-alpha',
      action: 'startup',
      status: 'healthy',
      version: '1.2.3',
      environment: 'production'
    });
    console.log(`   Startup event logged: ${startupEventId}`);
    
    // 2. Tool usage event
    const toolEventId = await ops.logEvent({
      type: 'tool-usage',
      agentId: 'research-agent-alpha',
      toolName: 'web-search',
      toolInput: { query: 'latest AI agent frameworks 2026' },
      toolOutput: { results: 15, timeMs: 1200 },
      durationMs: 1250,
      success: true
    });
    console.log(`   Tool usage event logged: ${toolEventId}`);
    
    // 3. Decision making event
    const decisionEventId = await ops.logEvent({
      type: 'agent-decision',
      agentId: 'research-agent-alpha',
      decision: 'proceed-with-research',
      confidence: 0.87,
      alternativesConsidered: ['wait-for-more-data', 'escalate-to-human'],
      reasoning: 'Sufficient data quality and relevance achieved',
      contextTokens: 2450,
      responseTokens: 320
    });
    console.log(`   Decision event logged: ${decisionEventId}`);
    
    // 4. Error event (for demonstration)
    const errorEventId = await ops.logEvent({
      type: 'agent-error',
      agentId: 'research-agent-alpha',
      errorType: 'TimeoutError',
      errorMessage: 'API request to external service timed out',
      severity: 'medium',
      retryCount: 2,
      recovered: true
    });
    console.log(`   Error event logged: ${errorEventId}`);
    
    console.log('\n🔍 Querying and analyzing events...');
    
    // Query all events for our agent
    const agentEvents = await ops.queryEvents({
      agentIds: ['research-agent-alpha'],
      limit: 10
    });
    console.log(`   Found ${agentEvents.length} events for research-agent-alpha`);
    
    // Query just tool usage events
    const toolEvents = await ops.queryEvents({
      eventTypes: ['tool-usage'],
      agentIds: ['research-agent-alpha']
    });
    console.log(`   Found ${toolEvents.length} tool usage events`);
    
    // Query events from the last hour (assuming recent timestamps)
    const recentEvents = await ops.queryEvents({
      limit: 20
    });
    console.log(`   Found ${recentEvents.length} recent events`);
    
    // Get a specific event by ID
    const specificEvent = await ops.getEvent(startupEventId);
    if (specificEvent) {
      console.log(`\n🎯 Specific event details:`);
      console.log(`   Type: ${specificEvent.type}`);
      console.log(`   Agent: ${specificEvent.agentId}`);
      console.log(`   Action: ${specificEvent.action}`);
      console.log(`   Time: ${specificEvent.timestamp}`);
    }
    
    // Update an event (add resolution info to error)
    await ops.updateEvent(errorEventId, {
      resolved: true,
      resolutionTime: new Date().toISOString(),
      resolutionNotes: 'Implemented exponential backoff retry strategy'
    });
    console.log(`\n🔄 Updated error event with resolution info`);
    
    // Get storage statistics
    const stats = await ops.getStats();
    console.log(`\n📊 Storage Statistics:`);
    console.log(`   Backend: ${stats.backend}`);
    console.log(`   Total Events: ${stats.eventCount || 0}`);
    console.log(`   Database File: ${stats.filename}`);
    console.log(`   Database Size: ${stats.databaseSizeMB} MB`);
    console.log(`   Instance ID: ${stats.instanceId}`);
    
    console.log(`\n✅ Example completed successfully!`);
    console.log(`💡 Try checking the './example-lobsterops.db' SQLite database file.`);
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  } finally {
    // Always cleanup resources
    await ops.close();
    console.log('🔚 LobsterOps closed');
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

module.exports = { runExample };