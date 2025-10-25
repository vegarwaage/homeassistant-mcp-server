# HTTP OAuth Transport Guide

This guide explains how to use the HTTP transport with OAuth 2.1 for Claude.ai web and mobile access.

## Overview

The HTTP transport implements:
- **RFC 8414**: OAuth 2.0 Authorization Server Metadata
- **RFC 9728**: OAuth 2.0 Protected Resource Metadata
- **RFC 7591**: OAuth 2.0 Dynamic Client Registration
- **SSE Transport**: Server-Sent Events for MCP communication
- **Home Assistant OAuth**: Integrated authentication with HA

## Current Status

⚠️ **Claude.ai OAuth is currently broken** (as of October 2025)

Even GitHub's official MCP server fails with `step=start_error` when added to claude.ai. This is a known issue:
- GitHub Issue #3515: MCP OAuth Integration Fails
- GitHub Issue #5826: Claude Desktop doesn't connect to Custom MCPs
- Discussion #587: OAuth flow returns "Tool execution failed"

**This implementation is ready** and follows all best practices. When Anthropic fixes their OAuth proxy, it should work immediately.

## Prerequisites

1. **Home Assistant** with external access configured
2. **DuckDNS** or **Tailscale** for HTTPS access
3. **Claude Pro/Team/Enterprise** subscription
4. **Long-lived access token** from Home Assistant

## Configuration

### Environment Variables

```bash
# Required
SUPERVISOR_TOKEN=your_ha_long_lived_token
OAUTH_CLIENT_URL=https://your-domain.duckdns.org

# Optional
PORT=3000  # Default port
HA_URL=http://supervisor/core  # HA API URL
TRANSPORT=http  # Enable HTTP transport (default: stdio)
```

### Example: Running HTTP Transport

```bash
export SUPERVISOR_TOKEN='eyJ...'
export OAUTH_CLIENT_URL='https://selwaha.duckdns.org'
export TRANSPORT='http'
export PORT='3000'

node dist/index.js
```

## OAuth Endpoints

Once running, the following endpoints are available:

### Discovery Endpoints
```
GET /.well-known/oauth-authorization-server
GET /.well-known/oauth-protected-resource/mcp
```

### Dynamic Client Registration
```
POST /mcp/oauth/register
Content-Type: application/json

{
  "client_name": "Claude",
  "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"]
}

Response:
{
  "client_id": "...",
  "client_secret": "...",
  "redirect_uris": ["..."],
  "client_id_issued_at": 1234567890
}
```

### Authorization Flow
```
1. GET /auth/authorize
   - Redirects to Home Assistant OAuth

2. User authenticates with HA

3. GET /auth/callback
   - Exchanges HA code for token
   - Redirects back to client

4. POST /auth/token
   - Exchanges auth code for access token
```

### MCP Endpoint
```
GET /mcp
Authorization: Bearer <access_token>
Accept: text/event-stream

Returns: Server-Sent Events stream with MCP messages
```

## Adding to Claude.ai

**When Claude fixes their OAuth:**

1. Go to https://claude.ai → Settings → Connectors
2. Click "Add Custom Connector"
3. Enter:
   - **Name**: Home Assistant
   - **URL**: `https://your-domain.duckdns.org/mcp`
4. Click "Add"
5. Complete OAuth flow (authenticate with HA)
6. Use in conversations!

## Testing Locally

### 1. Check Discovery Endpoints

```bash
# Authorization server metadata
curl https://your-domain.duckdns.org/.well-known/oauth-authorization-server

# Should return:
{
  "issuer": "https://your-domain.duckdns.org",
  "authorization_endpoint": "https://your-domain.duckdns.org/auth/authorize",
  "token_endpoint": "https://your-domain.duckdns.org/auth/token",
  ...
}

# Protected resource metadata
curl https://your-domain.duckdns.org/.well-known/oauth-protected-resource/mcp

# Should return:
{
  "resource": "https://your-domain.duckdns.org/mcp",
  "authorization_servers": ["https://your-domain.duckdns.org"]
}
```

### 2. Test Dynamic Client Registration

```bash
curl -X POST https://your-domain.duckdns.org/mcp/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test Client",
    "redirect_uris": ["http://localhost:3000/callback"]
  }'

# Should return client_id and client_secret
```

### 3. Check 401 Response

```bash
curl -I https://your-domain.duckdns.org/mcp

# Should return:
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="...", resource_metadata="..."
```

## Deployment

### Option 1: Direct Deployment (Current Method)

Deploy to Home Assistant as an addon:

1. Build the code:
   ```bash
   npm run build
   ```

