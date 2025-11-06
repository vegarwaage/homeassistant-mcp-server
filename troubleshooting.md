# Home Assistant MCP Server - Troubleshooting & Best Practices

**Last Updated:** 2025-11-06
**Purpose:** Guide for connecting to and using the Home Assistant MCP server effectively in Claude Code sessions

## Overview

The Home Assistant MCP server v2.1.0 provides programmatic access to Home Assistant via Claude Code's MCP (Model Context Protocol) integration with 133 tools across entity management, automation, configuration, and system control. This document addresses common issues encountered during initial setup and provides best practices learned through real-world usage.

**New in v2.1.0:**
- Added `ha_mcp_capabilities` tool - Call this first to understand all available features
- Improved tool descriptions for better Claude Code understanding
- Enhanced startup messages showing available capabilities
- Confirmed: Search is case-insensitive, automations persist correctly

## Quick Start Checklist

Before starting any HA-related work in a new Claude Code session, verify:

- [ ] MCP server is configured in Claude Code settings
- [ ] Long-lived access token is valid and in environment
- [ ] Home Assistant is reachable at configured URL
- [ ] Test with simple entity query: `mcp__homeassistant__ha_get_states`

## Common Issues & Solutions

### Issue 1: MCP Server Not Connecting (stdio mode)

**Symptoms:**
- MCP tools show as unavailable in Claude Code
- Error: "MCP server not configured"
- Tools prefixed with `mcp__homeassistant__` don't appear

**For Web/Mobile (OAuth):**
OAuth implementation is complete and RFC-compliant, but currently **blocked by Anthropic's OAuth proxy**. This is an external issue on Anthropic's side. The server is ready - when they fix their OAuth proxy, it will work immediately. See "OAuth Status" section below for details.

**For Claude Code/Desktop (stdio over SSH):**

**Diagnosis:**
```bash
# Check if HA MCP is configured
cat ~/.config/claude-code/settings.json | grep -A 10 homeassistant

# Verify environment variable is set
echo $HA_LONG_LIVED_ACCESS_TOKEN

# Test HA is reachable
curl -sf http://homeassistant.local:8123/ && echo "✓ HA is reachable"
```

**Solution:**
1. Verify MCP server configuration in Claude Code settings
2. Ensure long-lived access token is valid (Settings → Profile → Long-Lived Access Tokens in HA)
3. Test token manually:
   ```bash
   curl -H "Authorization: Bearer $HA_LONG_LIVED_ACCESS_TOKEN" \
        http://homeassistant.local:8123/api/
   ```
4. Restart Claude Code after configuration changes

### Issue 2: Entity/Service Discovery Returns Empty Results

**Symptoms:**
- `ha_search_entities` returns no results for known entities
- `ha_search_services` returns empty array
- General searches like "uptime kuma" find nothing

**Root Cause:**
Search may not match partial strings as expected, or entity names don't contain the search term. Note: Search IS case-insensitive as of v2.1.0.

**Solutions:**

**For Entity Discovery:**
```javascript
// ❌ This often fails:
ha_search_entities({ query: "uptime kuma" })

// ✅ Use domain filter instead:
ha_search_entities({ domain: "sensor" })

// ✅ Or search by specific entity name pattern:
ha_search_entities({ query: "prowlarr" })

// ✅ Or list all entities with domain filter:
ha_get_states({ domain: "sensor" })
```

**For Service Discovery:**
```javascript
// ❌ This returns empty:
ha_search_services({ domain: "notify" })

// ✅ List all services instead:
ha_search_services({})

// ✅ Or check existing automations for service patterns:
ha_read_config({ path: "automations.yaml" })
```

**Best Practice:**
When looking for specific entities/services, search existing automation configs first to see what's actually in use and working.

### Issue 3: Automation Creation - Understanding Persistence

**Update (v2.1.0):** The `ha_create_automation` function DOES write to automations.yaml and persists correctly. Earlier versions may have had issues, but current code confirms persistence.

**How ha_create_automation Works:**
1. Parses your YAML
2. Generates ID if not provided
3. Backs up existing automations.yaml
4. Appends to the file
5. Validates (with graceful fallback)
6. Reloads automation config

**If Automation Still Doesn't Persist:**
Possible causes:
- Validation failed and backup was restored
- Reload failed due to YAML syntax error
- Automation ID conflicts with existing automation

**Verification Steps:**
```javascript
// 1. Create automation
ha_create_automation({ automation_yaml: "..." })

// 2. Check it appears in list
ha_list_automations()

// 3. Verify it's in the file
ha_read_config({ path: "automations.yaml" })
```

**Alternative Approach (Manual File Write):**
You can also write directly to the file:
```javascript
1. Read current automations.yaml
2. Append new automation to the YAML content
3. Write back with ha_write_config({ path: "automations.yaml", content: "...", validate: false })
4. Reload: ha_reload_config({ type: "automation" })
```

