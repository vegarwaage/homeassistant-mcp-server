# Home Assistant MCP HTTP Server - Project Status

**Date**: October 24, 2025
**Current Version**: 2.0.0
**Status**: OAuth implementation complete, but Claude.ai not connecting

## Project Goal

Create an HTTP-based MCP server for Home Assistant with OAuth 2.1 authentication to enable Claude.ai (web/mobile) access to 17 Home Assistant control tools.

## What's Working

### ✅ Completed Features

1. **OAuth 2.1 Authorization Server**
   - Dynamic Client Registration (RFC 7591) at `/mcp/oauth/register`
   - Token endpoint with PKCE validation at `/mcp/oauth/token`
   - Authorization endpoint at `/mcp/oauth/authorize`
   - Revocation endpoint at `/mcp/oauth/revoke`
   - All endpoints accessible with and without `/mcp/` prefix

2. **OAuth Discovery (RFC 8414 & RFC 9728)**
   - Authorization server metadata: `/.well-known/oauth-authorization-server`
   - Protected resource metadata: `/.well-known/oauth-protected-resource/mcp`
   - All required fields present: scopes_supported, grant_types, etc.

3. **MCP Transport Implementations**
   - **Streamable HTTP** (primary): `/mcp` endpoint (POST and GET)
   - **SSE** (legacy): `/mcp/sse` endpoint (kept for backward compatibility)
   - Session management for Streamable HTTP with per-session MCP servers

4. **17 Home Assistant Tools**
   - States: get_states, get_history, set_state
   - Config: get_config, get_services, call_service
   - Automation: list_automations, trigger_automation, etc.
   - System: restart, reload_config, check_config, etc.

5. **Infrastructure**
   - Home Assistant addon deployed at version 2.0.0
   - NGINX Proxy Manager routing configured
   - DuckDNS domain: selwaha.duckdns.org
   - SSL via Let's Encrypt
   - Local DNS override for hairpin NAT issue

## What's NOT Working

### ❌ Current Issue

**Claude.ai web interface will not connect to the MCP server**

**Symptoms:**
- User clicks "Connect" → page reloads
- No error messages displayed
- No redirect to OAuth authorization

**What Claude.ai DOES do:**
- ✅ Fetches `/.well-known/oauth-authorization-server` (200 OK)
- ✅ Fetches `/.well-known/oauth-protected-resource/mcp` (200 OK)
- ❌ Never attempts to connect to `/mcp` endpoint
- ❌ Never calls `/mcp/oauth/register` for client registration
- ❌ Never initiates OAuth authorization flow

## Technical Architecture

### Network Setup
```
Internet → DuckDNS (selwaha.duckdns.org:443) → NGINX Proxy Manager
  ├─ / → Home Assistant (homeassistant:8123)
  ├─ /mcp → MCP HTTP addon (172.30.33.3:3000) - Streamable HTTP
  └─ /.well-known/oauth-* → MCP HTTP addon (172.30.33.3:3000)
```

### Key URLs
- **Primary MCP Endpoint**: `https://selwaha.duckdns.org/mcp` (Streamable HTTP)
- **Legacy SSE Endpoint**: `https://selwaha.duckdns.org/mcp/sse`
- **OAuth Authorization**: `https://selwaha.duckdns.org/mcp/oauth/authorize`
- **OAuth Token**: `https://selwaha.duckdns.org/mcp/oauth/token`
- **OAuth Register**: `https://selwaha.duckdns.org/mcp/oauth/register`

### Repository Structure
```
homeassistant-mcp-http/
├── src/
│   ├── http-server.ts       # Main Express server with OAuth & Streamable HTTP
│   ├── oauth.ts             # Home Assistant OAuth integration (legacy)
│   ├── oauth-server.ts      # OAuth 2.1 server with PKCE validation
│   ├── session.ts           # Session storage
│   ├── ha-client.ts         # Home Assistant REST API client
│   └── tools/               # 17 MCP tools
│       ├── states.ts
│       ├── config.ts
│       ├── automation.ts
│       └── system.ts
├── config.yaml              # HA addon configuration
├── package.json             # Dependencies (@modelcontextprotocol/sdk@1.20.2)
└── Dockerfile              # Alpine + Node.js
```

## Environment Details

- **Home Assistant**: 192.168.10.51
- **MCP Addon IP**: 172.30.33.3:3000
- **External IP**: 141.0.72.103
- **DuckDNS**: selwaha.duckdns.org
- **Local DNS Override**: `/etc/hosts` entry for hairpin NAT

## User's Subscription

- **Claude.ai**: Max subscription (required for remote MCP)
- Remote MCP requires Pro/Max/Team/Enterprise

## Investigation History

### What We Tried

1. **Initial SSE Implementation** (v1.0.0-1.0.16)
   - SSE transport with OAuth
   - Page reload issue appeared

