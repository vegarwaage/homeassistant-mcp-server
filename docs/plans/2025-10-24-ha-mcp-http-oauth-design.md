# Home Assistant MCP HTTP Server with OAuth Design

**Date:** 2025-10-24
**Status:** Design Complete
**Purpose:** Create HTTP-based MCP server addon for Home Assistant with OAuth authentication to enable Claude iOS/web access

## Overview

This design creates a new Home Assistant addon that exposes MCP tools via HTTP/SSE transport with Home Assistant OAuth authentication. This enables Claude iOS and web apps to access Home Assistant, complementing the existing stdio-based MCP server used by Claude Code/Desktop.

## Goals

1. Enable Claude iOS app to access Home Assistant MCP tools
2. Use Home Assistant's built-in OAuth for authentication
3. Respect Home Assistant user permissions
4. Keep existing stdio MCP server working (no migration required)
5. Minimize code duplication by reusing existing tool implementations

## Non-Goals

- Replace the existing stdio MCP server
- Support multiple OAuth providers (HA only for now)
- Real-time streaming of HA state changes
- Multi-tenant usage (single HA instance only)

## Requirements & Constraints

### Functional Requirements
- HTTP/SSE transport compatible with Claude's remote MCP spec
- OAuth 2.0 authentication using Home Assistant's auth system
- All 17 existing tools available via HTTP
- Session persistence across addon restarts
- Token refresh when access tokens expire

### Technical Constraints
- Deploy as Home Assistant addon (Docker)
- Use HA's ingress system for SSL termination
- Store sessions in `/data/` for persistence
- Reuse existing tool code without modification
- Access via existing DuckDNS setup

### Security Requirements
- Encrypt stored OAuth tokens at rest
- Validate all OAuth redirects
- Respect HA user permissions per request
- Automatic token revocation on logout
- No hardcoded credentials

## Architecture

### System Context

```
┌─────────────┐          ┌──────────────┐         ┌─────────────────┐
│  Claude iOS │          │ Anthropic's  │         │ Home Assistant  │
│     App     │──HTTPS──>│   Servers    │──HTTPS─>│   (DuckDNS)     │
└─────────────┘          └──────────────┘         └────────┬────────┘
                                                            │ Ingress
                                                   ┌────────▼────────┐
                                                   │  MCP HTTP Addon │
                                                   │  (Port 3000)    │
                                                   └────────┬────────┘
                                                            │
                                                   ┌────────▼────────┐
                                                   │  Home Assistant │
                                                   │    Core API     │
                                                   └─────────────────┘
```

### Component Architecture

**Main Components:**

1. **HTTP Server (Express.js)**
   - Serves OAuth endpoints
   - Hosts SSE transport for MCP
   - Handles session management

2. **OAuth Handler**
   - Implements HA OAuth flow
   - Manages token exchange
   - Handles token refresh

3. **Session Manager**
   - Encrypts/decrypts tokens
   - Persists to `/data/sessions.json`
   - Auto-cleanup expired sessions

4. **MCP Server (SDK)**
   - SSE transport implementation
   - Tool registration and execution
   - JSON-RPC message handling

5. **Tool Implementations** (Reused)
   - States, Config, Automation, System tools
   - Same code as stdio version

### File Structure

```
homeassistant-mcp-http/
├── config.yaml              # HA addon metadata
├── Dockerfile               # Build instructions
├── run.sh                   # Startup script
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── src/
│   ├── http-server.ts       # Main HTTP server & MCP setup
│   ├── oauth.ts             # HA OAuth implementation
│   ├── session.ts           # Session storage & encryption
│   ├── ha-client.ts         # Copied from existing addon
│   ├── types.ts             # Copied from existing addon
│   ├── backup.ts            # Copied from existing addon
│   └── tools/               # All tools copied from existing
│       ├── states.ts
│       ├── config.ts
│       ├── automation.ts
│       └── system.ts
└── data/                    # Persistent storage (runtime)
    ├── sessions.json        # Encrypted OAuth sessions
    ├── encryption.key       # Session encryption key
    └── .gitkeep
```

## Data Flow

### OAuth Authentication Flow

```
1. User adds connector on claude.ai:
   URL: https://your-domain.duckdns.org

2. Claude tries to use tool → MCP returns OAuth challenge

3. User clicks "Authorize" → Browser opens:
   GET /oauth/authorize

4. MCP redirects to Home Assistant:
   GET https://homeassistant.local:8123/auth/authorize
       ?client_id=https://your-domain.duckdns.org
       &redirect_uri=https://your-domain.duckdns.org/oauth/callback
       &state=random_session_id

5. User logs into HA → Grants permissions

6. HA redirects back:
   GET /oauth/callback?code=ABC123&state=random_session_id

7. MCP exchanges code for token:
   POST https://homeassistant.local:8123/auth/token
   Body: grant_type=authorization_code&code=ABC123&client_id=...

8. HA returns tokens:
   {
     "access_token": "...",
     "refresh_token": "...",
     "expires_in": 1800
   }

9. MCP stores encrypted session:
   /data/sessions.json

10. Returns success to Claude
```

### Tool Execution Flow

```
1. Claude sends MCP request:
   POST /messages
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "ha_get_states",
       "arguments": {"domain": "climate"}
     }
   }

2. MCP extracts session token from request

3. Creates HomeAssistantClient with user's token:
   new HomeAssistantClient('http://homeassistant:8123', access_token)

4. Executes tool:
   await ha_get_states(haClient, args)

5. Tool calls HA API with user's token:
   GET http://homeassistant:8123/api/states

6. Returns result to Claude:
   {
     "result": {
       "content": [{"type": "text", "text": "..."}]
     }
   }
```

