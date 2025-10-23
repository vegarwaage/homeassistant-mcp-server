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
