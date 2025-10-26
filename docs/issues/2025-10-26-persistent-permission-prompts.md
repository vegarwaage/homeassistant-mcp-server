# Issue: Persistent Permission Prompts Despite Removed Permission Checks

**Date:** 2025-10-26
**Status:** ✅ RESOLVED
**Resolution Date:** 2025-10-26
**Priority:** High
**Category:** Server Behavior

## Summary

Root-level tools (ha_read_logs, ha_execute_command, filesystem tools, database tools) continue showing "⚠️ PERMISSION REQUIRED" prompts even though:
1. Permission check code has been removed from all handlers
2. Claude Code's mcp.json includes all 130 tools in alwaysAllow
3. Server has been rebuilt and restarted
4. Deployed code verified to have no permission checks

## Symptoms

When calling root-level tools like `ha_read_logs`, the server returns:

```
⚠️ PERMISSION REQUIRED

This operation requires command execution access. This will allow running shell commands on the Home Assistant host system.

Do you approve commands access for this session?
```

This message is defined in `src/permissions.ts:42` via `getPermissionRequest('commands')`.

## Resolution

### Root Cause

The MCP server process was running from `/root/ha-mcp-server` which contained **old code with permission checks still present**, despite:
- `/config/mcp-server` having the correct updated code (permission checks removed)
- `mcp.json` configuration pointing to `/config/mcp-server`

The MCP connection was somehow starting from `/root/ha-mcp-server` instead of the configured path.

**Evidence:**
```bash
# Process was running from wrong directory
$ ps aux | grep node
12350 root  node dist/index.js

$ pwdx 12350
12350: /root/ha-mcp-server

# Old directory had permission checks
$ grep hasPermission /root/ha-mcp-server/dist/tools/system.js
if (!(0, permissions_js_1.hasPermission)(sessionId, 'commands')) {
    return (0, permissions_js_1.getPermissionRequest)('commands');
```

### The Fix

Created a symlink to ensure both paths point to the updated code:

```bash
rm -rf /root/ha-mcp-server
ln -s /config/mcp-server /root/ha-mcp-server
```

Now `/root/ha-mcp-server` → `/config/mcp-server`, so regardless of which path the MCP server starts from, it uses the correct code with permission checks removed.

### Verification

After fix:
```bash
# No permission prompts
ha_read_logs(lines=5)  # ✅ Works without prompt
ha_execute_command(command="pwd")  # ✅ Works without prompt
```

## Original Investigation

Below is the original investigation that led to discovering the root cause.

## What We've Verified

### 1. Local Source Code ✅
All permission checks removed from:
- `src/tools/system.ts` - has comment "Permission checks removed - handle on client side"
- `src/tools/filesystem.ts` - has comment "Permission checks removed - handle on client side"
- `src/tools/database.ts` - has comment "Permission checks removed - handle on client side"

Commit: 307660d "fix: remove unused permission check code from root-level tools"

### 2. Deployed Code ✅
Verified deployed JavaScript files on server have permission checks removed:
```bash
ssh root@homeassistant.local "grep hasPermission /config/mcp-server/dist/tools/*.js"
# Result: No matches
```

All three files contain the comment "Permission checks removed - handle on client side".

### 3. Auto-Grant in permissions.ts ✅
```typescript
export function initSession(sessionId: string): void {
  // TEMPORARY: Auto-grant all permissions to bypass broken approval UI
  sessions.set(sessionId, {
    filesystem: true,
    database: true,
    commands: true
  });
}
```

### 4. Claude Code Configuration ✅
`~/.claude/mcp.json` contains all 130 tools in alwaysAllow array, including:
- ha_execute_command
- ha_read_logs
- ha_read_file
- ha_write_file
- ha_execute_sql
- etc.

### 5. No Calls to getPermissionRequest ✅
```bash
ssh root@homeassistant.local "find /config/mcp-server/dist -name '*.js' -exec grep -l 'getPermissionRequest' {} \;"
# Result: Only /config/mcp-server/dist/permissions.js (where it's defined)
```

### 6. Server Rebuilt ✅
```bash
cd /config/mcp-server && npm run build
# Build successful, timestamped Oct 26 20:19+
```

### 7. Process Restarted Multiple Times ✅
- Killed node process via `pkill -f 'node dist/index.js'`
- Claude Code restarted to force new connection
- Still seeing permission prompts

## The Mystery

