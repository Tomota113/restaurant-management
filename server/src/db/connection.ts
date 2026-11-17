import Database from 'better-sqlite3';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

// Ensure directory exists if needed
const dir = path.dirname(config.dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db: Database.Database = new Database(config.dbPath, {
  timeout: 5000,
  verbose: config.isDev && process.env.DEBUG_SQL === 'true' ? console.log : undefined
});

// Configure SQLite pragmas for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

export default db;
