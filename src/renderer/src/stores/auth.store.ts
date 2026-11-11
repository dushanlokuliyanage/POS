import { create } from 'zustand'
import type { SessionUser } from '../../../shared/types'

interface AuthState {
  user: SessionUser | null
  ready: boolean
  init: () => Promise<void>
  login: (username: string, secret: string, usePin: boolean) => Promise<string | null>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,

  init: async () => {
    const res = await window.api.auth.me()
    set({ user: res.ok ? res.data : null, ready: true })
  },

  // returns an error message, or null on success
  login: async (username, secret, usePin) => {
    const res = usePin
      ? await window.api.auth.loginPin(username, secret)
      : await window.api.auth.login(username, secret)
    if (!res.ok) return res.error
    set({ user: res.data })
    return null
  },

  logout: async () => {
    await window.api.auth.logout()
    set({ user: null })
  }
}))