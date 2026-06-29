import type { ApiProfile, TaskParams } from '../types'
import {
  assertImageInputPayloadSize,
  type CallApiOptions,
  type CallApiResult,
  getApiErrorMessage,
  getDataUrlEncodedByteSize,
  MIME_MAP,
  normalizeBase64Image,
} from './imageApiShared'
import { DEFAULT_GEMINI_TIKAPI_BASE_URL } from './apiProfiles'

type GeminiPart = {
  text?: string
  inline_data?: {
    mime_type: string
    data: string
  }
}

function stripBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_GEMINI_TIKAPI_BASE_URL
}

function buildGeminiUrl(profile: ApiProfile) {
  const baseUrl = stripBaseUrl(profile.baseUrl)
  const model = encodeURIComponent(profile.model.trim())
  const key = profile.apiKey.trim().replace(/^Bearer\s+/i, '')
  return `${baseUrl}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
}

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/)
  if (!match) return null
  return {
    mimeType: match[1] || 'image/png',
    data: match[2].replace(/\s/g, ''),
  }
}

function getGeminiImageConfig(params: TaskParams) {
  const size = params.size.trim()
  const match = size.match(/^(\d+)\s*[xX×]\s*(\d+)$/)
  if (!match) {
    return {
      imageSize: '1K',
      aspectRatio: '1:1',
    }
  }

  const width = Number(match[1])
  const height = Number(match[2])
  const maxEdge = Math.max(width, height)
  const imageSize = maxEdge > 2560 ? '4K' : maxEdge > 1536 ? '2K' : '1K'
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height)

  return {
    imageSize,
    aspectRatio: `${Math.round(width / divisor)}:${Math.round(height / divisor)}`,
  }
}

function createGeminiRequestBody(opts: CallApiOptions): Record<string, unknown> {
  const imageParts: GeminiPart[] = []
  if (opts.geminiReferenceImage) {
    imageParts.push({
      inline_data: {
        mime_type: opts.geminiReferenceImage.mimeType,
        data: opts.geminiReferenceImage.data,
      },
    })
  }

  for (const dataUrl of opts.inputImageDataUrls) {
    const image = splitDataUrl(dataUrl)
    if (!image) continue
    imageParts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.data,
      },
    })
  }

  const imageConfig = getGeminiImageConfig(opts.params)
  return {
    contents: [
      {
        parts: [
          ...imageParts,
          { text: opts.prompt },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function collectGeminiInlineImages(payload: unknown, fallbackMime: string): string[] {
  const images: string[] = []

  const visitPart = (part: unknown) => {
    if (!isRecord(part)) return
    const inlineData = isRecord(part.inlineData)
      ? part.inlineData
      : isRecord(part.inline_data)
      ? part.inline_data
      : null
    if (!inlineData) return

    const data = typeof inlineData.data === 'string' ? inlineData.data.trim() : ''
    if (!data) return
    const mime = typeof inlineData.mimeType === 'string'
      ? inlineData.mimeType
      : typeof inlineData.mime_type === 'string'
      ? inlineData.mime_type
      : fallbackMime
    images.push(normalizeBase64Image(data, mime))
  }

  const candidates = isRecord(payload) && Array.isArray(payload.candidates) ? payload.candidates : []
  for (const candidate of candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) continue
    for (const part of candidate.content.parts) visitPart(part)
  }

  // TikAPI 文档当前返回示例为空，这里额外兼容常见中转层字段，避免服务端微调字段名后前端直接不可用。
  const visitLoose = (value: unknown, parentKey = '') => {
    if (typeof value === 'string' && value.trim() && /^(b64_json|base64|image|data)$/i.test(parentKey)) {
      images.push(normalizeBase64Image(value.trim(), fallbackMime))
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) visitLoose(item, parentKey)
      return
    }
    if (!isRecord(value)) return
    for (const [key, item] of Object.entries(value)) visitLoose(item, key)
  }
  if (!images.length) visitLoose(payload)

  return Array.from(new Set(images))
}

async function callGeminiTikApiSingle(opts: CallApiOptions, profile: ApiProfile): Promise<CallApiResult> {
  const mime = MIME_MAP[opts.params.output_format] || 'image/png'
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), profile.timeout * 1000)

  try {
    assertImageInputPayloadSize(
      opts.inputImageDataUrls.reduce((sum, dataUrl) => sum + getDataUrlEncodedByteSize(dataUrl), 0) +
        (opts.geminiReferenceImage ? opts.geminiReferenceImage.data.length : 0),
    )

    const response = await fetch(buildGeminiUrl(profile), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify(createGeminiRequestBody(opts)),
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(await getApiErrorMessage(response))

    const payload = await response.json()
    const images = collectGeminiInlineImages(payload, mime)
    if (!images.length) {
      const err = new Error('TikAPI Gemini 3 Pro 没有返回可识别的图片数据，请检查原始响应结构。')
      ;(err as any).rawResponsePayload = JSON.stringify(payload, null, 2)
      throw err
    }

    return {
      images,
      actualParams: {
        n: images.length,
      },
      actualParamsList: images.map(() => undefined),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function callGeminiTikApiImageApi(opts: CallApiOptions, profile: ApiProfile): Promise<CallApiResult> {
  const n = opts.params.n > 0 ? opts.params.n : 1
  if (n === 1) return callGeminiTikApiSingle(opts, profile)

  const results = await Promise.allSettled(
    Array.from({ length: n }).map((_, requestIndex) => callGeminiTikApiSingle({
      ...opts,
      params: { ...opts.params, n: 1 },
      onPartialImage: opts.onPartialImage
        ? (partial) => opts.onPartialImage?.({ ...partial, requestIndex })
        : undefined,
    }, profile)),
  )
  const successfulResults = results
    .filter((r): r is PromiseFulfilledResult<CallApiResult> => r.status === 'fulfilled')
    .map((r) => r.value)
  const failedRequests = results.flatMap((r, requestIndex) =>
    r.status === 'rejected' ? [{ requestIndex, error: getErrorMessage(r.reason) }] : [],
  )

  if (!successfulResults.length) {
    const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (firstError) throw firstError.reason
    throw new Error('所有 Gemini 3 Pro 并发请求均失败')
  }

  const images = successfulResults.flatMap((r) => r.images)
  return {
    images,
    actualParams: { n: images.length },
    actualParamsList: images.map(() => undefined),
    ...(failedRequests.length ? { failedRequests } : {}),
  }
}
