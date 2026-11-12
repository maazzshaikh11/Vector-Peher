import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useThemeStore, THEME_KEY } from './theme'

describe('theme store', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); document.documentElement.removeAttribute('data-theme') })
  it('defaults to light and applies data-theme', () => { const t = useThemeStore(); t.init(); expect(['light', 'dark']).toContain(t.mode); expect(document.documentElement.getAttribute('data-theme')).toBe(t.mode) })
  it('toggles and persists to localStorage', () => { const t = useThemeStore(); t.init(); const before = t.mode; t.toggle(); expect(t.mode).not.toBe(before); expect(localStorage.getItem(THEME_KEY)).toBe(t.mode); expect(document.documentElement.getAttribute('data-theme')).toBe(t.mode) })
  it('restores saved dark theme', () => { localStorage.setItem(THEME_KEY, 'dark'); const t = useThemeStore(); t.init(); expect(t.mode).toBe('dark') })
  it('restores saved light theme', () => { localStorage.setItem(THEME_KEY, 'light'); const t = useThemeStore(); t.init(); expect(t.mode).toBe('light') })
})
