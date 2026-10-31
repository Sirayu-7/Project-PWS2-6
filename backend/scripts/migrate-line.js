const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'it_equipment_db';

async function migrate() {
  console.log(`[*] Connecting to database ${database}...`);
  const connection = await mysql.createConnection({ host, port, user, password, database });

  try {
    // 1. Check line_user_id in users
    const [cols] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'line_user_id'",
      [database]
    );
    if (!cols.length) {
      console.log('[*] Adding line_user_id to users table...');
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN line_user_id VARCHAR(50) DEFAULT NULL AFTER status,
        ADD UNIQUE KEY idx_users_line_user_id (line_user_id)
      `);
      console.log('[✓] Added line_user_id column to users table.');
    } else {
      console.log('[i] Column line_user_id already exists in users table.');
    }

    // 2. Create line_link_tokens
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS line_link_tokens (
        token_id int(11) NOT NULL AUTO_INCREMENT,
        user_id int(11) NOT NULL,
        pin_code varchar(6) NOT NULL,
        expires_at datetime NOT NULL,
        is_used tinyint(1) NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (token_id),
        KEY idx_pin_lookup (pin_code, is_used, expires_at),
        CONSTRAINT fk_line_token_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[✓] Table line_link_tokens verified/created.');

    // 3. Create line_conversation_states
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS line_conversation_states (
        state_id int(11) NOT NULL AUTO_INCREMENT,
        user_id int(11) NOT NULL,
        state_action varchar(50) NOT NULL,
        payload longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(payload)),
        expires_at datetime NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (state_id),
        UNIQUE KEY idx_user_state (user_id),
        CONSTRAINT fk_line_state_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[✓] Table line_conversation_states verified/created.');

    console.log('\nMigration completed successfully: tables and columns ready.');
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('[!] Migration failed:', err.message);
  process.exit(1);
});