2. Deploy to HA:
   ```bash
   scp -r dist/* root@homeassistant.local:/root/ha-mcp-http/dist/
   ```

3. Create systemd service or run manually:
   ```bash
   ssh root@homeassistant.local
   cd /root/ha-mcp-http
   export SUPERVISOR_TOKEN='...'
   export OAUTH_CLIENT_URL='https://selwaha.duckdns.org'
   export TRANSPORT='http'
   node dist/index.js
   ```

### Option 2: Docker Container

Create a Dockerfile:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

Build and run:
```bash
docker build -t ha-mcp-http .
docker run -e SUPERVISOR_TOKEN='...' -e OAUTH_CLIENT_URL='...' -e TRANSPORT='http' -p 3000:3000 ha-mcp-http
```

## Security Considerations

### ✅ What's Implemented

- **Dynamic Client Registration**: RFC 7591 compliant
- **OAuth 2.1**: Modern, secure OAuth implementation
- **PKCE Support**: Code challenge methods declared (S256)
- **Token Validation**: Proper token expiration checking
- **CORS**: Configured for secure cross-origin requests
- **HTTPS**: Required for production (via DuckDNS/Tailscale)

### ⚠️ Production Recommendations

1. **Persistent Storage**: Replace in-memory Maps with Redis or database
2. **Token Encryption**: Encrypt tokens at rest
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **Logging**: Add structured logging for audit trails
5. **Monitoring**: Add health checks and metrics

### 🔒 Current Limitations

- **In-memory storage**: Sessions/clients lost on restart
- **Single instance**: Cannot scale horizontally without shared storage
- **No token encryption**: Tokens stored in plain text in memory

## Troubleshooting

### Error: `step=start_error`

This is Claude.ai's OAuth proxy failing, not your server. Wait for Anthropic to fix.

### Error: `404` on protected resource metadata

Check that `/.well-known/oauth-protected-resource/mcp` is accessible:
```bash
curl https://your-domain.duckdns.org/.well-known/oauth-protected-resource/mcp
```

### Error: `invalid_client` during registration

Ensure your request includes `redirect_uris` array:
```json
{
  "client_name": "...",
  "redirect_uris": ["..."]
}
```

### Error: `unauthorized` when accessing /mcp

You need a valid Bearer token. Complete the OAuth flow first.

## Comparison: stdio vs HTTP Transport

| Feature | stdio | HTTP OAuth |
|---------|-------|------------|
| **Works with** | Desktop, Code | Web, iOS, Android |
| **Setup** | SSH only | OAuth + HTTPS |
| **Security** | SSH keys | OAuth tokens |
| **Deployment** | Simple | Complex |
| **Current status** | ✅ Working | ❌ Claude OAuth broken |

## Next Steps

1. **Monitor GitHub issues**: Watch #5826 for Claude OAuth fixes
2. **Test locally**: Verify all endpoints work
3. **Wait for Claude fix**: Be ready to test when announced
4. **Deploy**: When working, deploy and enjoy mobile access!

## Implementation Details

### Architecture

```
Claude.ai
    ↓ (OAuth Discovery)
/.well-known/oauth-authorization-server
    ↓ (OAuth Registration)
/mcp/oauth/register
    ↓ (OAuth Authorization)
/auth/authorize → Home Assistant OAuth
    ↓ (Callback)
/auth/callback → Exchange HA token
    ↓ (Token Exchange)
/auth/token → Issue access token
    ↓ (Authenticated Request)
/mcp (with Bearer token) → SSE Stream
```

### Session Flow

1. **Client Registration**: Claude registers with DCR endpoint
2. **Authorization**: User redirected to HA OAuth
3. **Token Exchange**: Auth code exchanged for access token
4. **MCP Connection**: Client connects with Bearer token
5. **Tool Execution**: Client calls tools via authenticated SSE stream

## References

- [RFC 6749: OAuth 2.0](https://tools.ietf.org/html/rfc6749)
- [RFC 8414: OAuth 2.0 Authorization Server Metadata](https://tools.ietf.org/html/rfc8414)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://tools.ietf.org/html/rfc9728)
- [RFC 7591: OAuth 2.0 Dynamic Client Registration](https://tools.ietf.org/html/rfc7591)
- [MCP Specification: Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [Home Assistant Auth API](https://developers.home-assistant.io/docs/auth_api)

## Support

For issues with:
- **This implementation**: Open GitHub issue on the repository
- **Claude OAuth**: Watch anthropics/claude-code issues #3515, #5826
- **Home Assistant OAuth**: Check HA community forums

---

**Ready for when Claude fixes their OAuth proxy!** 🚀
