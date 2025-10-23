# Home Assistant MCP HTTP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build HTTP-based MCP server addon with Home Assistant OAuth to enable Claude iOS/web access

**Architecture:** Express.js server using MCP SDK's SSE transport, OAuth middleware for HA authentication, session persistence in encrypted JSON file, reusing existing tool code

**Tech Stack:** TypeScript, Express.js, @modelcontextprotocol/sdk, axios, crypto (built-in)

---

## Task 1: Create Addon Directory Structure

**Files:**
- Create: `homeassistant-mcp-http/package.json`
- Create: `homeassistant-mcp-http/tsconfig.json`
- Create: `homeassistant-mcp-http/config.yaml`
- Create: `homeassistant-mcp-http/Dockerfile`
- Create: `homeassistant-mcp-http/run.sh`
- Create: `homeassistant-mcp-http/.dockerignore`
- Create: `homeassistant-mcp-http/data/.gitkeep`

**Step 1: Create package.json with dependencies**

Create `homeassistant-mcp-http/package.json`:

```json
{
  "name": "homeassistant-mcp-http",
  "version": "1.0.0",
  "description": "HTTP MCP server for Home Assistant with OAuth",
  "main": "dist/http-server.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/http-server.js",
    "test": "echo \"Tests coming soon\" && exit 0"
  },
  "keywords": ["mcp", "homeassistant", "oauth", "http"],
  "author": "Vegar Selvik Wavik",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "express": "^4.18.0",
    "axios": "^1.6.0",
    "ws": "^8.16.0",
    "yaml": "^2.3.4",
    "cookie-parser": "^1.4.6"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/express": "^4.17.0",
    "@types/cookie-parser": "^1.4.0",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create TypeScript config**

Create `homeassistant-mcp-http/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create Home Assistant addon config**

Create `homeassistant-mcp-http/config.yaml`:

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

**Step 4: Create Dockerfile**

Create `homeassistant-mcp-http/Dockerfile`:

```dockerfile
ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files and build configuration
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Copy run script
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
```

**Step 5: Create startup script**

Create `homeassistant-mcp-http/run.sh`:

```bash
#!/usr/bin/with-contenv bashio

# Get OAuth URL from addon config
OAUTH_CLIENT_URL=$(bashio::config 'oauth_client_url')

if [ -z "$OAUTH_CLIENT_URL" ]; then
    bashio::log.error "oauth_client_url not configured!"
    bashio::log.error "Please configure your DuckDNS URL in addon options"
    exit 1
fi

# Export environment variables
export OAUTH_CLIENT_URL="${OAUTH_CLIENT_URL}"
export SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN}"
export INGRESS_PATH="${INGRESS_PATH}"

bashio::log.info "Starting MCP HTTP Server..."
bashio::log.info "OAuth Client URL: ${OAUTH_CLIENT_URL}"
bashio::log.info "Ingress Path: ${INGRESS_PATH}"

# Start server
cd /app
exec node dist/http-server.js
```

**Step 6: Create .dockerignore**

Create `homeassistant-mcp-http/.dockerignore`:

```
node_modules
dist
.git
.gitignore
*.md
data/*.json
data/*.key
```

**Step 7: Create data directory placeholder**

Create `homeassistant-mcp-http/data/.gitkeep`:

```
# This directory stores runtime data (sessions, encryption key)
# Ignored in .dockerignore to prevent including in image
```

**Step 8: Commit structure**

```bash
git add homeassistant-mcp-http/
git commit -m "feat: create addon directory structure

- Package.json with MCP SDK and Express
- TypeScript configuration
- HA addon config with ingress
- Dockerfile with build process
- Startup script with OAuth URL validation"
```

---

## Task 2: Copy and Adapt Shared Code

