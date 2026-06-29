import type { ImportedProviderSettings } from './apiProfiles'
import { importCustomProviderSettingsFromJson } from './apiProfiles'
import { readRuntimeEnv } from './runtimeEnv'

const DEFAULT_API_URL = readRuntimeEnv(import.meta.env.VITE_DEFAULT_API_URL)

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function parseConfigUrl(value: string): URL | null {
  const url = value.trim()
  if (!url) return null

  try {
    return new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost/')
  } catch {
    return null
  }
}

export function isImportableConfigUrl(value: string): boolean {
  const parsed = parseConfigUrl(value)
  if (!parsed) return false
  return parsed.protocol === 'data:' || parsed.searchParams.has('settings') || parsed.pathname.toLowerCase().endsWith('.json')
}

export function getCustomProviderConfigUrl(defaultApiUrl = DEFAULT_API_URL): string {
  const url = defaultApiUrl.trim()
  return isImportableConfigUrl(url) ? url : ''
}

function getSettingsJsonTextFromUrl(value: string): string | null {
  const parsedUrl = parseConfigUrl(value)
  if (!parsedUrl) return null

  if (parsedUrl.protocol === 'data:') {
    const commaIndex = value.indexOf(',')
    if (commaIndex < 0) return null
    const meta = value.slice('data:'.length, commaIndex)
    const payload = value.slice(commaIndex + 1)
    const decodePayload = () => {
      if (meta.includes(';base64')) return globalThis.atob(payload)
      return decodeURIComponent(payload)
    }

    if (meta.includes(';base64')) {
      try {
        const decoded = decodePayload()
        const parsed = JSON.parse(decoded)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'settings' in parsed) {
          return JSON.stringify((parsed as { settings?: unknown }).settings ?? null)
        }
        return decoded
      } catch {
        return null
      }
    }

    try {
      const decoded = decodePayload()
      const parsed = JSON.parse(decoded)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'settings' in parsed) {
        return JSON.stringify((parsed as { settings?: unknown }).settings ?? null)
      }
      return decoded
    } catch {
      return null
    }
  }

  const raw = parsedUrl.searchParams.get('settings')
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'settings' in parsed) {
      return JSON.stringify((parsed as { settings?: unknown }).settings ?? null)
    }
    return raw
  } catch {
    return null
  }
}

export async function loadCustomProviderSettingsFromUrl(
  configUrl: string,
  fetcher: FetchLike = fetch,
): Promise<ImportedProviderSettings | null> {
  const url = configUrl.trim()
  if (!url) return null

  const settingsJsonText = getSettingsJsonTextFromUrl(url)
  if (settingsJsonText) return importCustomProviderSettingsFromJson(settingsJsonText)

  const response = await fetcher(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`自定义服务商配置 URL 请求失败：HTTP ${response.status}`)
  }

  return importCustomProviderSettingsFromJson(await response.text())
}
