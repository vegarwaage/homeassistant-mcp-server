# Codebase Review and Refactoring Plan

**Date:** 2025-10-25
**Reviewer:** Claude
**Status:** Ready for Implementation

## Executive Summary

The current codebase is well-structured but has **critical issues** that must be fixed before adding new features:

1. **❌ Tool definitions duplicated** - Schema in `index.ts` separate from implementation
2. **❌ Hardcoded constructor** - `HomeAssistantClient` uses hardcoded URL/token
3. **❌ Mixed concerns** - `index.ts` contains both server logic and tool schemas
4. **❌ Poor error handling** - Try-catch blocks swallow errors silently
5. **✅ Good separation** - Tools are well-organized by category
6. **✅ Good security** - Path validation prevents traversal attacks
7. **✅ Good backup system** - Automatic backups with rollback

## Critical Issues (Must Fix Before Adding Features)

### Issue 1: Tool Schema Duplication (DRY Violation)

**Problem:** Tool schemas defined in `index.ts:94-271` are separate from tool implementations in `tools/*.ts`

**Current:**
```typescript
// index.ts - Schema defined here
'ha_get_states': {
  name: 'ha_get_states',
  description: 'Get current state...',
  inputSchema: { ... }
}

// tools/states.ts - Implementation here
tools.set('ha_get_states', async (client, args) => { ... });
```

**Impact:**
- Adding a tool requires changes in 2 places
- Schema and implementation can drift out of sync
- Violates DRY principle
- Error-prone maintenance

**Solution:** Co-locate schema with implementation

```typescript
// tools/states.ts
export function registerStateTools(tools: Map<string, ToolDefinition>) {
  tools.set('ha_get_states', {
    description: 'Get current state...',
    inputSchema: { type: 'object', properties: {...} },
    handler: async (client, args) => { ... }
  });
}
```

---

### Issue 2: Hardcoded Client Construction

**Problem:** `HomeAssistantClient` in `index.ts:34` uses no parameters, relies on defaults

**Current:**
```typescript
this.haClient = new HomeAssistantClient();
// Uses defaults: 'http://homeassistant:8123', process.env.SUPERVISOR_TOKEN
```

**Impact:**
- Can't test with different URLs
- Can't use different tokens
- Implicit dependency on environment
- Difficult to debug

**Solution:** Explicit dependency injection

```typescript
// Pass from environment explicitly
const baseUrl = process.env.HA_BASE_URL || 'http://homeassistant:8123';
const token = process.env.SUPERVISOR_TOKEN || '';

if (!token) {
  console.error('ERROR: SUPERVISOR_TOKEN environment variable required');
  process.exit(1);
}

this.haClient = new HomeAssistantClient(baseUrl, token);
```

---

### Issue 3: Mixed Concerns in index.ts

**Problem:** `index.ts` contains:
- MCP server setup (lines 16-39)
- Request handlers (lines 41-83)
- Tool registration (lines 85-91)
- **270 lines** of tool schemas (lines 93-274)
- Server startup (lines 276-288)

**Impact:**
- File is 289 lines (too large)
- Hard to find relevant code
- Tool schemas dominate the file
- Violates single responsibility

**Solution:** Extract tool schemas to tool files, keep `index.ts` minimal

**New index.ts structure:**
```typescript
// index.ts - ~50 lines total
- Server initialization
- Request handler setup
- Tool registration (no schemas)
- Server startup
```

---

### Issue 4: Silent Error Handling

**Problem:** Multiple places swallow errors without proper logging

**Examples:**

1. `automation.ts:58-72` - Validation errors caught but may not throw
2. `config.ts:58-65` - Backup failure silently ignored
3. `ha-client.ts:105-107` - stderr logged but not included in error

**Current:**
```typescript
try {
  const validation = await client.validateConfig();
  if (!validation.valid) {
    // Rollback happens but error might not propagate
  }
} catch (error: any) {
  if (error.message.includes('insufficient permissions')) {
    console.error('Skipping validation - CLI access not available');
    // ERROR SWALLOWED - automation still created!
  }
}
```

**Impact:**
- Invalid configurations may be applied
- Debugging is difficult
- Silent failures confuse users

**Solution:** Be explicit about what errors are acceptable

```typescript
try {
  const validation = await client.validateConfig();
  if (!validation.valid) {
    await fs.copyFile(backup.path, AUTOMATIONS_FILE);
    throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
  }
} catch (error: any) {
  // Only ignore specific permission errors
  if (error.message.includes('insufficient permissions')) {
    console.error('WARNING: Validation skipped - CLI not available');
    console.error('WARNING: Configuration may be invalid!');
    // Continue but warn
  } else {
    // Re-throw all other errors
    throw error;
  }
}
```

---

## Minor Issues (Nice to Have)

### Issue 5: Axios Dependency

**Current:** Uses `axios` for HTTP requests
**Alternative:** Use native `fetch` (available in Node 18+)