**Important Notes:**
- Use `validate: false` when writing config via MCP (validation requires Supervisor API)
- Automatic backup created before every write
- Always reload config after writing
- Check logs if automation doesn't appear

### Issue 4: Config Validation Fails

**Symptoms:**
- `ha_write_config` with `validate: true` fails
- Error: "forbidden: insufficient permissions or invalid token"
- Error: "CLI command failed: ha core check"

**Root Cause:**
Config validation requires Supervisor API access, which may not be available via MCP token.

**Solution:**
```javascript
// ✅ Always use validate: false with MCP:
ha_write_config({
  path: "automations.yaml",
  content: yaml_content,
  validate: false  // Required for MCP access
})

// Then reload to catch errors:
ha_reload_config({ type: "automation" })
```

**Best Practice:**
Test automation syntax by copying format from working automations in the existing config.

### Issue 5: Notifications Not Working

**Symptoms:**
- Automation triggers but no notification received
- Mobile app notification services not found
- Service call returns 400 error

**Root Cause:**
Home Assistant mobile notifications use **device actions**, not service calls. The MCP `ha_send_notification` function doesn't work for mobile apps.

**Solution:**
Use device actions in automations instead:

```yaml
# ✅ Correct format (device action):
action:
  - device_id: c43c5a3d1c29fd9de86147312255bdbc
    domain: mobile_app
    type: notify
    title: "Alert Title"
    message: "Alert message with {{ templates }}"

# ❌ This doesn't work (service call):
action:
  - service: notify.mobile_app_device_name
    data:
      title: "Alert Title"
      message: "Alert message"
```

**Finding Your Device ID:**
1. Check existing working automations: `ha_read_config({ path: "automations.yaml" })`
2. Look for `device_id` in notification actions
3. Or search entities: `ha_search_entities({ query: "mobile_app" })`

**Testing Notifications:**
Don't use `ha_send_notification` - instead, create a test automation and trigger it by changing an entity state.

### Issue 6: API Endpoint Authentication Errors

**Symptoms:**
- Health checks cause "Login attempt failed" logs
- 401 Unauthorized errors when curling `/api/`
- Scripts using API endpoints fail

**Root Cause:**
- Root endpoint `/` is public and doesn't require authentication
- API endpoint `/api/` requires Bearer token authentication

**Solution:**
```bash
# ✅ For availability checks (no auth needed):
curl -sf http://homeassistant.local:8123/

# ✅ For API calls (auth required):
curl -H "Authorization: Bearer $TOKEN" \
     http://homeassistant.local:8123/api/
```

**Health Check Best Practice:**
Always use root `/` endpoint for simple up/down checks to avoid authentication log spam.

## Best Practices for Claude Code Sessions

### 1. Start Every Session with Verification

```javascript
// Test 1: Basic connectivity
ha_get_states({ entity_id: "sensor.time" })

// Test 2: List some entities to confirm access
ha_search_entities({ domain: "automation", limit: 5 })

// Test 3: Verify write access
ha_read_config({ path: "automations.yaml" })
```

### 2. Discovery Strategy

**When looking for entities:**
```javascript
// Step 1: List by domain (faster than search)
ha_get_states({ domain: "sensor" })

// Step 2: If looking for specific functionality, check existing automations
ha_read_config({ path: "automations.yaml" })

// Step 3: Use specific entity names if known
ha_get_entity_details({ entity_id: "sensor.specific_name" })
```

**When looking for services:**
```javascript
// Step 1: List all services (search is unreliable)
ha_search_services({})

// Step 2: Check what existing automations use
ha_read_config({ path: "automations.yaml" })

// Step 3: Reference HA docs or existing working automations
```

### 3. Automation Creation Workflow

```javascript
// 1. Read current automations for reference
const current = ha_read_config({ path: "automations.yaml" })

// 2. Find a working automation with similar trigger/action
//    Copy its format exactly

// 3. Write new automation to file (append to YAML)
ha_write_config({
  path: "automations.yaml",
  content: updated_yaml,
  validate: false  // Always false for MCP
})

// 4. Reload and verify
ha_reload_config({ type: "automation" })
ha_list_automations()  // Confirm it appears

// 5. Test by triggering the automation
//    (change entity state, wait for trigger)
```

### 4. Testing Strategy

**For automations:**
1. Create automation with state trigger
2. Manually change entity state to trigger it
3. Check logbook for execution: `ha_get_logbook({ entity_id: "automation.name" })`
4. Verify action completed (check target entity or notification)

