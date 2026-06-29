const ADMIN_ACCESS_KEY = 'gpt-image-playground-admin-access'

export function isAdminAccessEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ADMIN_ACCESS_KEY) === 'true'
}

export function setAdminAccessEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  if (enabled) {
    window.localStorage.setItem(ADMIN_ACCESS_KEY, 'true')
  } else {
    window.localStorage.removeItem(ADMIN_ACCESS_KEY)
  }
}

