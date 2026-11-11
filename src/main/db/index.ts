import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { join } from 'path'
import * as schema from './schema'
import { seedIfEmpty } from './seed'

export type AppDb = BetterSQLite3Database<typeof schema>

let sqlite: Database.Database | null = null
let db: AppDb | null = null

export const getDbPath = (): string => join(app.getPath('userData'), 'pos.db')

export function initDb(): AppDb {
  const dbPath = getDbPath()
  sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  console.log('[db] opened at', dbPath)

  migrate(db, { migrationsFolder: join(app.getAppPath(), 'drizzle') })
  console.log('[db] migrations applied')

  seedIfEmpty(db)
  return db
}

export function getDb(): AppDb {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function getSqlite(): Database.Database {
  if (!sqlite) throw new Error('Database not initialized')
  return sqlite
}

export function closeDb(): void {
  sqlite?.close()
  sqlite = null
  db = null
}