### Token Refresh Flow

```
1. HA API returns 401 Unauthorized

2. Session manager checks token expiry

3. If expired, request new token:
   POST https://homeassistant.local:8123/auth/token
   Body: grant_type=refresh_token&refresh_token=...

4. Update session with new token

5. Retry original request
```

## Implementation Details

### Dependencies

**Runtime:**
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `express` - HTTP server
- `axios` - HTTP client for HA API
- `yaml` - YAML parsing for configs
- `ws` - WebSocket support

**Build:**
- `typescript` - TypeScript compiler
- `@types/node` - Node.js types
- `@types/express` - Express types

### Environment Variables

```bash
SUPERVISOR_TOKEN     # Provided by HA (unused for user auth)
OAUTH_CLIENT_URL     # From addon config (DuckDNS URL)
INGRESS_PATH        # Provided by HA ingress system
```

### Configuration (config.yaml)

```yaml
name: Home Assistant MCP HTTP Server
version: "1.0.0"
slug: homeassistant_mcp_http
description: HTTP MCP server with OAuth for Claude iOS/web access
arch:
  - aarch64
  - amd64
  - armhf
  - armv7
  - i386
startup: application
boot: auto
ingress: true
ingress_port: 3000
panel_icon: mdi:robot
homeassistant_api: true
ports: {}
options:
  oauth_client_url: ""
schema:
  oauth_client_url: str
```

### Session Storage Format

```json
{
  "session_id_abc123": {
    "access_token": "encrypted_base64_token",
    "refresh_token": "encrypted_base64_refresh",
    "expires_at": 1761254400,
    "ha_user": "vegar",
    "created_at": 1761252600,
    "last_used": 1761252700
  }
}
```

**Encryption:**
- AES-256-GCM encryption
- Random key generated on first run
- Key stored in `/data/encryption.key`
- Each token encrypted separately

### Error Handling

**OAuth Errors:**
- `invalid_grant` → Redirect back to authorize
- `invalid_client` → Log error, show config instructions
- Network errors → Retry with exponential backoff

**Token Errors:**
- `401 Unauthorized` → Attempt token refresh
- Refresh fails → Clear session, require re-auth
- Token decrypt fails → Clear session, require re-auth

**Tool Execution Errors:**
- HA API errors → Return as MCP error response
- Validation errors → Log and rollback (existing behavior)
- Network timeouts → Return timeout error to Claude

### Security Considerations

**Token Security:**
- Tokens encrypted at rest
- Encryption key protected (600 permissions)
- Sessions expire after inactivity
- Tokens revoked on explicit logout

**OAuth Security:**
- State parameter prevents CSRF
- Redirect URI validation
- HTTPS enforced via HA ingress
- No token logging

**API Security:**
- Each user has own HA session
- Respects HA user permissions
- No privilege escalation possible
- Audit trail via HA logs

## Deployment

### Installation Steps

1. Create new addon directory structure
2. Build Docker image
3. Install addon in Home Assistant
4. Configure DuckDNS URL in addon options
5. Start addon
6. Test OAuth flow in browser
7. Add to claude.ai connectors
8. Test from Claude iOS app

### Rollback Strategy

- Keep existing stdio addon running
- Both addons can coexist
- Delete HTTP addon if issues arise
- No data migration needed

### Testing Plan

1. **Unit Tests** - OAuth flow, session management, token encryption
2. **Integration Tests** - Full OAuth flow with test HA instance
3. **Manual Testing** - Browser-based OAuth flow validation
4. **MCP Inspector** - Validate MCP spec compliance
5. **Claude.ai Testing** - Add connector, test tool execution
6. **iOS Testing** - End-to-end test from iPhone

## Alternatives Considered

### Alternative 1: Dual-Mode Server (HTTP + stdio)
**Rejected** - More complex, mixing concerns. Separate addons cleaner.

### Alternative 2: Custom OAuth Provider
**Rejected** - HA OAuth already exists, maintains HA user permissions.

### Alternative 3: Simple Token Auth
**Rejected** - Doesn't integrate with HA users, manual token management.

### Alternative 4: Standalone Server on Different Machine
**Rejected** - Requires additional infrastructure, more complex networking.

## Future Enhancements

- Multi-user session management UI
- OAuth scope restrictions per tool
- Rate limiting per user
- Metrics and monitoring dashboard
- Support for additional OAuth providers
- WebSocket transport option
- Real-time HA state streaming

## Success Metrics

- OAuth flow completes without errors
- All 17 tools work via HTTP
- Tokens refresh automatically
- No data loss across restarts
- Claude iOS can execute tools
- Response time < 2 seconds per tool

## Risks & Mitigations

**Risk:** OAuth flow breaks due to spec changes
**Mitigation:** Use official MCP SDK OAuth helpers

**Risk:** Token encryption key lost
**Mitigation:** Users re-authenticate (acceptable)

**Risk:** DuckDNS SSL certificate expires
**Mitigation:** HA handles SSL, automatic renewal

**Risk:** Session storage grows unbounded
**Mitigation:** Auto-cleanup expired sessions daily

**Risk:** Concurrent token refresh conflicts
**Mitigation:** Use file locking for session updates

## Open Questions

None - design is complete and validated.

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Home Assistant Auth API](https://developers.home-assistant.io/docs/auth_api/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Home Assistant Addon Development](https://developers.home-assistant.io/docs/add-ons)
