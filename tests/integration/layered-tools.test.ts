// ABOUTME: Integration tests for layered architecture tools
// ABOUTME: Verifies domain, system, and advanced layer tools are properly registered

import { createSceneTools } from '../../src/domain/scenes';
import { createScriptTools } from '../../src/domain/scripts';
import { createHelperTools } from '../../src/domain/helpers';
import { createAreaZoneTools } from '../../src/domain/areas-zones';
import { createDeviceTools } from '../../src/domain/devices';
import { createFloorTools, createLabelTools } from '../../src/domain/floors-labels';
import { createAddonTools } from '../../src/system/addons';
import { createIntegrationTools } from '../../src/system/integrations';
import { createHACSTools } from '../../src/system/hacs';
import { createBackupTools } from '../../src/system/backups';
import { createBulkOperationTools } from '../../src/advanced/bulk-operations';
import { createConfigurationSearchTools } from '../../src/advanced/configuration-search';
import { createAutomationDebuggingTools } from '../../src/advanced/automation-debugging';
import { createAutomationHelperTools } from '../../src/advanced/automation-helpers';
import { MockHAClient } from '../setup';

describe('Layered Architecture Tools', () => {
  let mockClient: MockHAClient;

  beforeEach(() => {
    mockClient = new MockHAClient();
  });

  describe('Domain Layer Tools', () => {
    it('should create scene tools with expected tool names', () => {
      const tools = createSceneTools(mockClient as any);
      expect(tools.list).toBeDefined();
      expect(tools.list.name).toBe('ha_scene_list');
      expect(tools.activate).toBeDefined();
      expect(tools.activate.name).toBe('ha_scene_activate');
    });

    it('should create script tools with expected tool names', () => {
      const tools = createScriptTools(mockClient as any);
      expect(tools.list).toBeDefined();
      expect(tools.execute).toBeDefined();
      expect(tools.execute.name).toBe('ha_script_execute');
    });

    it('should create helper tools with expected tool names', () => {
      const tools = createHelperTools(mockClient as any);
      expect(tools.list).toBeDefined();
      expect(tools.create_boolean).toBeDefined();
      expect(tools.create_number).toBeDefined();
    });

    it('should create area/zone tools with expected tool names', () => {
      const tools = createAreaZoneTools(mockClient as any);
      expect(tools.area_list).toBeDefined();
      expect(tools.zone_list).toBeDefined();
      expect(tools.zone_create.name).toBe('ha_zone_create');
    });

    it('should create device tools with expected tool names', () => {
      const tools = createDeviceTools(mockClient as any);
      expect(tools.device_list).toBeDefined();
      expect(tools.device_get).toBeDefined();
      expect(tools.device_list.name).toBe('ha_device_list');
    });
  });

  describe('System Layer Tools', () => {
    it('should create addon tools with expected tool names', () => {
      const tools = createAddonTools(mockClient as any);
      expect(tools.list).toBeDefined();
      expect(tools.start).toBeDefined();
      expect(tools.stop).toBeDefined();
      expect(tools.list.name).toBe('ha_addon_list');
    });

    it('should create integration tools with expected tool names', () => {
      const tools = createIntegrationTools(mockClient as any);
      expect(tools.list).toBeDefined();
      expect(tools.setup).toBeDefined();
      expect(tools.list.name).toBe('ha_integration_list');
    });

    it('should create HACS tools with expected tool names', () => {
      const tools = createHACSTools(mockClient as any);
      expect(tools.repositories).toBeDefined();
      expect(tools.install).toBeDefined();
      expect(tools.repositories.name).toBe('ha_hacs_repositories');
    });

    it('should create backup tools with expected tool names', () => {
      const tools = createBackupTools(mockClient as any);
      expect(tools.list).toBeDefined();
      expect(tools.create).toBeDefined();
      expect(tools.restore).toBeDefined();
      expect(tools.list.name).toBe('ha_backup_list');
    });
  });

  describe('Advanced Layer Tools', () => {
    it('should create bulk operation tools with expected tool names', () => {
      const tools = createBulkOperationTools(mockClient as any);
      expect(tools.bulk_service_call).toBeDefined();
      expect(tools.bulk_turn_on).toBeDefined();
      expect(tools.bulk_turn_off).toBeDefined();
      expect(tools.bulk_service_call.name).toBe('ha_bulk_service_call');
    });

    it('should create configuration search tools with expected tool names', () => {
      const tools = createConfigurationSearchTools(mockClient as any);
      // Note: search_entities was removed from advanced layer (now only in tools/search.ts)
      expect(tools.search_services).toBeDefined();
      expect(tools.search_automations).toBeDefined();
      expect(tools.search_config).toBeDefined();
    });

    it('should create automation debugging tools with expected tool names', () => {
      const tools = createAutomationDebuggingTools(mockClient as any);
      expect(tools.get_trace).toBeDefined();
      expect(tools.list_traces).toBeDefined();
      expect(tools.get_diagnostics).toBeDefined();
      expect(tools.get_trace.name).toBe('ha_automation_get_trace');
    });

    it('should create automation helper tools with expected tool names', () => {
      const tools = createAutomationHelperTools(mockClient as any);
      expect(tools.validate).toBeDefined();
      expect(tools.test_condition).toBeDefined();
      expect(tools.generate_template).toBeDefined();
      expect(tools.validate.name).toBe('ha_automation_validate');
    });
  });

  describe('Tool Count Verification', () => {
    it('should have correct total tool count across all layers', () => {
      const domainToolCount =
        Object.keys(createSceneTools(mockClient as any)).length +
        Object.keys(createScriptTools(mockClient as any)).length +
        Object.keys(createHelperTools(mockClient as any)).length +
        Object.keys(createAreaZoneTools(mockClient as any)).length +
        Object.keys(createDeviceTools(mockClient as any)).length +
        Object.keys(createFloorTools(mockClient as any)).length +
        Object.keys(createLabelTools(mockClient as any)).length;

      const systemToolCount =
        Object.keys(createAddonTools(mockClient as any)).length +
        Object.keys(createIntegrationTools(mockClient as any)).length +
        Object.keys(createHACSTools(mockClient as any)).length +
        Object.keys(createBackupTools(mockClient as any)).length;

      const advancedToolCount =
        Object.keys(createBulkOperationTools(mockClient as any)).length +
        Object.keys(createConfigurationSearchTools(mockClient as any)).length +
        Object.keys(createAutomationDebuggingTools(mockClient as any)).length +
        Object.keys(createAutomationHelperTools(mockClient as any)).length;

      // Domain: 34 base + 5 floor tools + 7 label tools = 46
      expect(domainToolCount).toBe(46);
      expect(systemToolCount).toBe(26);
      // Advanced: 12 (search_entities was removed in v2.5.0)
      expect(advancedToolCount).toBe(12);
      expect(domainToolCount + systemToolCount + advancedToolCount).toBe(84);
    });
  });
});