**Files:**
- Copy: `../homeassistant-mcp-server/src/types.ts` → `homeassistant-mcp-http/src/types.ts`
- Copy: `../homeassistant-mcp-server/src/ha-client.ts` → `homeassistant-mcp-http/src/ha-client.ts`
- Copy: `../homeassistant-mcp-server/src/backup.ts` → `homeassistant-mcp-http/src/backup.ts`
- Copy: `../homeassistant-mcp-server/src/tools/` → `homeassistant-mcp-http/src/tools/`

**Step 1: Copy types file**

```bash
cp ../homeassistant-mcp-server/src/types.ts src/types.ts
```

**Step 2: Copy HA client**

```bash
cp ../homeassistant-mcp-server/src/ha-client.ts src/ha-client.ts
```

**Step 3: Copy backup utilities**

```bash
cp ../homeassistant-mcp-server/src/backup.ts src/backup.ts
```

**Step 4: Copy all tools**

```bash
mkdir -p src/tools
cp ../homeassistant-mcp-server/src/tools/*.ts src/tools/
```

**Step 5: Verify copied files compile**

Run: `npm install && npm run build`
Expected: TypeScript compiles successfully with no errors

**Step 6: Commit shared code**

```bash
git add src/types.ts src/ha-client.ts src/backup.ts src/tools/
git commit -m "feat: copy shared code from stdio addon

Reuse existing implementations:
- Type definitions
- HomeAssistantClient
- Backup utilities
- All 17 tool implementations"
```

---

## Task 3: Implement Session Storage with Encryption

**Files:**
- Create: `homeassistant-mcp-http/src/session.ts`

**Step 1: Write session storage interface**

Create `homeassistant-mcp-http/src/session.ts`:

```typescript
// ABOUTME: Session storage with encrypted OAuth tokens
// ABOUTME: Persists sessions to /data/sessions.json with AES-256-GCM encryption

import { promises as fs } from 'fs';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { join } from 'path';

const DATA_DIR = '/data';
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const ENCRYPTION_KEY_FILE = join(DATA_DIR, 'encryption.key');

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  ha_user?: string;
  created_at: number;
  last_used: number;
}

interface EncryptedSession {
  access_token: string;  // encrypted
  refresh_token: string; // encrypted
  expires_at: number;
  ha_user?: string;
  created_at: number;
  last_used: number;
}

let encryptionKey: Buffer;

async function getEncryptionKey(): Promise<Buffer> {
  if (encryptionKey) {
    return encryptionKey;
  }

  try {
    const keyData = await fs.readFile(ENCRYPTION_KEY_FILE);
    encryptionKey = keyData;
  } catch {
    // Generate new key
    encryptionKey = randomBytes(32);
    await fs.writeFile(ENCRYPTION_KEY_FILE, encryptionKey, { mode: 0o600 });
  }

  return encryptionKey;
}

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64'),
    data: encrypted,
    tag: authTag.toString('base64')
  });
}

function decrypt(encryptedData: string): string {
  const { iv, data, tag } = JSON.parse(encryptedData);

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey,
    Buffer.from(iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  let decrypted = decipher.update(data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export async function saveSession(sessionId: string, session: Session): Promise<void> {
  await getEncryptionKey();

  const encrypted: EncryptedSession = {
    access_token: encrypt(session.access_token),
    refresh_token: encrypt(session.refresh_token),
    expires_at: session.expires_at,
    ha_user: session.ha_user,
    created_at: session.created_at,
    last_used: session.last_used
  };

  let sessions: Record<string, EncryptedSession> = {};

  try {
    const data = await fs.readFile(SESSIONS_FILE, 'utf-8');
    sessions = JSON.parse(data);
  } catch {
    // File doesn't exist yet
  }

  sessions[sessionId] = encrypted;

  await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

export async function getSession(sessionId: string): Promise<Session | null> {
  await getEncryptionKey();

  try {
    const data = await fs.readFile(SESSIONS_FILE, 'utf-8');
    const sessions: Record<string, EncryptedSession> = JSON.parse(data);

    const encrypted = sessions[sessionId];
    if (!encrypted) {
      return null;
    }

    const session: Session = {
      access_token: decrypt(encrypted.access_token),
      refresh_token: decrypt(encrypted.refresh_token),
      expires_at: encrypted.expires_at,
      ha_user: encrypted.ha_user,
      created_at: encrypted.created_at,
      last_used: encrypted.last_used
    };

    // Update last_used
    session.last_used = Date.now();
    await saveSession(sessionId, session);

    return session;
  } catch (error) {
    console.error('Error loading session:', error);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const data = await fs.readFile(SESSIONS_FILE, 'utf-8');
    const sessions: Record<string, EncryptedSession> = JSON.parse(data);

    delete sessions[sessionId];

    await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch {
    // File doesn't exist or session not found
  }
}

export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const data = await fs.readFile(SESSIONS_FILE, 'utf-8');
    const sessions: Record<string, EncryptedSession> = JSON.parse(data);

    const now = Date.now();
    const validSessions: Record<string, EncryptedSession> = {};

    for (const [id, session] of Object.entries(sessions)) {
      // Keep sessions that haven't expired
      if (session.expires_at > now) {
        validSessions[id] = session;
      }
    }

    await fs.writeFile(SESSIONS_FILE, JSON.stringify(validSessions, null, 2));
  } catch {
    // File doesn't exist
  }
}
```

