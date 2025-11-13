/**
 * Direct Database Connection Helper
 *
 * For executing raw SQL when Supabase client doesn't support it
 * Uses pg library to connect directly to PostgreSQL
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    pool = new Pool({
      connectionString,
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  return pool;
}

/**
 * Execute raw SQL query
 * Use for DDL operations (CREATE TABLE, ALTER TABLE, etc.)
 */
export async function executeSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  const client = await getPool().connect();

  try {
    await client.query(sql);
    return { success: true };
  } catch (error) {
    console.error('SQL execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    client.release();
  }
}

/**
 * Execute SQL query and return results
 * Use for SELECT queries
 */
export async function querySQL<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const client = await getPool().connect();

  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 * Call on server shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
