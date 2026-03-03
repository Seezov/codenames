import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// Railway injects DATABASE_URL automatically.
// For local dev set it in a .env file or shell environment.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway PostgreSQL requires SSL in production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      nickname      TEXT   UNIQUE NOT NULL,
      password_hash TEXT   NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_results (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      room_code  TEXT    NOT NULL,
      team       TEXT    NOT NULL,
      role       TEXT    NOT NULL,
      won        BOOLEAN NOT NULL DEFAULT FALSE,
      played_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export interface DbUser {
  id: number;
  nickname: string;
}

export async function registerUser(
  nickname: string,
  password: string,
): Promise<{ user: DbUser } | { error: string }> {
  const nick = nickname.trim();
  if (nick.length < 2 || nick.length > 20) {
    return { error: 'Нікнейм має бути від 2 до 20 символів.' };
  }
  if (password.length < 4) {
    return { error: 'Пароль має бути щонайменше 4 символи.' };
  }

  const existing = await pool.query(
    'SELECT id FROM users WHERE LOWER(nickname) = LOWER($1)',
    [nick],
  );
  if (existing.rows.length > 0) return { error: 'Такий нікнейм вже зайнятий.' };

  const hash = bcrypt.hashSync(password, 10);
  const res = await pool.query(
    'INSERT INTO users (nickname, password_hash) VALUES ($1, $2) RETURNING id',
    [nick, hash],
  );
  return { user: { id: res.rows[0].id as number, nickname: nick } };
}

export async function loginUser(
  nickname: string,
  password: string,
): Promise<{ user: DbUser } | { error: string }> {
  const res = await pool.query(
    'SELECT id, nickname, password_hash FROM users WHERE LOWER(nickname) = LOWER($1)',
    [nickname.trim()],
  );
  const row = res.rows[0] as { id: number; nickname: string; password_hash: string } | undefined;
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return { error: 'Невірний нікнейм або пароль.' };
  }
  return { user: { id: row.id, nickname: row.nickname } };
}

export async function saveGameResult(
  userId: number,
  roomCode: string,
  team: string,
  role: string,
  won: boolean,
): Promise<void> {
  await pool.query(
    'INSERT INTO game_results (user_id, room_code, team, role, won) VALUES ($1, $2, $3, $4, $5)',
    [userId, roomCode, team, role, won],
  );
}