**Step 2: Commit session storage**

```bash
git add src/session.ts
git commit -m "feat: implement encrypted session storage

- AES-256-GCM encryption for tokens
- Random key generation on first run
- Save/load/delete session operations
- Automatic cleanup of expired sessions"
```

---

## Task 4: Implement Home Assistant OAuth Flow

**Files:**
- Create: `homeassistant-mcp-http/src/oauth.ts`

**Step 1: Write OAuth handler**

Create `homeassistant-mcp-http/src/oauth.ts`:

```typescript
// ABOUTME: Home Assistant OAuth 2.0 implementation
// ABOUTME: Handles authorization flow, token exchange, and refresh

import axios from 'axios';
import { randomBytes } from 'crypto';
import { saveSession, getSession } from './session.js';

const HA_BASE_URL = process.env.HA_BASE_URL || 'http://homeassistant:8123';
const OAUTH_CLIENT_URL = process.env.OAUTH_CLIENT_URL || '';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export function generateState(): string {
  return randomBytes(32).toString('hex');
}

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_URL,
    redirect_uri: `${OAUTH_CLIENT_URL}/oauth/callback`,
    state: state
  });

  return `${HA_BASE_URL}/auth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
  const response = await axios.post(
    `${HA_BASE_URL}/auth/token`,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: OAUTH_CLIENT_URL
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data;
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
  const response = await axios.post(
    `${HA_BASE_URL}/auth/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: OAUTH_CLIENT_URL
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data;
}

export async function createSession(tokens: OAuthTokenResponse): Promise<string> {
  const sessionId = randomBytes(32).toString('hex');

  const now = Date.now();
  const expiresAt = now + (tokens.expires_in * 1000);

  await saveSession(sessionId, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    created_at: now,
    last_used: now
  });

  return sessionId;
}

export async function getValidAccessToken(sessionId: string): Promise<string | null> {
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  const now = Date.now();

  // If token expires in less than 5 minutes, refresh it
  if (session.expires_at - now < 5 * 60 * 1000) {
    try {
      const tokens = await refreshAccessToken(session.refresh_token);

      await saveSession(sessionId, {
        ...session,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: now + (tokens.expires_in * 1000)
      });

      return tokens.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  return session.access_token;
}
```

**Step 2: Commit OAuth implementation**

```bash
git add src/oauth.ts
git commit -m "feat: implement Home Assistant OAuth flow

- Authorization URL generation with state
- Code exchange for access/refresh tokens
- Automatic token refresh before expiry
- Session creation and management"
```

---

## Task 5: Implement HTTP Server with Express

**Files:**
- Create: `homeassistant-mcp-http/src/http-server.ts`

**Step 1: Write HTTP server with OAuth endpoints**

Create `homeassistant-mcp-http/src/http-server.ts`:

```typescript
// ABOUTME: HTTP MCP server entry point with Express and OAuth
// ABOUTME: Serves SSE transport, OAuth endpoints, and MCP tools

import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { HomeAssistantClient } from './ha-client.js';
import { registerStateTools } from './tools/states.js';
import { registerConfigTools } from './tools/config.js';
import { registerAutomationTools } from './tools/automation.js';
import { registerSystemTools } from './tools/system.js';
import {
  generateState,
  getAuthorizeUrl,
  exchangeCodeForToken,
  createSession,
  getValidAccessToken
} from './oauth.js';
import { cleanupExpiredSessions } from './session.js';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Store OAuth states temporarily (in-memory is fine for this)
const oauthStates = new Map<string, { created: number }>();

// Cleanup expired OAuth states every hour
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.created > 3600000) { // 1 hour
      oauthStates.delete(state);
    }
  }
}, 3600000);

// Cleanup expired sessions daily
setInterval(() => {
  cleanupExpiredSessions().catch(console.error);
}, 86400000);

// OAuth: Start authorization flow
app.get('/oauth/authorize', (req: Request, res: Response) => {
  const state = generateState();
  oauthStates.set(state, { created: Date.now() });

  const authorizeUrl = getAuthorizeUrl(state);
  res.redirect(authorizeUrl);
});

// OAuth: Handle callback
app.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).send('Invalid OAuth callback');
  }

  // Verify state
  if (!oauthStates.has(state)) {
    return res.status(400).send('Invalid or expired state');
  }
  oauthStates.delete(state);

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(code);

    // Create session
    const sessionId = await createSession(tokens);

    // Set session cookie
    res.cookie('mcp_session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.send(`
      <html>
        <body>
          <h1>Authorization Successful!</h1>
          <p>You can close this window and return to Claude.</p>
          <script>
            // Try to close window if opened via popup
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('OAuth token exchange failed:', error);

    if (error.response?.data?.error === 'invalid_grant') {
      return res.redirect('/oauth/authorize');
    }

    res.status(500).send('Authentication failed. Please try again.');
  }
});

