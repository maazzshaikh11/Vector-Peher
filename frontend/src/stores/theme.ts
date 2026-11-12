import { defineStore } from 'pinia'
import { ref } from 'vue'
export const THEME_KEY = 'vector-brain-theme'
export type ThemeMode = 'light' | 'dark'
export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('light')
  function apply() { document.documentElement.setAttribute('data-theme', mode.value); try { localStorage.setItem(THEME_KEY, mode.value) } catch { /* storage unavailable */ } }
  function init() {
    let saved: string | null = null
    try { saved = localStorage.getItem(THEME_KEY) } catch { /* ignore */ }
    mode.value = saved === 'dark' ? 'dark' : saved === 'light' ? 'light' : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    apply()
  }
  function toggle() { mode.value = mode.value === 'light' ? 'dark' : 'light'; apply() }
  function setTheme(m: ThemeMode) { mode.value = m; apply() }
  return { mode, init, toggle, setTheme }
})
