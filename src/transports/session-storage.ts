// ABOUTME: SQLite-based session storage for HTTP transport OAuth sessions
// ABOUTME: Persists sessions across server restarts

import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export interface Session {
  access_token: string;  // HA's access token (stored server-side only)
  refresh_token?: string;  // HA's refresh token (stored server-side only)
  expires_at: number;
  user_id: string;
}

export interface OpaqueToken {
  opaque_token: string;  // Token issued to Claude
  session_id: string;  // Maps to Session with HA tokens
  expires_at: number;
}

export interface OAuthClient {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  client_id_issued_at: number;
}

export interface AuthCode {
  client_id: string;
  redirect_uri: string;
  code_challenge?: string;
  session_id?: string;  // Link to the session created after HA OAuth
}

export class SessionStorage {
  private db: sqlite3.Database;
  private dbRun: (sql: string, ...params: any[]) => Promise<void>;
  private dbGet: (sql: string, ...params: any[]) => Promise<any>;
  private dbAll: (sql: string, ...params: any[]) => Promise<any[]>;

  constructor(dbPath: string = '/config/mcp-sessions.db') {
    this.db = new sqlite3.Database(dbPath);
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
  }

  async initialize(): Promise<void> {
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        client_id TEXT PRIMARY KEY,
        client_secret TEXT NOT NULL,
        redirect_uris TEXT NOT NULL,
        client_id_issued_at INTEGER NOT NULL
      )
    `);

    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS auth_codes (
        code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        code_challenge TEXT,
        session_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        expires_at INTEGER NOT NULL
      )
    `);

    // Token wrapping: Map opaque tokens to sessions
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS opaque_tokens (
        opaque_token TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      )
    `);

    await this.dbRun(`
      CREATE INDEX IF NOT EXISTS idx_opaque_tokens_session
      ON opaque_tokens(session_id)
    `);

    // Clean up expired sessions and auth codes on startup
    await this.cleanupExpired();

    console.log('[SessionStorage] Initialized SQLite session storage with token wrapping');
  }

  async cleanupExpired(): Promise<void> {
    const now = Date.now();
    await this.dbRun('DELETE FROM sessions WHERE expires_at < ?', now);
    await this.dbRun('DELETE FROM auth_codes WHERE expires_at < ?', now);
    await this.dbRun('DELETE FROM opaque_tokens WHERE expires_at < ?', now);
  }

  // Session methods
  async setSession(sessionId: string, session: Session): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO sessions (session_id, access_token, refresh_token, expires_at, user_id)
       VALUES (?, ?, ?, ?, ?)`,
      sessionId,
      session.access_token,
      session.refresh_token || null,
      session.expires_at,
      session.user_id
    );
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const row = await this.dbGet(
      'SELECT access_token, refresh_token, expires_at, user_id FROM sessions WHERE session_id = ?',
      sessionId
    );

    if (!row) return null;

    return {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      expires_at: row.expires_at,
      user_id: row.user_id
    };
  }

  async getAllSessions(): Promise<Map<string, Session>> {
    const rows = await this.dbAll('SELECT session_id, access_token, refresh_token, expires_at, user_id FROM sessions');
    const sessions = new Map<string, Session>();

    for (const row of rows) {
      sessions.set(row.session_id, {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at: row.expires_at,
        user_id: row.user_id
      });
    }

    return sessions;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.dbRun('DELETE FROM sessions WHERE session_id = ?', sessionId);
  }

  async findSessionByRefreshToken(refreshToken: string): Promise<{ sessionId: string; session: Session } | null> {
    const row = await this.dbGet(
      'SELECT session_id, access_token, refresh_token, expires_at, user_id FROM sessions WHERE refresh_token = ?',
      refreshToken
    );

    if (!row) return null;

    return {
      sessionId: row.session_id,
      session: {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at: row.expires_at,
        user_id: row.user_id
      }
    };
  }

  async findSessionByAccessToken(accessToken: string): Promise<{ sessionId: string; session: Session } | null> {
    const row = await this.dbGet(
      'SELECT session_id, access_token, refresh_token, expires_at, user_id FROM sessions WHERE access_token = ?',
      accessToken
    );

    if (!row) return null;

    return {
      sessionId: row.session_id,
      session: {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at: row.expires_at,
        user_id: row.user_id
      }
    };
  }

  // OAuth client methods
  async setClient(clientId: string, client: OAuthClient): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO oauth_clients (client_id, client_secret, redirect_uris, client_id_issued_at)
       VALUES (?, ?, ?, ?)`,
      clientId,
      client.client_secret,
      JSON.stringify(client.redirect_uris),
      client.client_id_issued_at
    );
  }

  async getClient(clientId: string): Promise<OAuthClient | null> {
    const row = await this.dbGet(
      'SELECT client_id, client_secret, redirect_uris, client_id_issued_at FROM oauth_clients WHERE client_id = ?',
      clientId
    );

    if (!row) return null;

    return {
      client_id: row.client_id,
      client_secret: row.client_secret,
      redirect_uris: JSON.parse(row.redirect_uris),
      client_id_issued_at: row.client_id_issued_at
    };
  }

  // Auth code methods
  async setAuthCode(code: string, authCode: AuthCode, expiresIn: number = 600): Promise<void> {
    const expiresAt = Date.now() + (expiresIn * 1000);
    await this.dbRun(
      `INSERT OR REPLACE INTO auth_codes (code, client_id, redirect_uri, code_challenge, session_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      code,
      authCode.client_id,
      authCode.redirect_uri,
      authCode.code_challenge || null,
      authCode.session_id || null,
      expiresAt
    );
  }

  async getAuthCode(code: string): Promise<AuthCode | null> {
    const row = await this.dbGet(
      'SELECT client_id, redirect_uri, code_challenge, session_id FROM auth_codes WHERE code = ? AND expires_at > ?',
      code,
      Date.now()
    );

    if (!row) return null;

    return {
      client_id: row.client_id,
      redirect_uri: row.redirect_uri,
      code_challenge: row.code_challenge,
      session_id: row.session_id
    };
  }

  async deleteAuthCode(code: string): Promise<void> {
    await this.dbRun('DELETE FROM auth_codes WHERE code = ?', code);
  }

  // Opaque token methods (token wrapping)
  async createOpaqueToken(sessionId: string, expiresAt: number): Promise<string> {
    // Generate cryptographically secure random token
    const crypto = await import('crypto');
    const opaqueToken = crypto.randomBytes(32).toString('base64url');

    await this.dbRun(
      `INSERT INTO opaque_tokens (opaque_token, session_id, expires_at)
       VALUES (?, ?, ?)`,
      opaqueToken,
      sessionId,
      expiresAt
    );

    return opaqueToken;
  }

  async getSessionByOpaqueToken(opaqueToken: string): Promise<{ sessionId: string; session: Session } | null> {
    const row = await this.dbGet(
      `SELECT ot.session_id, s.access_token, s.refresh_token, s.expires_at, s.user_id
       FROM opaque_tokens ot
       JOIN sessions s ON ot.session_id = s.session_id
       WHERE ot.opaque_token = ? AND ot.expires_at > ?`,
      opaqueToken,
      Date.now()
    );

    if (!row) return null;

    return {
      sessionId: row.session_id,
      session: {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at: row.expires_at,
        user_id: row.user_id
      }
    };
  }

  async revokeOpaqueToken(opaqueToken: string): Promise<void> {
    await this.dbRun('DELETE FROM opaque_tokens WHERE opaque_token = ?', opaqueToken);
  }

  async getOpaqueTokensBySession(sessionId: string): Promise<string[]> {
    const rows = await this.dbAll(
      'SELECT opaque_token FROM opaque_tokens WHERE session_id = ? AND expires_at > ?',
      sessionId,
      Date.now()
    );

    return rows.map(row => row.opaque_token);
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
