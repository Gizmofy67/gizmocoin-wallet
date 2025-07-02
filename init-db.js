// init-db.js
import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const createOrdersTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        total_gzm NUMERIC NOT NULL,
        cart_json JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ orders table created');
  } catch (err) {
    console.error('❌ Failed to create orders table:', err);
  } finally {
    await pool.end();
  }
};

createOrdersTable();