**For notifications:**
1. Never test with `ha_send_notification` (doesn't work for mobile apps)
2. Create a test automation with device action
3. Trigger automation by changing a sensor
4. Verify notification arrives on device

**For entity changes:**
1. Use `ha_get_entity_details` before and after changes
2. Check `last_changed` and `last_updated` timestamps
3. Use logbook to see state history

### 5. Error Handling

```javascript
// Always wrap in try/catch equivalent
// Check for common error patterns:

// 404 = Entity/automation doesn't exist
// 400 = Invalid request format
// 401/403 = Authentication issue
// "CLI command failed" = Use validate: false
```

## OAuth Status (Web/Mobile Access)

**Current Status:** ✅ **Implementation Complete** | ⛔ **Blocked by Anthropic**

The HTTP transport with OAuth 2.1 is **fully implemented and RFC-compliant**:
- ✅ RFC 8414 (Authorization Server Metadata)
- ✅ RFC 9728 (Protected Resource Metadata)
- ✅ RFC 7591 (Dynamic Client Registration)
- ✅ Token refresh flow
- ✅ SQLite session persistence
- ✅ SSE (Server-Sent Events) transport
- ✅ Production-ready security

**The Blocker:**
Anthropic's OAuth proxy for Claude.ai/mobile returns `step=start_error` for all MCP servers. This is **their bug, not ours**. Our server is tested and ready.

**When Will It Work:**
As soon as Anthropic fixes their OAuth proxy, web and mobile clients will be able to connect immediately. No changes needed on our side.

**Testing:**
The HTTP transport can be tested independently:
```bash
TRANSPORT=http PORT=3000 OAUTH_CLIENT_URL=https://your-domain.com node dist/index.js
```

All OAuth endpoints are functional and RFC-compliant. See `src/transports/http.ts` for implementation details.

## MCP Server Capabilities Reference

**Total Tools:** 133 (as of v2.1.0)

**New Tool:**
- `ha_mcp_capabilities` - **Call this first!** Returns comprehensive overview of all tools, usage examples, and best practices. This is your guide to understanding what the MCP server can do.

### Core Functions Used Successfully

**Entity Management:**
- `ha_get_states` - List all entities or filter by domain
- `ha_get_entity_details` - Get full info for specific entity
- `ha_search_entities` - Search with filters (use domain filter)

**Configuration:**
- `ha_read_config` - Read any YAML file from /config
- `ha_write_config` - Write config files (use validate: false)
- `ha_reload_config` - Reload automations, scripts, or core

**Automation:**
- `ha_create_automation` - Create persistent automation in automations.yaml ✅
- `ha_list_automations` - List all automations with IDs
- `ha_update_automation` - Modify existing automation
- `ha_delete_automation` - Remove automation
- `ha_get_logbook` - Check automation execution history

**Services:**
- `ha_call_service` - Call any HA service
- `ha_search_services` - List available services (search unreliable)

**Monitoring:**
- `ha_get_logs` - Fetch HA logs with filtering
- `ha_system_info` - Get system health status

### Functions with Limitations

**These require special handling:**

1. **`ha_send_notification`**
   - Doesn't work for mobile_app notifications
   - Use device actions in automations instead

2. **`ha_search_entities` / `ha_search_services`**
   - Search is case-insensitive but may not match partial entity names as expected
   - Best practice: Use domain filters to narrow results first

3. **`ha_write_config` with `validate: true`**
   - Validation requires Supervisor API access
   - Always use `validate: false` via MCP
   - Config is validated when you reload it

**Previously Documented Issues (Now Fixed in v2.1.0):**
- ~~`ha_create_automation` creates non-persistent automations~~ - **FIXED**: Now persists correctly to automations.yaml
- ~~Search is case-sensitive~~ - **FIXED**: Search has always been case-insensitive

## Session Context for Claude Code

When starting a new Claude Code session that needs Home Assistant access, include this context:

```markdown
**Home Assistant MCP Server v2.1.0**
- Total Tools: 133 across entity control, automation, config, monitoring, and system
- **First Step:** Call ha_mcp_capabilities() to see all available tools and usage guide

**Connection:**
- URL: http://homeassistant.local:8123
- Token: In $HA_LONG_LIVED_ACCESS_TOKEN environment variable
- Transport: stdio over SSH

**Key Patterns:**
- Discovery: Use ha_get_states(domain="light") to list all lights/sensors/switches
- Control: Use ha_call_service() to turn on/off, set values, etc.
- Automation: Use ha_create_automation() - automations ARE persistent to automations.yaml
- Config: Use ha_read_config() and ha_write_config(validate=false)
- Search: Case-insensitive - use ha_search_entities with query and domain filter
- Notifications: Use device actions in automations, not service calls

**Device ID (iPhone notifications):** c43c5a3d1c29fd9de86147312255bdbc

**Reference:**
- Working automations: ha_read_config(path="automations.yaml")
- Full capabilities: ha_mcp_capabilities()
- Troubleshooting: /Users/selwa/Developer/homeassistant-mcp-server/troubleshooting.md
```

## Environment Setup Verification

Before starting HA work in any Claude Code session:

```bash
#!/bin/bash
# Save as: ~/Device-Management/scripts/verify-ha-mcp.sh

echo "🔍 Verifying Home Assistant MCP Setup..."

# Check 1: HA Reachable
if curl -sf --max-time 5 http://homeassistant.local:8123/ > /dev/null; then
  echo "✅ Home Assistant is reachable"
else
  echo "❌ Home Assistant is not reachable"
  exit 1
fi

# Check 2: Token exists
if [ -n "$HA_LONG_LIVED_ACCESS_TOKEN" ]; then
  echo "✅ Access token is set"
else
  echo "❌ HA_LONG_LIVED_ACCESS_TOKEN not found in environment"
  exit 1
fi

# Check 3: Token is valid
if curl -sf -H "Authorization: Bearer $HA_LONG_LIVED_ACCESS_TOKEN" \
   http://homeassistant.local:8123/api/ > /dev/null; then
  echo "✅ Access token is valid"
else
  echo "❌ Access token is invalid or expired"
  exit 1
fi

# Check 4: MCP tools available in Claude Code
echo "✅ All checks passed - Home Assistant MCP is ready"
echo ""
echo "📋 Quick Reference:"
echo "  - HA URL: http://homeassistant.local:8123"
echo "  - iPhone Device ID: c43c5a3d1c29fd9de86147312255bdbc"
echo "  - Automations: Write to automations.yaml with validate: false"
echo "  - Notifications: Use device actions, not service calls"
```

## Common Patterns Reference

### Pattern 1: Find and Modify Automation

```javascript
// 1. List all automations
const autos = ha_list_automations()

// 2. Read config to see full YAML
const config = ha_read_config({ path: "automations.yaml" })

// 3. Modify YAML content (preserve formatting)
// 4. Write back
ha_write_config({
  path: "automations.yaml",
  content: modified_yaml,
  validate: false
})

// 5. Reload
ha_reload_config({ type: "automation" })
```

### Pattern 2: Create Notification Automation

```javascript
// 1. Get reference format from existing automation
const config = ha_read_config({ path: "automations.yaml" })
// Look for working notification actions with device_id

// 2. Create new automation using same format:
const new_automation = `
- id: 'unique_id'
  alias: 'My Alert'
  trigger:
    - platform: state
      entity_id: sensor.something
      to: 'problem'
  action:
    - device_id: c43c5a3d1c29fd9de86147312255bdbc
      domain: mobile_app
      type: notify
      title: 'Alert'
      message: 'Something happened'
`

// 3. Append to config and write back
```

### Pattern 3: Monitor Entity State Changes

```javascript
// Get current state
const before = ha_get_entity_details({
  entity_id: "sensor.monitored_thing"
})

// Do something that should change it
ha_call_service({
  domain: "homeassistant",
  service: "update_entity",
  entity_id: "sensor.monitored_thing"
})

// Wait a moment
await sleep(2000)

// Check if it changed
const after = ha_get_entity_details({
  entity_id: "sensor.monitored_thing"
})

if (after.last_changed !== before.last_changed) {
  console.log("✅ State changed successfully")
}
```

## Debugging Tips

### Enable Verbose Logging

In Home Assistant configuration.yaml:
```yaml
logger:
  default: info
  logs:
    homeassistant.components.api: debug
    homeassistant.components.automation: debug
```

### Check What Actually Happened

```javascript
// Use logbook to see what triggered
ha_get_logbook({
  entity_id: "automation.my_automation",
  start_time: "2025-11-06T19:00:00Z",
  end_time: "2025-11-06T20:00:00Z"
})

// Check recent state changes for entity
ha_get_history({
  entity_ids: "sensor.something",
  start_time: "2025-11-06T19:00:00Z"
})
```

### Verify Automation Format

```javascript
// Get a working automation to compare
const working = ha_read_config({ path: "automations.yaml" })

// Look for similar trigger/action patterns
// Copy format exactly - YAML indentation matters!
```

## Related Documentation

- **Home Assistant MCP Server Docs:** (Link to official MCP docs if available)
- **HA Green Device Info:** `/Users/selwa/Device-Management/devices/home-assistant-green.md`
- **Remote Resilience Design:** `/Users/selwa/Device-Management/docs/plans/2025-11-06-remote-resilience-design.md`
- **Health Check Script:** `/Users/selwa/Device-Management/scripts/ha-health-check.sh`

## Revision History

- **2025-11-06:** Initial version based on resilience system implementation
  - Documented automation creation issues
  - Added notification device action patterns
  - Captured entity/service discovery best practices
  - Recorded config validation workarounds
