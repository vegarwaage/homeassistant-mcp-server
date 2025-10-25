# Mac Proxy Solution for iOS/Web Claude Access

**Date**: October 25, 2025
**Purpose**: Enable Claude iOS and Web apps to access Home Assistant via MCP proxy running on your Mac

---

## Problem Statement

- ✅ stdio MCP server works perfectly with Claude Desktop/Code on Mac
- ✅ HTTP MCP server (v2.1.0) is RFC-compliant but Claude.ai OAuth is incomplete
- ❌ Cannot access Home Assistant from Claude iOS or Web apps directly

## Solution: Mac as OAuth Proxy

Run an OAuth proxy on your Mac that:
1. Accepts connections from Claude.ai (using their working OAuth)
2. Connects to Home Assistant MCP server via SSH/stdio
3. Proxies all MCP requests transparently

---

## Architecture Options

### Option A: mcp-front (Recommended but Google-Only)

**Pros:**
- Purpose-built for this exact use case
- Handles all OAuth complexity
- Docker-based, easy to run
- Multi-MCP-server support

**Cons:**
- **ONLY supports Google OAuth** (no Home Assistant auth)
- Requires Google Workspace domain
- Still in development (v0.0.1-DEV)
- Requires external HTTPS domain

**Architecture:**
```
Claude.ai (OAuth) → Mac (mcp-front:8080) → HA MCP Server (SSH/stdio)
                          ↓
                    Google OAuth
```

### Option B: Custom Node.js Proxy (Flexible but More Work)

**Pros:**
- Can use Home Assistant OAuth directly
- Full control over authentication
- Can integrate with existing HA setup
- No dependency on external services

**Cons:**
- Need to build it ourselves
- More maintenance
- OAuth implementation complexity

**Architecture:**
```
Claude.ai (OAuth) → Mac (Custom Proxy:3000) → HA MCP Server (SSH/stdio)
                          ↓
                    HA OAuth (existing)
```

### Option C: Tailscale + Direct Connection

**Pros:**
- You already have Tailscale running
- Zero-trust network security
- No OAuth proxy needed
- Simplest architecture

**Cons:**
- **Claude.ai can't access Tailscale networks**
- Only works for local devices
- Doesn't solve the iOS/Web problem

---

## Recommended Approach: Custom Lightweight Proxy

Since mcp-front requires Google OAuth (not compatible with your HA OAuth), and Tailscale doesn't help with Claude.ai, I recommend:

### **Build a Simple HTTP→stdio Bridge on Mac**

This is simpler than mcp-front and works with your existing infrastructure.

**What it does:**
1. Runs HTTP server on Mac with OAuth (using your existing HA OAuth flow)
2. Spawns your stdio MCP server as child process
3. Bridges HTTP requests to stdio communication
4. Returns responses back to Claude.ai

**Why this works:**
- Reuses your working HA OAuth implementation
- Your stdio MCP server already works perfectly
- No need for Google Workspace
- Simple Node.js app (~200 lines)

---

## Implementation Plan

### Phase 1: Verify stdio Server Works (DONE ✅)
- [x] stdio MCP server builds successfully
- [x] All 17 tools implemented
- [x] Connects to Home Assistant

### Phase 2: Setup Claude Code/Desktop with stdio

**Configure ~/.claude/mcp_settings.json:**
```json
{
  "mcpServers": {
    "homeassistant": {
      "command": "ssh",
      "args": [
        "-p", "22",
        "-i", "~/.ssh/id_rsa",
        "root@homeassistant.local",
        "docker", "exec", "-i", "addon_local_homeassistant_mcp", "node", "/app/dist/index.js"
      ]
    }
  }
}
```

**Test:**
1. Open Claude Code
2. Ask: "List my Home Assistant entities"
3. Verify tools are available and working

### Phase 3: Build Mac HTTP→stdio Bridge

**Create:** `~/ha-mcp-proxy/`

**Required Files:**
1. **server.ts** - Express server with OAuth
2. **stdio-bridge.ts** - Child process manager for stdio MCP server
3. **package.json** - Dependencies
4. **config.json** - HA OAuth settings

**Key Features:**
- Reuse OAuth code from your HTTP server (already working!)
- Spawn stdio MCP server as child process
- Bridge JSON-RPC messages between HTTP and stdio
- Handle session management
- Support Streamable HTTP transport

