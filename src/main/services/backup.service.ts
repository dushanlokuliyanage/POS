import { app, BrowserWindow, dialog, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync
} from 'fs'
import { join, resolve } from 'path'
import { closeDb, getDbPath, getSqlite } from '../db'
import { requireRole } from './auth.service'
import type { BackupListDTO } from '../../shared/types'

const backupDir = (): string => join(app.getPath('userData'), 'backups')

const pad = (n: number): string => String(n).padStart(2, '0')
function stamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function prune(prefix: string, keep: number): void {
  const files = readdirSync(backupDir())
    .filter((f) => f.startsWith(prefix) && f.endsWith('.db'))
    .sort()
  for (const f of files.slice(0, Math.max(0, files.length - keep))) {
    rmSync(join(backupDir(), f), { force: true })
  }
}

// Runs at app start: one automatic backup per day, keeps the last 14
export async function autoBackup(): Promise<void> {
  try {
    mkdirSync(backupDir(), { recursive: true })
    const today = new Date().toLocaleDateString('en-CA').replaceAll('-', '')
    const hasToday = readdirSync(backupDir()).some((f) => f.startsWith(`auto-${today}`))
    if (!hasToday) {
      await getSqlite().backup(join(backupDir(), `auto-${stamp()}.db`))
      console.log('[backup] automatic backup created')
    }
    prune('auto-', 14)
  } catch (e) {
    console.error('[backup] automatic backup failed', e)
  }
}

export function listBackups(): BackupListDTO {
  requireRole('admin')
  const dir = backupDir()
  if (!existsSync(dir)) return { folder: dir, files: [] }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const s = statSync(join(dir, f))
      return { name: f, sizeBytes: s.size, modifiedAt: s.mtimeMs }
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
  return { folder: dir, files }
}

export function openBackupFolder(): string {
  requireRole('admin')
  mkdirSync(backupDir(), { recursive: true })
  void shell.openPath(backupDir())
  return backupDir()
}

// Manual backup: the admin chooses where to save it
export async function backupNow(): Promise<string | null> {
  requireRole('admin')
  const win = BrowserWindow.getFocusedWindow()
  const options = {
    title: 'Save backup',
    defaultPath: `pos-backup-${stamp()}.db`,
    filters: [{ name: 'POS backup', extensions: ['db'] }]
  }
  const res = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (res.canceled || !res.filePath) return null
  await getSqlite().backup(res.filePath)
  return res.filePath
}

// Checks a copy of the file, so the chosen file is never touched
function validateBackup(file: string): void {
  const tmp = join(app.getPath('temp'), `pos-check-${Date.now()}.db`)
  let test: Database.Database | null = null
  try {
    copyFileSync(file, tmp)
    test = new Database(tmp)
    if (test.pragma('integrity_check', { simple: true }) !== 'ok') {
      throw new Error('Backup file is damaged')
    }
    const tables = test
      .prepare(
        "select name from sqlite_master where type = 'table' and name in ('users','sales','products')"
      )
      .all()
    if (tables.length < 3) throw new Error('This is not a POS backup file')
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    if (m === 'Backup file is damaged' || m === 'This is not a POS backup file') throw e
    throw new Error('Cannot read this file as a POS backup')
  } finally {
    test?.close()
    for (const s of ['', '-wal', '-shm']) rmSync(tmp + s, { force: true })
  }
}

// Replaces ALL data with the chosen backup, then restarts the app
export async function restoreBackup(): Promise<boolean> {
  requireRole('admin')
  const win = BrowserWindow.getFocusedWindow()
  const options = {
    title: 'Choose a backup to restore',
    properties: ['openFile' as const],
    filters: [{ name: 'POS backup', extensions: ['db'] }]
  }
  const pick = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (pick.canceled || !pick.filePaths[0]) return false

  const file = pick.filePaths[0]
  const target = getDbPath()
  if (resolve(file) === resolve(target)) throw new Error('That is the live database file')
  validateBackup(file)

  const confirm = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancel', 'Restore and restart'],
    defaultId: 0,
    cancelId: 0,
    title: 'Restore backup',
    message: 'Replace ALL current data with this backup?',
    detail:
      'Sales made after the backup was taken will be lost. A safety copy of the current data is saved first. The app will restart.'
  })
  if (confirm.response !== 1) return false

  // safety copy of the current data
  mkdirSync(backupDir(), { recursive: true })
  await getSqlite().backup(join(backupDir(), `pre-restore-${stamp()}.db`))
  prune('pre-restore-', 5)

  closeDb()
  rmSync(target + '-wal', { force: true })
  rmSync(target + '-shm', { force: true })
  copyFileSync(file, target)

  if (!is.dev) app.relaunch() // in dev: just close, run "npm run dev" again
  app.exit(0)
  return true
}