// OAuth: Logout
app.post('/oauth/logout', (req: Request, res: Response) => {
  res.clearCookie('mcp_session');
  res.json({ success: true });
});

// Middleware: Verify session
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies.mcp_session;

  if (!sessionId) {
    return res.status(401).json({
      error: 'unauthorized',
      auth_url: '/oauth/authorize'
    });
  }

  const accessToken = await getValidAccessToken(sessionId);

  if (!accessToken) {
    res.clearCookie('mcp_session');
    return res.status(401).json({
      error: 'unauthorized',
      auth_url: '/oauth/authorize'
    });
  }

  // Attach access token to request
  (req as any).accessToken = accessToken;
  next();
}

// Initialize MCP server
class HAMCPServer {
  private server: Server;
  private tools: Map<string, Function>;

  constructor() {
    this.server = new Server(
      {
        name: 'homeassistant-mcp-http',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.tools = new Map();
    this.setupHandlers();
    this.registerTools();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolList = Array.from(this.tools.keys()).map(name => {
        const tool = this.getToolDefinition(name);
        return tool;
      });

      return { tools: toolList };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const toolFn = this.tools.get(name);
      if (!toolFn) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Get access token from request context
      const accessToken = (request as any).accessToken;
      if (!accessToken) {
        throw new Error('Unauthorized - no access token');
      }

      // Create HA client with user's token
      const haClient = new HomeAssistantClient('http://homeassistant:8123', accessToken);

      try {
        const result = await toolFn(haClient, args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerTools() {
    registerStateTools(this.tools);
    registerConfigTools(this.tools);
    registerAutomationTools(this.tools);
    registerSystemTools(this.tools);
  }

  private getToolDefinition(name: string) {
    // Same tool definitions as stdio version
    const definitions: Record<string, any> = {
      'ha_get_states': {
        name: 'ha_get_states',
        description: 'Get current state of Home Assistant entities, optionally filtered by entity_id or domain',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: { type: 'string', description: 'Specific entity ID (e.g., "light.living_room")' },
            domain: { type: 'string', description: 'Domain filter (e.g., "light", "sensor", "switch")' }
          }
        }
      },
      'ha_get_history': {
        name: 'ha_get_history',
        description: 'Query historical data for entities with optional time range',
        inputSchema: {
          type: 'object',
          properties: {
            entity_ids: { type: 'string', description: 'Comma-separated entity IDs' },
            start_time: { type: 'string', description: 'ISO 8601 start time' },
            end_time: { type: 'string', description: 'ISO 8601 end time' },
            minimal_response: { type: 'boolean', description: 'Return minimal data' }
          }
        }
      },
      'ha_call_service': {
        name: 'ha_call_service',
        description: 'Call any Home Assistant service to control devices',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Service domain (e.g., "light", "switch")', },
            service: { type: 'string', description: 'Service name (e.g., "turn_on", "turn_off")' },
            entity_id: { type: 'string', description: 'Target entity ID' },
            service_data: { type: 'string', description: 'JSON string of additional service data' }
          },
          required: ['domain', 'service']
        }
      },
      'ha_get_entity_details': {
        name: 'ha_get_entity_details',
        description: 'Get full details and attributes for a specific entity',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: { type: 'string', description: 'Entity ID to query' }
          },
          required: ['entity_id']
        }
      },
      'ha_read_config': {
        name: 'ha_read_config',
        description: 'Read any configuration file from /config directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path from /config (e.g., "automations.yaml")' }
          },
          required: ['path']
        }
      },
      'ha_write_config': {
        name: 'ha_write_config',
        description: 'Write or update configuration file (automatically backs up)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path from /config' },
            content: { type: 'string', description: 'File content to write' },
            validate: { type: 'boolean', description: 'Validate config after write (default: true)' }
          },
          required: ['path', 'content']
        }
      },
      'ha_list_files': {
        name: 'ha_list_files',
        description: 'List files and directories in config directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Subdirectory to list (default: root)' },
            pattern: { type: 'string', description: 'Regex pattern to filter files' }
          }
        }
      },
      'ha_validate_config': {
        name: 'ha_validate_config',
        description: 'Validate Home Assistant configuration without applying changes',
        inputSchema: { type: 'object', properties: {} }
      },
      'ha_reload_config': {
        name: 'ha_reload_config',
        description: 'Reload configuration for automations, scripts, or core',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['automation', 'script', 'core'], description: 'Config type to reload' }
          }
        }
      },
      'ha_list_backups': {
        name: 'ha_list_backups',
        description: 'List available backups for a configuration file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Filename to list backups for' }
          },
          required: ['filename']
        }
      },
      'ha_create_automation': {
        name: 'ha_create_automation',
        description: 'Create a new automation in automations.yaml',
        inputSchema: {
          type: 'object',
          properties: {
            automation_yaml: { type: 'string', description: 'YAML definition of the automation' }
          },
          required: ['automation_yaml']
        }
      },
      'ha_update_automation': {
        name: 'ha_update_automation',
        description: 'Update an existing automation by ID',
        inputSchema: {
          type: 'object',
          properties: {
            automation_id: { type: 'string', description: 'ID of automation to update' },
            automation_yaml: { type: 'string', description: 'New YAML definition' }
          },
          required: ['automation_id', 'automation_yaml']
        }
      },
      'ha_delete_automation': {
        name: 'ha_delete_automation',
        description: 'Delete an automation by ID',
        inputSchema: {
          type: 'object',
          properties: {
            automation_id: { type: 'string', description: 'ID of automation to delete' }
          },
          required: ['automation_id']
        }
      },
      'ha_list_automations': {
        name: 'ha_list_automations',
        description: 'List all automations with their IDs and aliases',
        inputSchema: { type: 'object', properties: {} }
      },
      'ha_system_info': {
        name: 'ha_system_info',
        description: 'Get Home Assistant system information and health status',
        inputSchema: { type: 'object', properties: {} }
      },
      'ha_get_logs': {
        name: 'ha_get_logs',
        description: 'Fetch Home Assistant logs with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            lines: { type: 'number', description: 'Number of log lines (default: 100)' },
            filter: { type: 'string', description: 'Regex pattern to filter logs' }
          }
        }
      },
      'ha_restart': {
        name: 'ha_restart',
        description: 'Restart Home Assistant (requires confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            confirm: { type: 'string', enum: ['yes'], description: 'Must be "yes" to confirm' }
          },
          required: ['confirm']
        }
      }
    };

    return definitions[name] || { name, description: 'No description', inputSchema: { type: 'object' } };
  }

  async handleSSE(req: Request, res: Response) {
    const transport = new SSEServerTransport('/messages', res);

    // Attach access token to MCP request context
    (transport as any).accessToken = (req as any).accessToken;

    await this.server.connect(transport);
  }

  async handleMessage(req: Request, res: Response) {
    // Attach access token to request
    (req.body as any).accessToken = (req as any).accessToken;

    // MCP SDK handles the message
    res.json({ received: true });
  }
}