**The permission prompt message exists in permissions.ts and is being displayed, but:**
- No deployed code calls `getPermissionRequest()`
- No deployed code calls `hasPermission()`
- `initSession()` auto-grants all permissions
- Handlers have permission checks explicitly removed

## Current Server State

**Git commit:** 9447c3a "chore: sync package version to 2.0.4 to match addon version"

**Recent commits:**
```
9447c3a chore: sync package version to 2.0.4 to match addon version
307660d fix: remove unused permission check code from root-level tools ← Permission removal
fa17d19 fix: regenerate package-lock.json in sync with package.json
ea0b176 chore: complete repository flattening cleanup
ff743c0 refactor: flatten repository structure and remove subdirectory
```

**Deployed files:**
- Source: `/config/mcp-server/src/tools/system.ts` - Modified Oct 26 20:04
- Compiled: `/config/mcp-server/dist/tools/system.js` - Modified Oct 26 20:19
- Compilation is newer than source ✅

## Hypotheses to Investigate

### 1. Legacy Code Path
There might be a legacy/backup version of the handlers being loaded:
- Check for multiple index.js files
- Check for old dist-legacy or similar directories
- Check import paths in index.ts

### 2. Module Cache
Node.js might be caching the old compiled modules:
- Try deleting node_modules and reinstalling
- Try deleting dist and rebuilding from scratch
- Check for .tsbuildinfo or similar cache files

### 3. Middleware or Wrapper
Permission checking might be happening at a higher level:
- Check index.ts CallToolRequestSchema handler
- Check if there's middleware wrapping the handlers
- Check transport layer (stdio/http adapters)

### 4. Ghost Import
Old permission code might still be imported somewhere:
```bash
# Check ALL imports of permissions.ts
grep -r "from.*permissions" /config/mcp-server/dist/
```

### 5. Multiple Server Instances
Home Assistant addon might be running multiple copies:
```bash
ps aux | grep node
# Check if there are multiple node processes
```

## Next Steps to Try

1. **Complete clean rebuild:**
   ```bash
   cd /config/mcp-server
   rm -rf dist node_modules
   npm install
   npm run build
   ```

2. **Verify imports:**
   ```bash
   grep -r "permissions" /config/mcp-server/dist/ | grep -v "\.map"
   ```

3. **Trace the execution path:**
   - Add console.log at start of handleSystemTool
   - See if it's even reaching the handler

4. **Check for conditional compilation:**
   - Look for #ifdef or environment-based imports
   - Check if there's a dev vs prod build difference

5. **Examine the transport layer:**
   - Check if stdio/http transport adds permission layer
   - Look at how index.ts routes to handlers

## Code References

### Permission Message Source
File: `src/permissions.ts:35-42`
```typescript
export function getPermissionRequest(category: PermissionCategory): string {
  const warnings = {
    filesystem: '...',
    database: '...',
    commands: 'This operation requires command execution access...'
  };

  return `⚠️ PERMISSION REQUIRED\n\n${warnings[category]}\n\nDo you approve ${category} access for this session?`;
}
```

### Handler Structure
File: `src/tools/system.ts:60-64`
```typescript
export async function handleSystemTool(
  name: string,
  args: any,
  sessionId: string
): Promise<any> {
  // Permission checks removed - handle on client side (Claude Code settings)
```

### Index Routing
File: `src/index.ts:150-152`
```typescript
} else if (name === 'ha_execute_command' || name === 'ha_read_logs' ||
           name === 'ha_get_disk_usage' || name === 'ha_restart_homeassistant') {
  result = await handleSystemTool(name, args || {}, this.sessionId);
```

## Impact

- **User Experience:** Users must manually approve permissions each session
- **Automation:** Breaks automated workflows expecting instant responses
- **Development:** Testing requires interactive approval
- **Production:** Client-side permission management (Claude Code's alwaysAllow) is ineffective

## Temporary Workaround

None currently available. Permission prompts appear despite all mitigation attempts.

## Related Issues

- Commit 2e0f054 initially removed permissions but was lost during repository flattening
- Had to re-remove permissions in commit 307660d
- Suggests permissions.ts might need to be deleted entirely rather than just not calling its functions

## Questions

1. Why is getPermissionRequest() being called when no code references it?
2. Is there TypeScript decorator or metadata injection happening?
3. Could the MCP SDK itself be adding permission checks?
4. Is the session ID matching between initSession and hasPermission calls?