**Dependencies:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.20.2",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "axios": "^1.6.0"
  }
}
```

### Phase 4: Expose Mac Proxy to Internet

**Option 4A: Cloudflare Tunnel (Recommended)**
- Free, secure, no port forwarding
- HTTPS automatic
- Easy setup with cloudflared
- `cloudflared tunnel --url localhost:3001`

**Option 4B: ngrok**
- Free tier available
- HTTPS included
- `ngrok http 3001`

**Option 4C: Port Forward on Router**
- More complex
- Requires static IP or DDNS
- Security considerations

### Phase 5: Configure Claude.ai

Once proxy is running at `https://your-mac-proxy.com`:

1. Go to Claude.ai → Settings → Connectors
2. Add Custom Connector: `https://your-mac-proxy.com/mcp`
3. Complete OAuth flow (uses your HA credentials)
4. Test tools from Claude iOS/Web

---

## Quick Start: stdio Server First

**Before building the proxy, let's verify the stdio server works:**

### 1. Test stdio server locally

```bash
cd ~/Koding/homeassistant-assistant/homeassistant-mcp-server

# Set HA connection
export SUPERVISOR_TOKEN="your-ha-token"

# Start server (will wait for stdio input)
npm start
```

**Send test request via stdin:**
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
```

Expected: JSON response with server capabilities

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "homeassistant": {
      "command": "ssh",
      "args": [
        "-p", "22",
        "-i", "/Users/selwa/.ssh/id_rsa",
        "root@homeassistant.local",
        "docker", "exec", "-i", "addon_local_homeassistant_mcp",
        "node", "/app/dist/index.js"
      ]
    }
  }
}
```

**Test in Claude Desktop:**
- Restart Claude Desktop
- New conversation
- Ask: "What Home Assistant tools do you have?"
- Should see all 17 tools listed

---

## Cost & Complexity Analysis

### mcp-front
- **Cost**: Free (if you have Google Workspace)
- **Time**: 2-3 hours setup
- **Complexity**: Medium (Docker, Google OAuth)
- **Limitation**: Requires Google account

### Custom Proxy
- **Cost**: Free (Cloudflare Tunnel) or $5-10/mo (ngrok Pro)
- **Time**: 4-6 hours development + testing
- **Complexity**: Medium-High (build from scratch)
- **Benefit**: Full control, uses HA OAuth

### stdio Only (Current)
- **Cost**: Free
- **Time**: 30 minutes
- **Complexity**: Low
- **Limitation**: Desktop/Code only, no iOS/Web

---

## My Recommendation

**Start with stdio setup** (30 min):
1. Configure Claude Desktop with SSH connection
2. Verify all 17 tools work
3. Use this for immediate productivity

**Then evaluate proxy need:**
- If you rarely need iOS/Web access → stick with stdio
- If you need mobile access frequently → build custom proxy
- If you have Google Workspace → try mcp-front

**Why wait on proxy:**
- stdio is proven working
- Proxy adds complexity
- Claude.ai OAuth might get fixed (then you don't need proxy)
- Your HTTP server is already ready for when they fix it

---

## Next Steps

**Immediate (Today):**
1. ✅ Verify stdio server builds
2. ⏭️ Configure Claude Desktop with SSH connection
3. ⏭️ Test all 17 tools in Claude Desktop
4. ⏭️ Document which tools work best

**Short-term (This Week):**
1. Monitor GitHub issues for Claude.ai OAuth fixes
2. Test stdio server with Claude Code
3. Create example workflows using HA tools

**Long-term (If Needed):**
1. Build custom HTTP→stdio proxy
2. Deploy with Cloudflare Tunnel
3. Test from Claude iOS/Web
4. Document setup for others

---

## Files to Create

### For stdio Setup:
- `~/.claude/mcp_settings.json` (Claude Code)
- `~/Library/Application Support/Claude/claude_desktop_config.json` (Claude Desktop)
- `~/ha-mcp-test.sh` (testing script)

### For Custom Proxy (Future):
- `~/ha-mcp-proxy/server.ts`
- `~/ha-mcp-proxy/stdio-bridge.ts`
- `~/ha-mcp-proxy/oauth.ts`
- `~/ha-mcp-proxy/package.json`
- `~/ha-mcp-proxy/README.md`

---

## Resources

- **stdio MCP Server**: `/Users/selwa/Koding/homeassistant-assistant/homeassistant-mcp-server`
- **HTTP MCP Server**: `/Users/selwa/Koding/homeassistant-assistant/.worktrees/ha-mcp-http`
- **MCP SDK Docs**: https://modelcontextprotocol.io
- **mcp-front**: https://github.com/dgellow/mcp-front
- **Cloudflare Tunnel**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

---

**Status**: Ready to configure stdio server for immediate use
**Risk**: Low - stdio is proven technology
**Benefit**: Access all 17 HA tools from Claude Desktop/Code today