**Benefit:**
- Remove dependency (simpler)
- Smaller bundle
- Native API

**Effort:** Low (2-3 hours)
**Priority:** Low (axios works fine)

---

### Issue 6: Type Safety

**Problem:** Many `any` types instead of proper interfaces

**Examples:**
- `tools/states.ts:9` - `args: any`
- `index.ts:54` - `request.params` not typed
- `ha-client.ts:66` - `params: any`

**Solution:** Define proper types

```typescript
// types.ts
export interface HAGetStatesArgs {
  entity_id?: string;
  domain?: string;
}

// tools/states.ts
async (client: HomeAssistantClient, args: HAGetStatesArgs) => {
  const { entity_id, domain } = args; // Now type-safe!
  ...
}
```

**Benefit:** Catch errors at compile time, better IDE support
**Effort:** Medium (4-6 hours to add types everywhere)
**Priority:** Medium (helps during new feature development)

---

## Refactoring Plan

### Refactor 1: Extract Tool Definitions to Tool Files

**Goal:** Move all tool schemas from `index.ts` to their respective tool files

**Changes:**
1. Update `types.ts` to add `ToolDefinition` interface
2. Modify all `registerXXXTools` functions to return tool objects (not just handlers)
3. Update `index.ts` to use tool objects from registration
4. Remove 270-line tool definition block from `index.ts`

**Files:**
- `src/types.ts` - Add ToolDefinition interface
- `src/tools/states.ts` - Add schemas to tool registrations
- `src/tools/automation.ts` - Add schemas to tool registrations
- `src/tools/config.ts` - Add schemas to tool registrations
- `src/tools/system.ts` - Add schemas to tool registrations
- `src/index.ts` - Remove getToolDefinition method, simplify

**Estimate:** 1-2 hours

---

### Refactor 2: Fix Client Construction

**Goal:** Make HomeAssistantClient construction explicit and validated

**Changes:**
1. Extract environment variables at top of `index.ts`
2. Validate required environment variables
3. Pass explicit parameters to `HomeAssistantClient`
4. Add clear error messages

**Files:**
- `src/index.ts` - Extract env vars, validate, pass to client

**Estimate:** 15 minutes

---

### Refactor 3: Improve Error Handling

**Goal:** Make error handling explicit and informative

**Changes:**
1. Review all try-catch blocks
2. Only catch specific errors we can handle
3. Log warnings for skipped operations
4. Re-throw unexpected errors
5. Add context to error messages

**Files:**
- `src/tools/automation.ts` - Fix validation error handling
- `src/tools/config.ts` - Fix backup error handling
- `src/ha-client.ts` - Include stderr in CLI errors

**Estimate:** 1 hour

---

### Refactor 4: Add Type Safety (Optional)

**Goal:** Replace `any` types with proper interfaces

**Changes:**
1. Define interfaces for all tool arguments in `types.ts`
2. Update tool handlers to use typed arguments
3. Update ha-client methods to use typed parameters

**Files:**
- `src/types.ts` - Add tool argument interfaces
- `src/tools/*.ts` - Use typed arguments
- `src/ha-client.ts` - Add parameter types

**Estimate:** 2-3 hours
**Priority:** Optional (can do later)

---

## Implementation Order

### Required Before New Features (3-4 hours):
1. **Refactor 1**: Extract tool definitions (~1-2 hours) - CRITICAL
2. **Refactor 2**: Fix client construction (~15 min) - CRITICAL
3. **Refactor 3**: Improve error handling (~1 hour) - IMPORTANT

### Optional (Can Do Later):
4. **Refactor 4**: Add type safety (~2-3 hours) - NICE TO HAVE

---

## Verification Checklist

After refactoring, verify:
- [ ] `npm run build` succeeds with no errors
- [ ] All existing tools still work
- [ ] Tool schemas match implementations
- [ ] Error messages are informative
- [ ] No silent error swallowing
- [ ] Environment variables validated on startup
- [ ] index.ts < 100 lines

---

## Benefits of Refactoring First

**Before adding 21 new tools:**

1. **DRY** - Only define each tool once (not twice)
2. **Maintainability** - Clear where to add new tools
3. **Reliability** - Errors surface properly
4. **Simplicity** - index.ts is simple and readable
5. **Confidence** - Clean foundation for new features

**Estimated time saved:** By refactoring first, adding 21 tools will be ~30% faster and less error-prone.

---

## Recommendation

**Proceed with Refactors 1-3 (Required) before implementing new features.**

This gives us a clean, simple foundation that makes adding the 21 new tools straightforward and maintainable.

Total time: **3-4 hours** of refactoring + **17-22 hours** of new features = **20-26 hours total**

vs. not refactoring: **~25-30 hours** (more bugs, more rework)

**Net benefit:** Cleaner code, fewer bugs, same or less total time.
