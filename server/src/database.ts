import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// DATA_DIR can be overridden via env var so Railway volumes work cleanly.
// Default: <repo-root>/data  (../.. from server/dist/)
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'codenames.db'));
db.pragma('journal_mode = WAL'); // better concurrent read performance

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname      TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS game_results (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    room_code  TEXT    NOT NULL,
    team       TEXT    NOT NULL,
    role       TEXT    NOT NULL,
    won        INTEGER NOT NULL DEFAULT 0,
    played_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

export interface DbUser {
  id: number;
  nickname: string;
}

export function registerUser(
  nickname: string,
  password: string,
): { user: DbUser } | { error: string } {
  const nick = nickname.trim();
  if (nick.length < 2 || nick.length > 20) {
    return { error: 'Нікнейм має бути від 2 до 20 символів.' };
  }
  if (password.length < 4) {
    return { error: 'Пароль має бути щонайменше 4 символи.' };
  }
  const existing = db.prepare('SELECT id FROM users WHERE nickname = ?').get(nick);
  if (existing) return { error: 'Такий нікнейм вже зайнятий.' };

  const hash = bcrypt.hashSync(password, 10);
  const res = db
    .prepare('INSERT INTO users (nickname, password_hash) VALUES (?, ?)')
    .run(nick, hash);
  return { user: { id: res.lastInsertRowid as number, nickname: nick } };
}

export function loginUser(
  nickname: string,
  password: string,
): { user: DbUser } | { error: string } {
  const row = db
    .prepare('SELECT id, nickname, password_hash FROM users WHERE nickname = ?')
    .get(nickname.trim()) as { id: number; nickname: string; password_hash: string } | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return { error: 'Невірний нікнейм або пароль.' };
  }
  return { user: { id: row.id, nickname: row.nickname } };
}

export function saveGameResult(
  userId: number,
  roomCode: string,
  team: string,
  role: string,
  won: boolean,
): void {
  db.prepare(
    'INSERT INTO game_results (user_id, room_code, team, role, won) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, roomCode, team, role, won ? 1 : 0);
}
