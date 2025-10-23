# Installation Guide

## Prerequisites

- Home Assistant OS (Home Assistant Green or similar)
- SSH access to Home Assistant (SSH & Terminal addon)
- SSH key authentication set up from your Mac
- Claude Code or Claude Desktop installed

## Step 1: Add Custom Repository

1. Open Home Assistant web interface
2. Navigate to **Settings** → **Add-ons** → **Add-on Store**
3. Click the **⋮** menu (top right)
4. Select **Repositories**
5. Add this URL: `https://github.com/selwa/homeassistant-mcp-server`
6. Click **Add**

## Step 2: Install Addon

1. Refresh the Add-on Store page
2. Find "Home Assistant MCP Server" in the list
3. Click on it
4. Click **Install**
5. Wait for installation to complete (may take a few minutes)

## Step 3: Configure Addon

1. Click on the **Configuration** tab
2. Set log level (start with `info`)
3. Click **Save**

## Step 4: Start Addon

1. Go to the **Info** tab
2. Enable **Start on boot** (optional)
3. Click **Start**
4. Check the **Log** tab to verify it started successfully

## Step 5: Set Up SSH Access (If Not Already Done)

### Generate SSH key on Mac (if needed)
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
```

### Copy public key to Home Assistant
```bash
ssh-copy-id root@homeassistant.local
```

### Test SSH connection
```bash
ssh root@homeassistant.local "echo 'Connection successful'"
```

## Step 6: Configure Claude Code

1. Edit `~/.claude/mcp_settings.json`
2. Add the homeassistant server configuration (see README.md)
3. Find the correct addon container name:
   ```bash
   ssh root@homeassistant.local "docker ps | grep homeassistant_mcp"
   ```
4. Update the container name in your config if different

## Step 7: Configure Claude Desktop

1. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add the same configuration as Claude Code
3. Restart Claude Desktop

## Step 8: Verify Connection

### In Claude Code:
```bash
claude-code
```

Then type: "List all my Home Assistant entities"

### In Claude Desktop:
Open Claude Desktop and ask: "What entities do I have in Home Assistant?"

## Troubleshooting

### Addon won't start
- Check addon logs in Home Assistant UI
- Verify Node.js dependencies installed correctly
- Try rebuilding: Uninstall and reinstall addon

### Connection from Claude fails
- Verify SSH connection works manually
- Check container name is correct
- Ensure addon is running
- Check Home Assistant firewall settings

### Permission denied errors
- Verify SUPERVISOR_TOKEN is available (automatic in addon)
- Check addon has `hassio_api: true` in config.yaml

## Support

Check addon logs first:
Settings → Add-ons → Home Assistant MCP Server → Logs

Enable debug logging:
Configuration tab → Set `log_level: debug` → Restart addon