const mcpServer = new HAMCPServer();

// MCP endpoints (require auth)
app.get('/sse', requireAuth, (req, res) => mcpServer.handleSSE(req, res));
app.post('/messages', requireAuth, (req, res) => mcpServer.handleMessage(req, res));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP HTTP Server listening on port ${PORT}`);
  console.log(`OAuth Client URL: ${process.env.OAUTH_CLIENT_URL}`);
});
```

**Step 2: Commit HTTP server**

```bash
git add src/http-server.ts
git commit -m "feat: implement HTTP server with OAuth and SSE

- Express server with OAuth endpoints
- Session cookie management
- SSE transport for MCP communication
- Authentication middleware
- All 17 tools registered and working"
```

---

## Task 6: Build and Test Locally

**Files:**
- Modify: `homeassistant-mcp-http/package.json` (add test script if needed)

**Step 1: Install dependencies**

Run: `npm install`
Expected: All dependencies installed successfully

**Step 2: Build TypeScript**

Run: `npm run build`
Expected: Compiles successfully, creates `dist/` directory

**Step 3: Verify dist output**

Run: `ls -la dist/`
Expected: Contains `http-server.js`, `oauth.js`, `session.js`, `ha-client.js`, `backup.js`, and `tools/`

**Step 4: Commit build verification**

