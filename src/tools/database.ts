// ABOUTME: Database access tools for Home Assistant recorder
// ABOUTME: Supports raw SQL queries and helper tools for common operations

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import sqlite3 from 'sqlite3';
import { validatePositiveNumber } from '../validation.js';

const DB_PATH = process.env.HA_DB_PATH || '/config/home-assistant_v2.db';

// Whitelist of known Home Assistant database tables
const ALLOWED_TABLES = [
  'states',
  'states_meta',
  'events',
  'event_data',
  'event_types',
  'recorder_runs',
  'schema_changes',
  'statistics',
  'statistics_meta',
  'statistics_runs',
  'statistics_short_term',
  'sqlite_stat1',
  'sqlite_stat4'
];

function isValidTableName(tableName: string): boolean {
  return ALLOWED_TABLES.includes(tableName) || tableName.startsWith('sqlite_');
}

function openDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

export const databaseTools: Tool[] = [
  {
    name: 'ha_execute_sql',
    description: 'Execute raw SQL query on Home Assistant recorder database. Supports SELECT, INSERT, UPDATE, DELETE. Warns if SELECT without LIMIT.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL query to execute' },
        params: { type: 'array', items: { type: 'string' }, description: 'Query parameters for prepared statement', default: [] }
      },
      required: ['query']
    }
  },
  {
    name: 'ha_get_state_history',
    description: 'Query state history for entities with filters. Helper for common states table queries.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'Entity ID to query' },
        start_time: { type: 'string', description: 'ISO 8601 start time (optional)' },
        end_time: { type: 'string', description: 'ISO 8601 end time (optional)' },
        limit: { type: 'number', description: 'Maximum rows to return (default: 100)', default: 100 }
      },
      required: ['entity_id']
    }
  },
  {
    name: 'ha_query_statistics_db',
    description: 'Query statistics tables for sensor data via direct SQL. Helper for statistics_meta and statistics tables.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'Entity ID to query' },
        start_time: { type: 'string', description: 'ISO 8601 start time (optional)' },
        end_time: { type: 'string', description: 'ISO 8601 end time (optional)' },
        limit: { type: 'number', description: 'Maximum rows to return (default: 100)', default: 100 }
      },
      required: ['entity_id']
    }
  },
  {
    name: 'ha_purge_database',
    description: 'Remove old records from database with configurable retention period. DESTRUCTIVE operation.',
    inputSchema: {
      type: 'object',
      properties: {
        keep_days: { type: 'number', description: 'Days of history to keep', default: 30 },
        confirm: { type: 'boolean', description: 'Must be true to execute', default: false }
      },
      required: ['keep_days', 'confirm']
    }
  },
  {
    name: 'ha_database_info',
    description: 'Get database size, table counts, and row counts.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

export async function handleDatabaseTool(
  name: string,
  args: any,
  sessionId: string
): Promise<any> {
  // Permission checks removed - handle on client side (Claude Code settings)

  const db = await openDatabase();

  // Create promisified versions with proper typing
  const dbAll = (sql: string, params?: any[]): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      db.all(sql, params || [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  const dbRun = (sql: string, params?: any[]): Promise<sqlite3.RunResult> => {
    return new Promise((resolve, reject) => {
      db.run(sql, params || [], function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  };

  const dbGet = (sql: string, params?: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      db.get(sql, params || [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  try {
    switch (name) {
      case 'ha_execute_sql': {
        const { query, params = [] } = args;

        // Warn if SELECT without LIMIT
        if (query.trim().toUpperCase().startsWith('SELECT') && !query.toUpperCase().includes('LIMIT')) {
          console.warn('[Database] SELECT query without LIMIT clause - may return large result set');
        }

        const isSelect = query.trim().toUpperCase().startsWith('SELECT');

        if (isSelect) {
          const rows = await dbAll(query, params);
          return { query, rows, count: rows.length };
        } else {
          const result = await dbRun(query, params);
          return { query, changes: result.changes, lastID: result.lastID };
        }
      }

      case 'ha_get_state_history': {
        const { entity_id, start_time, end_time, limit = 100 } = args;

        let query = `
          SELECT s.state, s.last_changed, s.last_updated, sm.entity_id
          FROM states s
          JOIN states_meta sm ON s.metadata_id = sm.metadata_id
          WHERE sm.entity_id = ?
        `;
        const params: any[] = [entity_id];

        if (start_time) {
          query += ' AND s.last_updated >= ?';
          params.push(start_time);
        }
        if (end_time) {
          query += ' AND s.last_updated <= ?';
          params.push(end_time);
        }

        query += ' ORDER BY s.last_updated DESC LIMIT ?';
        params.push(limit);

        const rows = await dbAll(query, params);
        return { entity_id, rows, count: rows.length, limit };
      }

      case 'ha_query_statistics_db': {
        const { entity_id, start_time, end_time, limit = 100 } = args;

        let query = `
          SELECT s.*, sm.statistic_id
          FROM statistics s
          JOIN statistics_meta sm ON s.metadata_id = sm.id
          WHERE sm.statistic_id = ?
        `;
        const params: any[] = [entity_id];

        if (start_time) {
          query += ' AND s.start >= ?';
          params.push(start_time);
        }
        if (end_time) {
          query += ' AND s.start <= ?';
          params.push(end_time);
        }

        query += ' ORDER BY s.start DESC LIMIT ?';
        params.push(limit);

        const rows = await dbAll(query, params);
        return { entity_id, rows, count: rows.length, limit };
      }

      case 'ha_purge_database': {
        const { confirm } = args;

        // Validate keep_days parameter
        const keep_days = validatePositiveNumber(args.keep_days, 'keep_days');

        if (!confirm) {
          return { error: 'confirmation_required', message: 'Set confirm: true to execute purge operation' };
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - keep_days);
        const cutoff = cutoffDate.toISOString();

        const deleteStates = await dbRun('DELETE FROM states WHERE last_updated < ?', [cutoff]);
        const deleteStatistics = await dbRun('DELETE FROM statistics WHERE start < ?', [cutoff]);

        await dbRun('VACUUM');

        return {
          keep_days,
          cutoff_date: cutoff,
          states_deleted: deleteStates.changes,
          statistics_deleted: deleteStatistics.changes,
          vacuumed: true
        };
      }

      case 'ha_database_info': {
        const dbSize = await dbGet(`
          SELECT page_count * page_size as size
          FROM pragma_page_count(), pragma_page_size()
        `);

        const tables = await dbAll(`
          SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
        `);

        const tableCounts = await Promise.all(
          tables
            .filter((t: any) => isValidTableName(t.name))
            .map(async (t: any) => {
              const count = await dbGet(`SELECT COUNT(*) as count FROM ${t.name}`);
              return { table: t.name, rows: count.count };
            })
        );

        return {
          database: DB_PATH,
          size_bytes: dbSize.size,
          size_mb: (dbSize.size / 1024 / 1024).toFixed(2),
          tables: tableCounts
        };
      }

      default:
        return { error: 'unknown_tool', tool: name };
    }
  } finally {
    db.close();
  }
}
