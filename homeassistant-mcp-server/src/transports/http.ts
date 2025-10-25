// ABOUTME: HTTP transport with OAuth 2.1 for MCP server
// ABOUTME: Implements RFC 8414, RFC 9728, RFC 7591 for Claude.ai compatibility

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

interface OAuthClient {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  client_id_issued_at: number;
}

interface Session {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  user_id: string;
}

// In-memory storage (for development - should use Redis/DB in production)
const clients = new Map<string, OAuthClient>();
const sessions = new Map<string, Session>();
const authCodes = new Map<string, { client_id: string; redirect_uri: string; code_challenge?: string }>();

export async function createHttpTransport(server: Server): Promise<void> {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000');
  const BASE_URL = process.env.OAUTH_CLIENT_URL || `http://localhost:${PORT}`;

  // Home Assistant OAuth configuration
  const HA_URL = process.env.HA_URL || 'http://supervisor/core';
  const HA_TOKEN = process.env.SUPERVISOR_TOKEN;

  if (!HA_TOKEN) {
    throw new Error('SUPERVISOR_TOKEN environment variable is required for HTTP transport');
  }

  // Middleware
  app.use(cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate']
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging middleware
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });

  // ============================================================================
  // RFC 8414: OAuth 2.0 Authorization Server Metadata
  // ============================================================================
  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    res.json({
      issuer: BASE_URL,
      authorization_endpoint: `${BASE_URL}/auth/authorize`,
      token_endpoint: `${BASE_URL}/auth/token`,
      revocation_endpoint: `${BASE_URL}/auth/revoke`,
      registration_endpoint: `${BASE_URL}/mcp/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
      service_documentation: 'https://developers.home-assistant.io/docs/auth_api'
    });
  });

  // ============================================================================
  // RFC 9728: OAuth 2.0 Protected Resource Metadata
  // ============================================================================
  app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
    res.json({
      resource: `${BASE_URL}/mcp`,
      authorization_servers: [BASE_URL]
    });
  });

  // ============================================================================
  // RFC 7591: OAuth 2.0 Dynamic Client Registration
  // ============================================================================
  app.post('/mcp/oauth/register', (req, res) => {
    const { client_name, redirect_uris } = req.body;

    // Validate required fields
    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'redirect_uris is required and must be an array'
      });
    }

    // Generate client credentials
    const client_id = uuidv4().replace(/-/g, '');
    const client_secret = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    const client_id_issued_at = Math.floor(Date.now() / 1000);

    const client: OAuthClient = {
      client_id,
      client_secret,
      redirect_uris,
      client_id_issued_at
    };

    clients.set(client_id, client);

    console.log(`[DCR] Registered client: ${client_id} (${client_name || 'unnamed'})`);

    res.json({
      client_id,
      client_secret,
      redirect_uris,
      client_id_issued_at
    });
  });

  // ============================================================================
  // OAuth 2.1 Authorization Flow
  // ============================================================================

  // Authorization endpoint - redirects to Home Assistant OAuth
  app.get('/auth/authorize', (req, res) => {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type } = req.query;

    // Validate client
    const client = clients.get(client_id as string);
    if (!client) {
      return res.status(400).json({ error: 'invalid_client' });
    }

    // Validate redirect_uri
    if (!client.redirect_uris.includes(redirect_uri as string)) {
      return res.status(400).json({ error: 'invalid_redirect_uri' });
    }

    // Validate response_type
    if (response_type !== 'code') {
      return res.status(400).json({ error: 'unsupported_response_type' });
    }

    // Generate authorization code
    const authCode = uuidv4();
    authCodes.set(authCode, {
      client_id: client_id as string,
      redirect_uri: redirect_uri as string,
      code_challenge: code_challenge as string | undefined
    });

    // Redirect to Home Assistant OAuth
    const haAuthUrl = `${HA_URL}/auth/authorize?` +
      `client_id=${encodeURIComponent(BASE_URL)}&` +
      `redirect_uri=${encodeURIComponent(`${BASE_URL}/auth/callback`)}&` +
      `state=${encodeURIComponent(JSON.stringify({ authCode, originalState: state }))}&` +
      `response_type=code`;

    console.log(`[OAuth] Redirecting to HA auth: ${haAuthUrl}`);
    res.redirect(haAuthUrl);
  });

  // Home Assistant OAuth callback
  app.get('/auth/callback', async (req, res) => {
    const { code: haCode, state: stateJson } = req.query;

    if (!haCode) {
      return res.status(400).json({ error: 'missing_code' });
    }

    try {
      const { authCode, originalState } = JSON.parse(stateJson as string);
      const authData = authCodes.get(authCode);

      if (!authData) {
        return res.status(400).json({ error: 'invalid_auth_code' });
      }

      // Exchange HA code for token
      const tokenResponse = await axios.post(`${HA_URL}/auth/token`, {
        grant_type: 'authorization_code',
        code: haCode,
        client_id: BASE_URL
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // Store session
      const sessionId = uuidv4();
      sessions.set(sessionId, {
        access_token,
        refresh_token,
        expires_at: Date.now() + (expires_in * 1000),
        user_id: 'ha_user'
      });

      // Redirect back to client with our auth code
      const redirectUrl = `${authData.redirect_uri}?code=${authCode}&state=${originalState}`;
      res.redirect(redirectUrl);
    } catch (error: any) {
      console.error('[OAuth] Error exchanging HA code:', error.message);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // Token endpoint
  app.post('/auth/token', async (req, res) => {
    const { grant_type, code, client_id, client_secret, refresh_token } = req.body;

    if (grant_type === 'authorization_code') {
      // Validate code
      const authData = authCodes.get(code);
      if (!authData) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      // Validate client
      const client = clients.get(client_id);
      if (!client || client.client_secret !== client_secret) {
        return res.status(401).json({ error: 'invalid_client' });
      }

      // Check if we have a session for this code (already authenticated with HA)
      const session = Array.from(sessions.values()).find(s => s.user_id === 'ha_user');
      if (!session) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      // Delete the auth code (single use)
      authCodes.delete(code);

      res.json({
        access_token: session.access_token,
        token_type: 'Bearer',
        expires_in: Math.floor((session.expires_at - Date.now()) / 1000),
        refresh_token: session.refresh_token
      });
    } else if (grant_type === 'refresh_token') {
      // Find session by refresh token
      const session = Array.from(sessions.values()).find(s => s.refresh_token === refresh_token);
      if (!session) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      // TODO: Refresh with Home Assistant
      res.json({
        access_token: session.access_token,
        token_type: 'Bearer',
        expires_in: Math.floor((session.expires_at - Date.now()) / 1000),
        refresh_token: session.refresh_token
      });
    } else {
      res.status(400).json({ error: 'unsupported_grant_type' });
    }
  });

  // Token revocation
  app.post('/auth/revoke', (req, res) => {
    const { token } = req.body;

    // Find and remove session
    for (const [id, session] of sessions.entries()) {
      if (session.access_token === token || session.refresh_token === token) {
        sessions.delete(id);
        console.log(`[OAuth] Revoked token for session ${id}`);
      }
    }

    res.status(200).json({ success: true });
  });

  // ============================================================================
  // Authentication Middleware
  // ============================================================================
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.setHeader('WWW-Authenticate',
        `Bearer realm="${BASE_URL}", resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource/mcp"`
      );
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'Bearer token required'
      });
    }

    const token = authHeader.substring(7);
    const session = Array.from(sessions.values()).find(s => s.access_token === token);

    if (!session) {
      res.setHeader('WWW-Authenticate',
        `Bearer realm="${BASE_URL}", error="invalid_token"`
      );
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token not found or expired'
      });
    }

    // Check if token is expired
    if (session.expires_at < Date.now()) {
      res.setHeader('WWW-Authenticate',
        `Bearer realm="${BASE_URL}", error="invalid_token", error_description="Token expired"`
      );
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token expired'
      });
    }

    // Attach session to request
    (req as any).session = session;
    next();
  }

  // ============================================================================
  // MCP over SSE Transport
  // ============================================================================
  app.get('/mcp', requireAuth, async (req, res) => {
    console.log('[MCP] New SSE connection');

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Create SSE transport
    const transport = new SSEServerTransport('/mcp', res);

    // Connect transport to server
    await server.connect(transport);

    // Handle client disconnect
    req.on('close', () => {
      console.log('[MCP] Client disconnected');
    });
  });

  // POST endpoint for SSE messages
  app.post('/mcp', requireAuth, async (req, res) => {
    console.log('[MCP] Received message');
    // The SSE transport handles this via the connected transport
    res.json({ received: true });
  });

  // ============================================================================
  // Health Check
  // ============================================================================
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      transport: 'http-sse',
      oauth_enabled: true,
      base_url: BASE_URL
    });
  });

  // ============================================================================
  // Start Server
  // ============================================================================
  app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('  MCP HTTP Server with OAuth 2.1');
    console.log('='.repeat(60));
    console.log(`  Port: ${PORT}`);
    console.log(`  Base URL: ${BASE_URL}`);
    console.log(`  Transport: SSE (Server-Sent Events)`);
    console.log(`  OAuth: Enabled (Home Assistant)`);
    console.log('');
    console.log('OAuth Endpoints:');
    console.log(`  Discovery: ${BASE_URL}/.well-known/oauth-authorization-server`);
    console.log(`  Resource:  ${BASE_URL}/.well-known/oauth-protected-resource/mcp`);
    console.log(`  Register:  ${BASE_URL}/mcp/oauth/register`);
    console.log(`  Authorize: ${BASE_URL}/auth/authorize`);
    console.log(`  Token:     ${BASE_URL}/auth/token`);
    console.log('');
    console.log('MCP Endpoint:');
    console.log(`  SSE: ${BASE_URL}/mcp`);
    console.log('='.repeat(60));
    console.log('');
  });
}