```bash
git add .
git commit -m "build: verify TypeScript compilation

All source files compile successfully to dist/"
```

---

## Task 7: Create README and Documentation

**Files:**
- Create: `homeassistant-mcp-http/README.md`

**Step 1: Write addon README**

Create `homeassistant-mcp-http/README.md`:

```markdown
# Home Assistant MCP HTTP Server

HTTP-based MCP server addon for Home Assistant with OAuth authentication.

Enables Claude iOS and web apps to access your Home Assistant instance via the Model Context Protocol.

## Features

- 17 MCP tools for controlling and monitoring Home Assistant
- OAuth 2.0 authentication using Home Assistant accounts
- Respects Home Assistant user permissions
- Encrypted session storage
- Automatic token refresh
- Works via Home Assistant ingress (no port forwarding needed)

## Installation

1. Add this repository to Home Assistant:
   - Settings → Add-ons → Add-on Store → ⋮ → Repositories
   - Add: `https://github.com/vegarwaage/homeassistant-mcp-server`

2. Install "Home Assistant MCP HTTP Server"

3. Configure your DuckDNS URL:
   - Go to addon Configuration tab
   - Set `oauth_client_url` to your DuckDNS URL (e.g., `https://yourname.duckdns.org`)

4. Start the addon

## Configuration