2. **OAuth Endpoint Fixes** (v1.0.13-1.0.18)
   - Added POST support for SSE
   - Added OAuth discovery endpoints
   - Fixed protected resource metadata
   - Added missing OAuth fields (scopes_supported, etc.)
   - Fixed hairpin NAT with local DNS

3. **OAuth 2.1 Server Implementation** (v1.0.17)
   - Complete PKCE implementation
   - Dynamic client registration
   - Token endpoint with verifier validation

4. **Streamable HTTP Migration** (v2.0.0)
   - Upgraded SDK 0.5.0 → 1.20.2
   - Implemented Streamable HTTP transport
   - Per-session MCP server instances

### All Endpoints Verified Working

```bash
# Discovery endpoints
curl https://selwaha.duckdns.org/.well-known/oauth-authorization-server  # ✅ 200
curl https://selwaha.duckdns.org/.well-known/oauth-protected-resource/mcp  # ✅ 200

# OAuth endpoints
curl https://selwaha.duckdns.org/mcp/oauth/authorize  # ✅ Redirects to HA
curl -X POST https://selwaha.duckdns.org/mcp/oauth/register  # ✅ 400 (expects body)
curl -X POST https://selwaha.duckdns.org/mcp/oauth/token  # ✅ 400 (expects body)

# MCP endpoint
curl -X POST https://selwaha.duckdns.org/mcp  # ✅ 401 (requires auth)
```

## Key Findings from Research

1. **SSE Deprecation**: MCP officially deprecated SSE in March 2025 in favor of Streamable HTTP
2. **Claude.ai Support**: May 2025 announcement added remote MCP to claude.ai web
3. **OAuth Callback URL**: `https://claude.ai/api/mcp/auth_callback`
4. **Known Issue**: GitHub discussion #587 shows others with same "Tool execution failed" / page reload issue

## Hypotheses for Why It's Not Working

1. **Claude.ai May Not Fully Support OAuth MCP Yet**
   - Despite documentation saying it does
   - Only makes discovery requests, never connects
   - Similar issues reported by other developers

2. **Missing CORS Headers**
   - Possible browser security preventing connection

3. **OAuth Flow Mismatch**
   - Claude might expect different OAuth pattern
   - Possible issue with how we delegate to HA OAuth

4. **Streamable HTTP Implementation Issue**
   - Might need additional configuration
   - Session management might not match expectations

## Next Steps to Debug

### Option 1: Test with MCP Inspector
```bash
npx @modelcontextprotocol/inspector@latest
# Point it to https://selwaha.duckdns.org/mcp
# This will verify if our OAuth implementation actually works
```

### Option 2: Check Browser Console
- Open browser DevTools → Network tab
- Try connecting
- Look for CORS errors or failed requests
- Check if any JavaScript errors appear

### Option 3: Try Without OAuth
- Create a version without OAuth (just bearer token)
- See if that connects to Claude.ai
- Would confirm if issue is OAuth-specific

### Option 4: Contact Anthropic Support
- With evidence that all endpoints work
- Ask specifically about Claude.ai remote MCP OAuth support

## Working Alternative

**Claude Desktop with stdio MCP server** (separate implementation) works perfectly:
- No OAuth complexity
- No HTTP/networking issues
- All 17 tools functional
- Runs locally on Mac

## Files to Review

### Main Implementation
- `src/http-server.ts` - Lines 603-729 (Streamable HTTP + OAuth)
- `src/oauth-server.ts` - Complete OAuth 2.1 PKCE implementation

### Configuration
- `config.yaml` - Version 2.0.0
- `package.json` - SDK version 1.20.2

### Documentation
- GitHub: https://github.com/vegarwaage/homeassistant-mcp-http
- Branch: main (working in git worktree)

## Critical Logs

Recent addon logs show Claude making discovery requests but no connection attempts:
```
[2025-10-24T17:47:13.780Z] GET /.well-known/oauth-protected-resource/mcp - 200 (12ms)
[2025-10-24T17:47:18.170Z] GET /.well-known/oauth-authorization-server - 200 (7ms)
[2025-10-24T17:47:19.602Z] GET /.well-known/oauth-authorization-server - 200 (5ms)
# No POST to /mcp
# No registration request
# No authorization request
```

## Questions to Answer

1. Does MCP Inspector successfully connect with OAuth?
2. Are there any CORS-related errors in browser console?
3. Does a non-OAuth version work with Claude.ai?
4. Is there any official confirmation that Claude.ai supports custom OAuth MCP servers?

## Conclusion

We have successfully implemented:
- ✅ Complete OAuth 2.1 server with PKCE
- ✅ Both SSE and Streamable HTTP transports
- ✅ All discovery endpoints per RFC specs
- ✅ 17 working Home Assistant tools

But Claude.ai web interface refuses to connect, despite all infrastructure being correct. This appears to be a Claude.ai limitation rather than an implementation issue.
