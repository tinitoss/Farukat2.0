import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Backup Cloud SQL Database Connection (Secondary / Non-Primary Database)
// Configured for project balmy-hue-1cf5x in region europe-west2
// Used for Watch Party Live Chat Archives & Event Audit Trails

let backupPool: Pool | null = null;
let tablesInitialized = false;

export function getBackupDb() {
  if (!backupPool && process.env.SQL_HOST) {
    try {
      backupPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 5,
        connectionTimeoutMillis: 10000,
      });

      backupPool.on('error', (err) => {
        console.error('Unexpected error on backup Cloud SQL pool:', err);
      });
    } catch (err) {
      console.error('Failed to initialize backup Cloud SQL pool:', err);
    }
  }
  return backupPool ? drizzle(backupPool) : null;
}

export async function ensureCloudSqlTables() {
  if (tablesInitialized || !backupPool) return;
  try {
    const client = await backupPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS cloud_sql_watch_party_audit (
          id SERIAL PRIMARY KEY,
          party_id VARCHAR(100) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          user_id VARCHAR(100),
          user_name VARCHAR(200),
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS cloud_sql_watch_party_messages (
          id SERIAL PRIMARY KEY,
          party_id VARCHAR(100) NOT NULL,
          sender_id VARCHAR(100) NOT NULL,
          sender_name VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      tablesInitialized = true;
      console.log('[Cloud SQL] Watch party audit & chat archive tables verified.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Cloud SQL] Failed to initialize tables:', err);
  }
}

export async function backupRecordToCloudSql(table: string, data: Record<string, any>): Promise<boolean> {
  try {
    const db = getBackupDb();
    if (!db || !backupPool) return false;
    await ensureCloudSqlTables();

    if (table === 'watch_party_audit') {
      await backupPool.query(
        `INSERT INTO cloud_sql_watch_party_audit (party_id, event_type, user_id, user_name, details) VALUES ($1, $2, $3, $4, $5)`,
        [data.partyId || 'general', data.eventType || 'action', data.userId || '', data.userName || '', data.details || '']
      );
    } else if (table === 'watch_party_messages') {
      await backupPool.query(
        `INSERT INTO cloud_sql_watch_party_messages (party_id, sender_id, sender_name, message) VALUES ($1, $2, $3, $4)`,
        [data.partyId || 'general', data.senderId || '', data.senderName || '', data.message || '']
      );
    }

    console.log(`[Cloud SQL Backup] Successfully archived record to ${table}`);
    return true;
  } catch (err) {
    console.error(`[Cloud SQL Backup] Failed to backup to ${table}:`, err);
    return false;
  }
}

export async function fetchCloudSqlAuditLogs(partyId?: string, limit = 50): Promise<any[]> {
  try {
    if (!backupPool) return [];
    await ensureCloudSqlTables();
    let query = `SELECT * FROM cloud_sql_watch_party_audit`;
    const params: any[] = [];
    if (partyId) {
      query += ` WHERE party_id = $1`;
      params.push(partyId);
    }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await backupPool.query(query, params);
    return res.rows;
  } catch (err) {
    console.error('[Cloud SQL] Failed to fetch audit logs:', err);
    return [];
  }
}

export async function fetchCloudSqlMessages(partyId: string, limit = 50): Promise<any[]> {
  try {
    if (!backupPool) return [];
    await ensureCloudSqlTables();
    const res = await backupPool.query(
      `SELECT * FROM cloud_sql_watch_party_messages WHERE party_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [partyId, limit]
    );
    return res.rows.reverse();
  } catch (err) {
    console.error('[Cloud SQL] Failed to fetch chat messages:', err);
    return [];
  }
}

