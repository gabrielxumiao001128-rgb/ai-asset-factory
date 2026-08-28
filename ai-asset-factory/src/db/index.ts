import Database from 'better-sqlite3';
import { dbPath } from '../config';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

let db: Database.Database | null = null;

/**
 * 获取 SQLite 数据库连接（单例）
 */
export function getDb(): Database.Database {
  if (!db) {
    // 确保数据库目录存在
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

/**
 * 初始化数据库表结构
 */
function initTables(): void {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      original_image_url TEXT NOT NULL,
      product_info_json TEXT,
      copywriting_json TEXT,
      images_json TEXT,
      video_json TEXT,
      error TEXT,
      mode TEXT,
      size TEXT,
      style TEXT,
      copy_style TEXT,
      scenes_json TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS task_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_task_id ON task_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON task_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
  `);
}

/**
 * 关闭数据库连接（用于优雅退出）
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
