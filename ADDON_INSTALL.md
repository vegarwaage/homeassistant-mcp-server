# Home Assistant Add-on Installation Guide

This guide walks you through installing the MCP Server as a Home Assistant add-on, giving Claude AI comprehensive access to your Home Assistant instance.

## Prerequisites

- Home Assistant OS or Supervised installation
- GitHub account (for repository URL)
- SSH access to Home Assistant (for stdio transport with Claude Desktop/Code)

## What You'll Get

The add-on provides:
- **59 tools** (44 API-level + 15 root-level) for complete HA control
- **Dual transport support**: stdio (for Claude Desktop/Code) or HTTP (for web/mobile)
- **Auto-deployment**: Automatically deploys to `/config/mcp-server` on startup for easy GitHub updates
- **Permission-based security**: Category-based approval for filesystem, database, and command access
- **Safety constraints**: Automatic blocking of critical system paths
- **Automatic configuration backups**: All config changes are backed up before modification

## Installation Steps

### 1. Add Repository to Home Assistant

1. Open your Home Assistant instance
2. Navigate to **Settings** → **Add-ons** → **Add-on Store**
3. Click the **⋮** menu (top right) → **Repositories**
4. Add this repository URL:
   ```
   https://github.com/[your-username]/homeassistant-assistant
   ```
5. Click **Add** and close the dialog

### 2. Install MCP Server Add-on

1. Refresh the add-on store page (you may need to reload)
2. Find **"MCP Server for Home Assistant"** in the list
3. Click on it, then click **Install**
4. Wait for installation to complete (this may take a few minutes)

### 3. Configure the Add-on

The add-on supports two transport modes. Choose based on your use case:

#### Option A: stdio Transport (for Claude Desktop & Claude Code)

This is the recommended option for desktop usage. It provides direct stdio communication over SSH.

**Configuration:**
```yaml
transport: stdio
port: 3000  # Not used for stdio, but required by schema
oauth_client_url: ""
```

**Steps:**
1. Go to the **Configuration** tab of the add-on
2. Set `transport` to `stdio`
3. Click **Save**
4. Go to the **Info** tab and click **Start**
5. Check the **Log** tab to verify it started successfully - you should see "MCP Server ready on stdio"

#### Option B: HTTP Transport (for Web & Mobile - when OAuth is configured)

This option enables web and mobile clients to connect via HTTP with OAuth 2.1 authentication.

**Configuration:**
```yaml
transport: http
port: 3000
oauth_client_url: https://your-homeassistant-url.com
```

**Steps:**
1. Go to the **Configuration** tab of the add-on
2. Set `transport` to `http`
3. Set `port` to your desired port (default: 3000)
4. Set `oauth_client_url` to your Home Assistant URL
5. Click **Save**
6. Go to the **Info** tab and click **Start**
7. Check the **Log** tab to verify it started - you should see "HTTP server listening on port 3000"

### 4. Connect Claude Desktop (stdio transport only)

If using stdio transport, you'll connect Claude Desktop via SSH.

#### 4a. Set up SSH Access

First, ensure you have SSH access to your Home Assistant instance:

```bash
# Test SSH connection
ssh root@homeassistant.local

# If this works, you're ready to proceed
```

#### 4b. Configure Claude Desktop

The add-on automatically deploys the MCP server to `/config/mcp-server` when it starts. You'll connect to this deployed copy (not the Docker container directly).

Add the following to your Claude Desktop configuration file:

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

**Important:** Replace `YOUR_TOKEN_HERE` with your Home Assistant long-lived access token.

To get your token:
1. In Home Assistant: Profile (bottom left) → Long-Lived Access Tokens → Create Token
2. Copy the token and paste it into the config above

**Note:** The add-on automatically redeploys on every restart, so updates from GitHub are seamless!

#### 4c. Verify Connection

1. Restart Claude Desktop
2. Open a new chat
3. You should see "homeassistant" in the MCP servers list
4. Try a command like: "List all my lights"

If it works, you should get a response with your Home Assistant lights!

### 5. Using Root-Level Tools

The add-on provides 15 root-level tools for filesystem, database, and command access. These require explicit permission approval.

#### Permission Flow

When Claude attempts to use a root-level tool for the first time in a session:

1. You'll see a permission request message explaining what access is needed
2. The request shows which category is required:
   - **Filesystem**: Access to /config, /ssl, /backup, /share, /media, /addons
   - **Database**: Execute SQL queries on HA recorder database
   - **Commands**: Run shell commands on the host system
3. Approve by responding "yes" or similar confirmation
4. Once approved, all tools in that category work for the rest of the session

#### Safety Features

