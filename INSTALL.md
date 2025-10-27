# Installation Guide

Complete guide for installing and configuring the Home Assistant MCP Server with both stdio and HTTP transports.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation Options](#installation-options)
  - [Option 1: Home Assistant Add-on (Recommended)](#option-1-home-assistant-add-on-recommended)
  - [Option 2: Manual Deployment](#option-2-manual-deployment)
- [Transport Configuration](#transport-configuration)
  - [stdio Transport (Desktop/Code)](#stdio-transport-desktopcode)
  - [HTTP Transport (Web/Mobile)](#http-transport-webmobile)
- [Security & Permissions](#security--permissions)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

---

## Quick Start

**For Claude Desktop/Code users (Recommended):**
1. Install as Home Assistant add-on
2. Configure stdio transport
3. Connect via SSH in Claude Desktop config
4. Start chatting with Claude about your smart home!

**For Web/Mobile users (When Anthropic fixes OAuth):**
1. Install as Home Assistant add-on
2. Configure HTTP transport with your public URL
3. Add MCP connector in Claude.ai settings
4. Complete OAuth flow

---

## Prerequisites

### All Installations
- Home Assistant OS or Supervised installation
- GitHub account (for repository access)

### For stdio Transport (Desktop/Code)
- SSH access to Home Assistant
- Claude Desktop or Claude Code installed

### For HTTP Transport (Web/Mobile)
- Home Assistant externally accessible (DuckDNS or Tailscale)
- HTTPS configured
- Claude Pro/Team/Enterprise subscription
- Long-lived access token from Home Assistant

---

## Installation Options

### Option 1: Home Assistant Add-on (Recommended)

The add-on provides auto-deployment, dual transport support, and automatic updates from GitHub.

#### 1. Add Repository to Home Assistant

1. Open Home Assistant: **Settings** → **Add-ons** → **Add-on Store**
2. Click **⋮** (top right) → **Repositories**
3. Add this repository URL:
   ```
   https://github.com/vegarwaage/homeassistant-mcp-server
   ```
4. Click **Add** and close

#### 2. Install MCP Server Add-on

1. Refresh the add-on store (reload page if needed)
2. Find **"MCP Server for Home Assistant"**
3. Click **Install**
4. Wait for installation to complete (may take a few minutes)

#### 3. Configure Transport

See [Transport Configuration](#transport-configuration) section below.

#### 4. Start the Add-on

1. Go to the **Info** tab
2. Click **Start**
3. Check the **Log** tab to verify startup:
   - stdio: `"MCP Server ready on stdio"`
   - HTTP: `"HTTP server listening on port 3000"`

### Option 2: Manual Deployment

Deploy directly on your Home Assistant OS installation via SSH.

```bash
# Build on your development machine
npm run build

# Deploy to Home Assistant (use /config for persistence)
scp -r dist/* root@homeassistant.local:/config/mcp-server/dist/
scp package*.json root@homeassistant.local:/config/mcp-server/

# SSH in and install dependencies
ssh root@homeassistant.local "cd /config/mcp-server && npm install --production"
```

**Note:** The add-on method is recommended as it auto-deploys on updates from GitHub.

---

## Transport Configuration

The server supports two transport modes. Choose based on your use case.

### stdio Transport (Desktop/Code)

**Best for:** Claude Desktop and Claude Code users
**Status:** ✅ Working
**Setup:** Simple SSH configuration

#### Add-on Configuration

```yaml
transport: stdio
port: 3000          # Not used for stdio, but required
oauth_client_url: ""
```

#### Claude Desktop Setup

When installed as an add-on, the server auto-deploys to `/config/mcp-server`.

Add to your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "homeassistant": {
      "command": "ssh",
      "args": [
        "root@homeassistant.local",
        "cd /config/mcp-server && SUPERVISOR_TOKEN='YOUR_TOKEN_HERE' node dist/index.js"
      ]
    }
  }
}
```

**Get your token:**
1. Home Assistant: Profile → Long-Lived Access Tokens → Create Token
2. Copy token and paste into config above

#### Verify Connection

1. Restart Claude Desktop
2. Open new chat
3. Check for "homeassistant" in MCP servers list
4. Test: "List all my lights"

---

### HTTP Transport (Web/Mobile)

**Best for:** Claude.ai web and mobile apps
**Status:** ⚠️ Ready, but Claude.ai OAuth currently broken (Anthropic issue)
**Setup:** OAuth 2.1 with Home Assistant authentication

#### Current Status

The HTTP transport is **fully implemented** and follows all OAuth 2.1 best practices. However, Claude.ai's OAuth proxy currently fails with `step=start_error` for all MCP servers (not just ours).

**When Anthropic fixes their OAuth proxy, this will work immediately.**

#### Add-on Configuration

```yaml
transport: http
port: 3000
oauth_client_url: https://your-domain.duckdns.org
```

Replace `your-domain.duckdns.org` with your public Home Assistant URL.

#### Manual Deployment Environment

```bash
export SUPERVISOR_TOKEN='your_ha_long_lived_token'
export OAUTH_CLIENT_URL='https://your-domain.duckdns.org'
export TRANSPORT='http'
export PORT='3000'

node dist/index.js
```

#### OAuth Endpoints

The server implements RFC-compliant OAuth 2.1:

- **Discovery:** `/.well-known/oauth-authorization-server`
- **Resource Metadata:** `/.well-known/oauth-protected-resource/mcp`
- **Client Registration:** `POST /mcp/oauth/register` (RFC 7591)
- **Authorization:** `/auth/authorize` → redirects to HA OAuth
- **Token Exchange:** `POST /auth/token`
- **Token Refresh:** `POST /auth/token` (grant_type=refresh_token) ✅ v2.1.0
- **MCP Endpoint:** `GET /mcp` (Server-Sent Events)

#### Session Persistence

**v2.1.0+:** Sessions persist across server restarts using SQLite storage at `/config/mcp-sessions.db`.

**Features:**
- OAuth sessions survive restarts
- Automatic cleanup of expired sessions
- Production-ready for HTTP mode

#### Adding to Claude.ai (When Fixed)

1. Go to https://claude.ai → Settings → Connectors
2. Click "Add Custom Connector"
3. Enter:
   - **Name:** Home Assistant
   - **URL:** `https://your-domain.duckdns.org/mcp`
4. Complete OAuth flow (authenticate with HA)
5. Start chatting!

#### Testing Locally

```bash
# Test discovery endpoint
curl https://your-domain.duckdns.org/.well-known/oauth-authorization-server

# Test client registration
curl -X POST https://your-domain.duckdns.org/mcp/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"client_name":"Test","redirect_uris":["http://localhost:3000/callback"]}'

# Verify 401 on protected resource
curl -I https://your-domain.duckdns.org/mcp
# Should return: HTTP/1.1 401 Unauthorized
```

#### Transport Comparison

| Feature | stdio | HTTP OAuth |
|---------|-------|------------|
| **Works with** | Desktop, Code | Web, iOS, Android |
| **Setup** | SSH only | OAuth + HTTPS |
| **Security** | SSH keys | OAuth tokens |
| **Session persistence** | N/A | ✅ SQLite (v2.1.0+) |
| **Current status** | ✅ Working | ⚠️ Ready (Claude OAuth broken) |

---

## Security & Permissions

### What the Server Can Access

**132 Tools Total:**
- **73 Layered Tools** (Domain, System, Advanced layers)
- **44 API-Level Tools** (Entities, config, automation, etc.)
- **15 Root-Level Tools** (Filesystem, database, commands)

### Permission System

**v2.1.0:** Auto-grants all permissions for single-user deployments.

This is appropriate for personal home automation systems where you own the hardware and are the sole operator. For multi-user or internet-exposed deployments, review the security model.

### Root-Level Tools (Require Permission)

**Filesystem Access (6 tools):**
- Allows: `/config`, `/ssl`, `/backup`, `/share`, `/media`, `/addons`
- Blocks: `/etc`, `/usr`, `/bin`, `/sbin`, `/sys`, `/proc`
- File size limits prevent token overload

**Database Access (5 tools):**
- SQL queries on Home Assistant recorder database
- Whitelisted tables only
- All queries logged

**System Commands (4 tools):**
- Shell command execution on host
- Timeout protection (30s default)
- Output size limits (10MB max)
- All commands logged

### Best Practices

1. **Use stdio for local access** - More secure than HTTP
2. **Monitor add-on logs** - All privileged operations logged
3. **Keep updated** - Security patches in new versions
4. **Use HTTPS for HTTP transport** - Required for production
5. **Review what Claude is doing** - Check logs periodically

---

## Troubleshooting

### Add-on Won't Start

1. Check **Log** tab for errors
2. Verify configuration is valid YAML
3. Ensure SUPERVISOR_TOKEN available (automatic in add-ons)

### Claude Desktop Can't Connect (stdio)

1. Test SSH: `ssh root@homeassistant.local`
2. Verify add-on is running (check **Info** tab)
3. Check token is valid
4. Try restarting Claude Desktop

### HTTP OAuth Issues

**Error: `step=start_error`**
→ Claude.ai OAuth proxy issue (Anthropic bug, not your server)

**Error: `404` on protected resource metadata**
→ Check `/.well-known/oauth-protected-resource/mcp` is accessible

**Error: `invalid_client` during registration**
→ Ensure request includes `redirect_uris` array

**Error: `unauthorized` when accessing /mcp**
→ Need valid Bearer token (complete OAuth flow first)

### Tools Not Working

1. Check add-on logs for errors
2. Verify Home Assistant is accessible
3. For root tools, ensure permissions are granted
4. Test API-level tools first (don't require permissions)

### Permission Issues

1. Check add-on logs for permission messages
2. Ensure running latest version
3. Try restarting add-on to reset permissions

---

## Advanced Configuration

### Custom OAuth Configuration

```yaml
transport: http
port: 3000
oauth_client_url: https://custom-domain.com
```

### Environment Variables

**Automatically set by add-on:**
- `TRANSPORT` - from config (stdio or http)
- `PORT` - from config
- `OAUTH_CLIENT_URL` - from config
- `HA_URL` - auto: `http://supervisor/core`
- `SUPERVISOR_TOKEN` - provided by Home Assistant

**Manual deployment only:**
```bash
export SUPERVISOR_TOKEN='your_token'
export OAUTH_CLIENT_URL='https://your-url.com'
export TRANSPORT='http'  # or 'stdio'
export PORT='3000'
```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

```bash
docker build -t ha-mcp-server .
docker run \
  -e SUPERVISOR_TOKEN='...' \
  -e OAUTH_CLIENT_URL='...' \
  -e TRANSPORT='http' \
  -p 3000:3000 \
  ha-mcp-server
```

### Updating the Add-on

1. **Settings** → **Add-ons** → **Add-on Store**
2. Find MCP Server add-on
3. Click **Update** if available
4. Add-on automatically restarts with new version

The add-on pulls latest code from GitHub on each restart.

### Uninstalling

1. **Settings** → **Add-ons** → **MCP Server for Home Assistant**
2. Click **Uninstall**
3. Remove Claude Desktop configuration if added

---

## Getting Help

### Check Logs First

1. **Settings** → **Add-ons** → **MCP Server for Home Assistant**
2. Click **Log** tab
3. Look for errors or warnings

### Common Log Messages

- `"MCP Server ready on stdio"` ✅ Success (stdio mode)
- `"HTTP server listening on port 3000"` ✅ Success (HTTP mode)
- `"ERROR: SUPERVISOR_TOKEN environment variable is required"` ❌ Config issue
- `"[OAuth] Refreshed token successfully"` ✅ Token refresh working (v2.1.0+)

### Need More Help?

- Check main README for troubleshooting
- Review GitHub issues for similar problems
- Open new issue with add-on logs attached

---

## What's Next?

Once installed, Claude can:
- Control lights, switches, and devices
- Analyze energy usage and statistics
- Create and manage automations
- Troubleshoot issues via logs and configs
- Back up configurations before changes
- Query historical data and create reports
- Execute shell commands (with permission)
- Access and modify configuration files (with permission)

**Enjoy your AI-powered smart home!** 🏠🤖

---

## References

- [RFC 6749: OAuth 2.0](https://tools.ietf.org/html/rfc6749)
- [RFC 8414: OAuth 2.0 Authorization Server Metadata](https://tools.ietf.org/html/rfc8414)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://tools.ietf.org/html/rfc9728)
- [RFC 7591: OAuth 2.0 Dynamic Client Registration](https://tools.ietf.org/html/rfc7591)
- [MCP Specification: Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [Home Assistant Auth API](https://developers.home-assistant.io/docs/auth_api)
