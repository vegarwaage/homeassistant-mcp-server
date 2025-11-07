// ABOUTME: HTTP transport with OAuth 2.1 for MCP server (June 2025 spec)
// ABOUTME: Implements MCP 2025-06-18 as Resource Server + Authorization Server combined
// ABOUTME: Key difference from March 2025: MCP servers are Resource Servers, not just Authorization Servers
// ABOUTME: June 2025 requires audience binding (RFC 8707) for all tokens

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { SessionStorage } from './session-storage.js';
import type { Session, OAuthClient } from './session-storage.js';

export async function createHttpTransport(server: Server): Promise<void> {
  // Initialize SQLite session storage
  const storage = new SessionStorage();
  await storage.initialize();
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000');
  const BASE_URL = process.env.OAUTH_CLIENT_URL || `http://localhost:${PORT}`;

  // Home Assistant OAuth configuration
  const HA_URL = process.env.HA_URL || 'http://supervisor/core';
  const HA_TOKEN = process.env.SUPERVISOR_TOKEN;

  if (!HA_TOKEN) {
    throw new Error('SUPERVISOR_TOKEN environment variable is required for HTTP transport');
  }

  // Store active SSE transports by session ID
  const sseTransports = new Map<string, any>();

  // Middleware
  app.use(cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Mcp-Session-Id', 'MCP-Protocol-Version', 'WWW-Authenticate']
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
  // MCP Protocol Version - Required for Claude compatibility
  // ============================================================================
  app.head('/', (req, res) => {
    res.setHeader('MCP-Protocol-Version', '2025-06-18');
    res.status(200).end();
  });

  app.head('/mcp', (req, res) => {
    res.setHeader('MCP-Protocol-Version', '2025-06-18');
    res.status(200).end();
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
  // Fallback endpoint for clients that don't append resource identifier
  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    res.json({
      resource: `${BASE_URL}/mcp`,
      authorization_servers: [BASE_URL],
      bearer_methods_supported: ['header']
    });
  });

  // Resource-specific endpoint per RFC 9728
  app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
    res.json({
      resource: `${BASE_URL}/mcp`,
      authorization_servers: [BASE_URL],
      bearer_methods_supported: ['header']
    });
  });

  // ============================================================================
  // RFC 7591: OAuth 2.0 Dynamic Client Registration
  // ============================================================================
  app.post('/mcp/oauth/register', async (req, res) => {
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

    await storage.setClient(client_id, client);

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

  // Authorization endpoint - auto-approve and issue code
  app.get('/auth/authorize', async (req, res) => {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type, resource } = req.query;

    // Validate client
    const client = await storage.getClient(client_id as string);
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

    // RFC 8707 + June 2025 MCP Spec: REQUIRE resource parameter for audience binding
    const expectedResource = `${BASE_URL}/mcp`;
    if (!resource) {
      console.log(`[OAuth] Missing required resource parameter (June 2025 spec requirement)`);
      return res.status(400).json({
        error: 'invalid_request',
        error_description: `resource parameter is required (must be ${expectedResource})`
      });
    }
    if (resource !== expectedResource) {
      console.log(`[OAuth] Invalid resource: ${resource}, expected: ${expectedResource}`);
      return res.status(400).json({
        error: 'invalid_target',
        error_description: `Resource must be ${expectedResource}`
      });
    }

    // Create session using SUPERVISOR_TOKEN (no HA OAuth needed)
    const sessionId = uuidv4();
    await storage.setSession(sessionId, {
      access_token: HA_TOKEN,
      refresh_token: undefined, // Long-lived tokens don't have refresh
      expires_at: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
      user_id: 'supervisor',
      audience: resource as string | undefined  // RFC 8707: Store audience claim
    });

    // Generate authorization code and link to session
    const authCode = uuidv4();
    await storage.setAuthCode(authCode, {
      client_id: client_id as string,
      redirect_uri: redirect_uri as string,
      code_challenge: code_challenge as string | undefined,
      session_id: sessionId,
      resource: resource as string | undefined  // RFC 8707: Store resource indicator
    });

    console.log(`[OAuth] Auto-approved for client ${client_id}, session ${sessionId}, resource ${resource || 'none'}`);

    // Redirect back to client with auth code
    const redirectUrl = `${redirect_uri}?code=${authCode}&state=${state}`;
    res.redirect(redirectUrl);
  });


  // Token endpoint
  app.post('/auth/token', async (req, res) => {
    const { grant_type, code, client_id, client_secret, refresh_token, resource } = req.body;

    if (grant_type === 'authorization_code') {
      // Validate code
      const authData = await storage.getAuthCode(code);
      if (!authData) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      // Validate client
      const client = await storage.getClient(client_id);
      if (!client || client.client_secret !== client_secret) {
        return res.status(401).json({ error: 'invalid_client' });
      }

      // RFC 8707: Validate resource parameter matches authorization
      if (resource && authData.resource && resource !== authData.resource) {
        console.log(`[OAuth] Resource mismatch: token request ${resource} != auth code ${authData.resource}`);
        return res.status(400).json({
          error: 'invalid_target',
          error_description: 'Resource parameter must match authorization request'
        });
      }

      // Get session linked to this auth code
      if (!authData.session_id) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Auth code not linked to session' });
      }

      const session = await storage.getSession(authData.session_id);
      if (!session) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Session not found' });
      }

      // Delete the auth code (single use)
      await storage.deleteAuthCode(code);

      // Issue opaque tokens (token wrapping - keeps HA tokens server-side)
      const opaqueAccessToken = await storage.createOpaqueToken(
        authData.session_id,
        session.expires_at
      );
      const opaqueRefreshToken = await storage.createOpaqueToken(
        authData.session_id,
        Date.now() + (90 * 24 * 60 * 60 * 1000) // 90 days
      );

      console.log(`[OAuth] Issued opaque tokens for session ${authData.session_id}, audience ${session.audience || 'none'}`);

      res.json({
        access_token: opaqueAccessToken,
        token_type: 'Bearer',
        expires_in: Math.floor((session.expires_at - Date.now()) / 1000),
        refresh_token: opaqueRefreshToken
      });
    } else if (grant_type === 'refresh_token') {
      // Find session by opaque refresh token
      const result = await storage.getSessionByOpaqueToken(refresh_token);
      if (!result) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token' });
      }

      const { sessionId, session } = result;

      // SUPERVISOR_TOKEN is long-lived, no need to refresh with HA
      // Just issue new opaque tokens with same session

      const expires_in = Math.floor((session.expires_at - Date.now()) / 1000);

      // Issue NEW opaque tokens (don't reuse old ones)
      const newOpaqueAccessToken = await storage.createOpaqueToken(
        sessionId,
        session.expires_at
      );
      const newOpaqueRefreshToken = await storage.createOpaqueToken(
        sessionId,
        Date.now() + (90 * 24 * 60 * 60 * 1000) // 90 days
      );

      // Revoke the old refresh token
      await storage.revokeOpaqueToken(refresh_token);

      console.log(`[OAuth] Refreshed tokens for session ${sessionId}`);

      res.json({
        access_token: newOpaqueAccessToken,
        token_type: 'Bearer',
        expires_in,
        refresh_token: newOpaqueRefreshToken
      });
    } else {
      res.status(400).json({ error: 'unsupported_grant_type' });
    }
  });

  // Token revocation
  app.post('/auth/revoke', async (req, res) => {
    const { token } = req.body;

    // Find and remove opaque token
    const result = await storage.getSessionByOpaqueToken(token);
    if (result) {
      await storage.revokeOpaqueToken(token);
      console.log(`[OAuth] Revoked opaque token for session ${result.sessionId}`);
      return res.status(200).json({ success: true });
    }

    // Token not found, but that's OK per OAuth spec
    res.status(200).json({ success: true });
  });

  // ============================================================================
  // Authentication Middleware
  // ============================================================================
  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.setHeader('WWW-Authenticate',
        `Bearer realm="${BASE_URL}", resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`
      );
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'Bearer token required'
      });
    }

    const opaqueToken = authHeader.substring(7);
    const result = await storage.getSessionByOpaqueToken(opaqueToken);

    if (!result) {
      res.setHeader('WWW-Authenticate',
        `Bearer realm="${BASE_URL}", error="invalid_token"`
      );
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token not found or expired'
      });
    }

    const { session } = result;

    // Check if HA token is expired
    if (session.expires_at < Date.now()) {
      res.setHeader('WWW-Authenticate',
        `Bearer realm="${BASE_URL}", error="invalid_token", error_description="Token expired"`
      );
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token expired - use refresh_token to get new tokens'
      });
    }

    // RFC 8707 + June 2025 MCP Spec: REQUIRE audience claim for all tokens
    const expectedAudience = `${BASE_URL}/mcp`;
    if (!session.audience) {
      console.log(`[Auth] Token missing required audience claim (June 2025 spec requirement)`);
      res.setHeader('WWW-Authenticate',
        `Bearer realm="${BASE_URL}", error="invalid_token", error_description="Token missing audience claim"`
      );
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token must include audience claim per MCP 2025-06-18 spec'
      });
    }
    if (session.audience !== expectedAudience) {
      console.log(`[Auth] Audience mismatch: ${session.audience} !== ${expectedAudience}`);
      res.setHeader('WWW-Authenticate',
        `Bearer realm="${BASE_URL}", error="invalid_token", error_description="Token not intended for this resource"`
      );
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: 'Token not intended for this resource'
      });
    }

    // Attach session to request (contains HA's access token for API calls)
    (req as any).session = session;
    next();
  }

  // ============================================================================
  // MCP over Streamable HTTP Transport (Protocol 2025-06-18 / June 2025)
  // Resource Server endpoint - consumes Bearer tokens with audience binding
  // ============================================================================
  app.all('/mcp', requireAuth, async (req, res) => {
    console.log(`[MCP] ${req.method} request`);

    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && sseTransports.has(sessionId)) {
        // Reuse existing transport
        transport = sseTransports.get(sessionId) as StreamableHTTPServerTransport;
        console.log(`[MCP] Reusing transport for session: ${sessionId}`);
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // Create new transport for initialize request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => uuidv4(),
          onsessioninitialized: (sid) => {
            console.log(`[MCP] Session initialized: ${sid}`);
            if (transport) {
              sseTransports.set(sid, transport);
            }
          }
        });

        console.log(`[MCP] New transport created`);

        // Handle transport close
        transport.onclose = () => {
          const sid = transport?.sessionId;
          if (sid) {
            console.log(`[MCP] Transport closed: ${sid}`);
            sseTransports.delete(sid);
          }
        };

        // Connect transport to server
        await server.connect(transport);
      } else if (!sessionId) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Missing Mcp-Session-Id header'
          },
          id: null
        });
      } else {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Not Found: Session not found'
          },
          id: null
        });
      }

      // Handle the request with the transport
      await transport.handleRequest(req, res, req.body);
    } catch (error: any) {
      console.error('[MCP] Error handling request:', error.message);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error'
          },
          id: null
        });
      }
    }
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
