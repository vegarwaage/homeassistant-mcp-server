#!/usr/bin/env node
// ABOUTME: Manual test script to verify v2.0.0 tool registration
// ABOUTME: Validates tool counts and names for all layers

const { createSceneTools } = require('./dist/domain/scenes.js');
const { createScriptTools } = require('./dist/domain/scripts.js');
const { createHelperTools } = require('./dist/domain/helpers.js');
const { createAreaZoneTools } = require('./dist/domain/areas-zones.js');
const { createDeviceTools } = require('./dist/domain/devices.js');

const { createAddonTools } = require('./dist/system/addons.js');
const { createIntegrationTools } = require('./dist/system/integrations.js');
const { createHACSTools } = require('./dist/system/hacs.js');
const { createBackupTools } = require('./dist/system/backups.js');

const { createBulkOperationTools } = require('./dist/advanced/bulk-operations.js');
const { createConfigurationSearchTools } = require('./dist/advanced/configuration-search.js');
const { createAutomationDebuggingTools } = require('./dist/advanced/automation-debugging.js');
const { createAutomationHelperTools } = require('./dist/advanced/automation-helpers.js');

// Mock client for testing
const mockClient = {
  baseUrl: 'http://test',
  token: 'test-token',
  get: () => Promise.resolve([]),
  post: () => Promise.resolve({}),
  delete: () => Promise.resolve({}),
  patch: () => Promise.resolve({})
};

console.log('🧪 Testing Home Assistant MCP Server v2.0.0\n');
console.log('=' .repeat(60));

try {
  // Test Domain Layer
  console.log('\n📦 DOMAIN LAYER - Entity Management');
  console.log('-'.repeat(60));

  const sceneTools = createSceneTools(mockClient);
  console.log(`✓ Scenes: ${Object.keys(sceneTools).length} tools`);
  console.log(`  Tools: ${Object.keys(sceneTools).join(', ')}`);

  const scriptTools = createScriptTools(mockClient);
  console.log(`✓ Scripts: ${Object.keys(scriptTools).length} tools`);
  console.log(`  Tools: ${Object.keys(scriptTools).join(', ')}`);

  const helperTools = createHelperTools(mockClient);
  console.log(`✓ Helpers: ${Object.keys(helperTools).length} tools`);
  console.log(`  Tools: ${Object.keys(helperTools).join(', ')}`);

  const areaZoneTools = createAreaZoneTools(mockClient);
  console.log(`✓ Areas & Zones: ${Object.keys(areaZoneTools).length} tools`);
  console.log(`  Tools: ${Object.keys(areaZoneTools).join(', ')}`);

  const deviceTools = createDeviceTools(mockClient);
  console.log(`✓ Devices: ${Object.keys(deviceTools).length} tools`);
  console.log(`  Tools: ${Object.keys(deviceTools).join(', ')}`);

  const domainCount = Object.keys(sceneTools).length +
                     Object.keys(scriptTools).length +
                     Object.keys(helperTools).length +
                     Object.keys(areaZoneTools).length +
                     Object.keys(deviceTools).length;

  console.log(`\n  Total Domain Layer: ${domainCount} tools`);

  // Test System Layer
  console.log('\n🔧 SYSTEM LAYER - Lifecycle Management');
  console.log('-'.repeat(60));

  const addonTools = createAddonTools(mockClient);
  console.log(`✓ Add-ons: ${Object.keys(addonTools).length} tools`);
  console.log(`  Tools: ${Object.keys(addonTools).join(', ')}`);

  const integrationTools = createIntegrationTools(mockClient);
  console.log(`✓ Integrations: ${Object.keys(integrationTools).length} tools`);
  console.log(`  Tools: ${Object.keys(integrationTools).join(', ')}`);

  const hacsTools = createHACSTools(mockClient);
  console.log(`✓ HACS: ${Object.keys(hacsTools).length} tools`);
  console.log(`  Tools: ${Object.keys(hacsTools).join(', ')}`);

  const backupTools = createBackupTools(mockClient);
  console.log(`✓ Backups: ${Object.keys(backupTools).length} tools`);
  console.log(`  Tools: ${Object.keys(backupTools).join(', ')}`);

  const systemCount = Object.keys(addonTools).length +
                     Object.keys(integrationTools).length +
                     Object.keys(hacsTools).length +
                     Object.keys(backupTools).length;

  console.log(`\n  Total System Layer: ${systemCount} tools`);

  // Test Advanced Layer
  console.log('\n⚡ ADVANCED LAYER - Power User Features');
  console.log('-'.repeat(60));

  const bulkTools = createBulkOperationTools(mockClient);
  console.log(`✓ Bulk Operations: ${Object.keys(bulkTools).length} tools`);
  console.log(`  Tools: ${Object.keys(bulkTools).join(', ')}`);

  const searchTools = createConfigurationSearchTools(mockClient);
  console.log(`✓ Configuration Search: ${Object.keys(searchTools).length} tools`);
  console.log(`  Tools: ${Object.keys(searchTools).join(', ')}`);

  const debugTools = createAutomationDebuggingTools(mockClient);
  console.log(`✓ Automation Debugging: ${Object.keys(debugTools).length} tools`);
  console.log(`  Tools: ${Object.keys(debugTools).join(', ')}`);

  const helperAdvTools = createAutomationHelperTools(mockClient);
  console.log(`✓ Automation Helpers: ${Object.keys(helperAdvTools).length} tools`);
  console.log(`  Tools: ${Object.keys(helperAdvTools).join(', ')}`);

  const advancedCount = Object.keys(bulkTools).length +
                       Object.keys(searchTools).length +
                       Object.keys(debugTools).length +
                       Object.keys(helperAdvTools).length;

  console.log(`\n  Total Advanced Layer: ${advancedCount} tools`);

  // Summary
  const totalNew = domainCount + systemCount + advancedCount;

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Domain Layer:   ${domainCount} tools (expected: 34)`);
  console.log(`System Layer:   ${systemCount} tools (expected: 26)`);
  console.log(`Advanced Layer: ${advancedCount} tools (expected: 13)`);
  console.log(`${'Total New:'.padEnd(15)} ${totalNew} tools (expected: 73)`);

  // Verification
  console.log('\n' + '='.repeat(60));
  if (domainCount === 34 && systemCount === 26 && advancedCount === 13) {
    console.log('✅ SUCCESS: All tool counts match expected values!');
    console.log('✅ v2.0.0 layered architecture is working correctly');
    process.exit(0);
  } else {
    console.log('❌ ERROR: Tool counts do not match expected values');
    console.log(`   Domain: got ${domainCount}, expected 34`);
    console.log(`   System: got ${systemCount}, expected 26`);
    console.log(`   Advanced: got ${advancedCount}, expected 13`);
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ ERROR during testing:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