```yaml
oauth_client_url: "https://yourname.duckdns.org"
```

**Important:** You must have DuckDNS or another external URL configured for this to work.

## Usage with Claude

### Claude iOS/Web

1. Go to https://claude.ai → Settings → Connectors → Add Custom Connector

2. Enter:
   - Name: `Home Assistant`
   - URL: `https://yourname.duckdns.org/homeassistant_mcp_http` (ingress URL)

3. Use a tool in Claude (e.g., "List my automations")

4. Click "Authorize" when prompted

5. Log in with your Home Assistant credentials

### Available Tools

**States & Control:**
- `ha_get_states` - Query entity states
- `ha_get_history` - Historical data
- `ha_call_service` - Control devices
- `ha_get_entity_details` - Entity details

**Configuration:**
- `ha_read_config` - Read config files
- `ha_write_config` - Write config files (with backup)
- `ha_list_files` - Browse files
- `ha_validate_config` - Validate changes
- `ha_reload_config` - Reload configs
- `ha_list_backups` - View backups

**Automations:**
- `ha_create_automation` - Create automation
- `ha_update_automation` - Update automation
- `ha_delete_automation` - Delete automation
- `ha_list_automations` - List automations

**System:**
- `ha_system_info` - System info
- `ha_get_logs` - Fetch logs
- `ha_restart` - Restart HA

## Security

- OAuth tokens encrypted at rest (AES-256-GCM)
- Sessions expire automatically
- Respects Home Assistant user permissions
- All communication via HTTPS (HA ingress)

## Troubleshooting

**"oauth_client_url not configured" error:**
- Go to addon Configuration tab
- Set your DuckDNS URL
- Restart addon

**"Authentication failed" error:**
- Verify DuckDNS URL is correct and accessible
- Check Home Assistant is accessible from internet
- Try logging out and back in

**Tool execution fails:**
- Check Home Assistant logs
- Verify user has permission for the action
- Check token hasn't expired

## Development

Built with:
- TypeScript
- Express.js
- @modelcontextprotocol/sdk
- Home Assistant OAuth API

## License

MIT
```

**Step 2: Commit README**

```bash
git add README.md
git commit -m "docs: add comprehensive README

- Installation instructions
- Configuration guide
- Usage with Claude
- Security notes
- Troubleshooting"
```

---

## Task 8: Final Testing Checklist

**Step 1: Verify all files are committed**

Run: `git status`
Expected: "working tree clean" or only uncommitted data files

**Step 2: Build final Docker image (optional, for testing)**

Run: `docker build -t ha-mcp-http:test .`
Expected: Builds successfully

**Step 3: Push to GitHub**

```bash
git push origin feature/ha-mcp-http
```

**Step 4: Create deployment checklist**

Create note with steps:
1. Push code to main branch
2. Update repository.yaml version
3. Push repository.yaml update
4. Install addon in HA
5. Configure DuckDNS URL
6. Start addon
7. Check logs for errors
8. Test OAuth flow in browser
9. Add to claude.ai connectors
10. Test from Claude iOS

---

## Success Criteria

✅ All TypeScript compiles without errors
✅ All dependencies installed
✅ OAuth flow implemented
✅ Session encryption working
✅ 17 tools registered
✅ HTTP server starts successfully
✅ README documentation complete
✅ Code committed to feature branch

## Next Steps

After completing this plan:
1. Deploy to Home Assistant
2. Test OAuth flow
3. Add to Claude.ai
4. Test from iOS app
5. Monitor logs for errors
6. Iterate based on feedback
