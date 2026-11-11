import { ipcMain } from 'electron'

// Wraps every handler so errors come back as { ok: false, error } instead of crashing
export function handle<A extends unknown[], T>(
  channel: string,
  fn: (...args: A) => T | Promise<T>
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true as const, data: await fn(...(args as A)) }
    } catch (e) {
      const error =
        e instanceof Error && e.name !== 'ZodError' ? e.message : 'Invalid input'
      return { ok: false as const, error }
    }
  })
}