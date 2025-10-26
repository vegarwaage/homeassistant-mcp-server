# MCP Server Context Usage Assessment

**Date:** 2025-10-26
**Context:** Evaluating whether the 59-tool MCP server is too large for Claude's context window and whether Skills would be a better architecture.

## Current State

The Home Assistant MCP server now includes:
- **44 API tools** (states, automation, config, system info, media, energy, etc.)
- **15 root-level tools** (filesystem, database, system commands)
- **Total: 59 tools**

## Context Impact Analysis

### Tool Schema Overhead

**Schema size:** ~2,000-3,000 tokens
- 59 tool definitions are always loaded when MCP server connects
- Each schema is compact (~30-50 tokens): name, description, input parameters
- This represents <2% of Claude's 200K context window
- Many production MCP servers have 50-100+ tools without issues

**Verdict:** Schema overhead is negligible.

### Tool Output Usage

**Where context is actually consumed:**
- Each tool output capped at 25,000 tokens (configurable via `MAX_MCP_OUTPUT_TOKENS`)
- Multiple tool calls accumulate in conversation
- Our pagination defaults (limit: 100, max: 1000) help control this
- File reads capped at 1MB default
- SQL queries limited to 1000 rows default

**Verdict:** Output limits already prevent context explosion.

## Skills vs MCP Servers

### What Skills Are For

According to Claude Code documentation:
- Process and workflow documentation (e.g., TDD practices)
- Team conventions and coding standards
- Claude Code-specific workflows
- Progressive disclosure of **instructions** (not tool execution)

### What MCP Servers Are For

- External system integrations ✅ (Home Assistant)
- Data source connections ✅ (HA state, recorder database)
- Tool execution ✅ (API calls, filesystem operations)
- System operations ✅ (privileged access, shell commands)

### Why Skills Don't Apply Here

1. **Skills can't execute operations** - they're documentation/instructions only
2. **No tool replacement** - Skills could document *how to use* the MCP tools, but can't replace them
3. **Wrong abstraction level** - This is exactly what MCP was designed for (external integrations)
4. **Progressive disclosure irrelevant** - All tools need to be available; this isn't about revealing complexity gradually

## Recommendation

### Keep Single MCP Server (Current Architecture)

**Rationale:**
- ✅ Correct architecture for external system integration
- ✅ 59 tools is within normal range for production MCP servers
- ✅ Tool schemas add minimal context overhead (~3K tokens)
- ✅ Output limits already implemented and working
- ✅ Good tool discoverability (all HA operations in one place)

### Alternative: Split Into Two Servers (Future Option)

If needed for security or organizational reasons:

**homeassistant-api** (44 tools)
- All read-only and standard API operations
- No special permissions required
- Safe for general use

**homeassistant-root** (15 tools)
- Filesystem operations
- Database access
- Shell command execution
- Requires explicit permission grants

**Benefits:**
- Users can install only what they need
- Clear separation of privilege levels
- Easier to audit security-sensitive operations

**Cost:**
- More complex setup
- Need to maintain two servers
- Less convenient for users who want everything

## Context Optimization (If Needed)

If context usage becomes problematic (unlikely):

1. **Lower output limits**: Reduce `MAX_MCP_OUTPUT_TOKENS` from 25K to 10K
2. **More aggressive pagination**: Default limit 50 instead of 100
3. **Optimize tool descriptions**: Make them more concise
4. **Add filtering parameters**: Let users narrow results before retrieval

## Conclusion

**No action required.** The current single-server architecture is optimal for this use case. The 59 tools contribute negligible context overhead (~3K tokens). Skills are the wrong architectural pattern for external system integrations.

If context becomes an issue in practice (not expected), split into api/root servers rather than converting to Skills.

## Decision

**Status:** Approved
**Architecture:** Single MCP server with 59 tools
**Reasoning:** Correct pattern for external integration, minimal context overhead, good discoverability
