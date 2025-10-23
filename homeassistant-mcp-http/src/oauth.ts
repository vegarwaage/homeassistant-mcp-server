// ABOUTME: Implements Home Assistant OAuth 2.0 authorization flow for MCP HTTP server
// ABOUTME: Handles token exchange, refresh, and session creation with encrypted storage

import axios from 'axios';
import { randomBytes } from 'crypto';
import { saveSession, getSession, Session } from './session.js';

const HA_URL = process.env.SUPERVISOR_TOKEN
  ? 'http://supervisor/core'
  : 'http://homeassistant.local:8123';

const OAUTH_CLIENT_URL = process.env.OAUTH_CLIENT_URL || '';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_URL,
    redirect_uri: `${OAUTH_CLIENT_URL}/oauth/callback`,
    state,
  });
  return `${HA_URL}/auth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const response = await axios.post<TokenResponse>(
    `${HA_URL}/auth/token`,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: OAUTH_CLIENT_URL,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return response.data;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await axios.post<TokenResponse>(
    `${HA_URL}/auth/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: OAUTH_CLIENT_URL,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return response.data;
}

export async function createSession(
  sessionId: string,
  tokens: TokenResponse,
  haUser: string
): Promise<void> {
  const session: Session = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    ha_user: haUser,
    created_at: Date.now(),
    last_used: Date.now(),
  };
  await saveSession(sessionId, session);
}

export async function getValidAccessToken(sessionId: string): Promise<string> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (Date.now() < session.expires_at - 60000) {
    return session.access_token;
  }

  const tokens = await refreshAccessToken(session.refresh_token);
  await createSession(sessionId, tokens, session.ha_user || '');
  return tokens.access_token;
}