**Filesystem:**
- Blocks writes to: /etc, /usr, /bin, /sbin, /sys, /proc
- Allows access to: /config, /ssl, /backup, /share, /media, /addons
- File size limits prevent token overload

**Database:**
- Read-write access to /config/home-assistant_v2.db
- SQL warnings for queries without LIMIT
- All queries logged to add-on logs

**Commands:**
- Full root access after approval
- Timeout protection (default 30s)
- Output size limits (10MB max)
- All commands logged to add-on logs

## Troubleshooting

### Add-on Won't Start

1. Check the **Log** tab for error messages
2. Verify your configuration is valid YAML
3. Ensure SUPERVISOR_TOKEN is available (this is automatic in add-ons)

### Claude Desktop Can't Connect

1. Verify SSH access: `ssh root@homeassistant.local`
2. Check the Docker container name is correct
3. Ensure the add-on is running (check **Info** tab)
4. Try restarting Claude Desktop

### Permission Requests Not Working

1. Check the add-on logs for permission request messages
2. Ensure you're running the latest version of the add-on
3. Try restarting the add-on to reset permissions

### Tools Not Working

1. Check the add-on logs for error messages
2. Verify your Home Assistant instance is accessible
3. For root tools, ensure you've approved the required permission category
4. Test API-level tools first (they don't require special permissions)

## Updating the Add-on

When a new version is available:

1. Go to **Settings** → **Add-ons** → **Add-on Store**
2. Find the MCP Server add-on
3. If an update is available, you'll see an **Update** button
4. Click **Update** and wait for it to complete
5. The add-on will automatically restart with the new version

## Uninstalling

To remove the add-on:

1. Go to **Settings** → **Add-ons**
2. Click on **MCP Server for Home Assistant**
3. Click **Uninstall**
4. Remove the Claude Desktop configuration entry if you added one

## Security Considerations

### What the Add-on Can Access

- **Full Home Assistant API**: All entities, automations, configurations, and services
- **File System** (with approval): Home Assistant config, backups, and user directories
- **Database** (with approval): Complete read-write access to HA recorder database
- **System Commands** (with approval): Ability to execute any shell command as root

### Best Practices

1. **Use stdio transport for local access**: More secure than exposing HTTP endpoints
2. **Review permission requests carefully**: Only approve when you understand what Claude is trying to do
3. **Monitor add-on logs**: All privileged operations are logged for audit purposes
4. **Keep the add-on updated**: Security patches are released as needed
5. **Use HTTPS for HTTP transport**: If using HTTP mode, ensure your HA instance uses HTTPS

### Data Privacy

- The add-on runs entirely on your Home Assistant instance
- No data is sent to external services (except Claude API when you use Claude)
- All communication with Claude Desktop happens over your local SSH connection
- Root-level operations require explicit approval per session

## Advanced Configuration

### Custom OAuth Configuration

If you need to customize OAuth settings for HTTP transport:

```yaml
transport: http
port: 3000
oauth_client_url: https://your-ha-url.com
```

The server will use the OAuth 2.1 transport with PKCE for secure authentication.

### Environment Variables

The add-on automatically sets these environment variables:
- `TRANSPORT` - Set from configuration (stdio or http)
- `PORT` - Set from configuration
- `OAUTH_CLIENT_URL` - Set from configuration
- `HA_URL` - Automatically set to http://supervisor/core
- `SUPERVISOR_TOKEN` - Automatically provided by Home Assistant

You don't need to configure these manually.

## Getting Help

### Check Logs First

Most issues can be diagnosed from the logs:
1. Go to **Settings** → **Add-ons** → **MCP Server for Home Assistant**
2. Click the **Log** tab
3. Look for error messages or warnings

### Common Log Messages

- `"MCP Server ready on stdio"` - Success! Server is running
- `"HTTP server listening on port 3000"` - Success! HTTP mode is active
- `"ERROR: SUPERVISOR_TOKEN environment variable is required"` - Configuration issue
- `"Permission required: filesystem"` - Normal permission request flow

### Need More Help?

- Check the main repository README for troubleshooting tips
- Review the GitHub issues for similar problems
- Open a new issue with your add-on logs attached

## What's Next?

Once installed, you can:
- Ask Claude to control your lights, switches, and other devices
- Have Claude analyze your energy usage and statistics
- Let Claude help you create and manage automations
- Use Claude to troubleshoot issues by examining logs and configurations
- Request Claude to back up configurations before making changes
- Have Claude query your historical data and create reports

The MCP Server gives Claude comprehensive understanding of your Home Assistant setup, enabling intelligent assistance with setup, configuration, automation, and troubleshooting.

Enjoy your AI-powered smart home! 🏠🤖
