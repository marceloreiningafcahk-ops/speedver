import { canvasToBlob, loadImage } from './canvasImage'

export interface ImageCropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SplitBand {
  start: number
  end: number
}

export interface FourGridSplitPlan {
  imageWidth: number
  imageHeight: number
  targetAspect: number
  verticalBand: SplitBand
  horizontalBand: SplitBand
  cellWidth: number
  cellHeight: number
  rects: ImageCropRect[]
}

export async function resizeImageDataUrl(dataUrl: string, width: number, height: number): Promise<Blob> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvasToBlob(canvas, 'image/png')
}

export async function cropImageDataUrl(dataUrl: string, rect: ImageCropRect): Promise<Blob> {
  const image = await loadImage(dataUrl)
  const crop = clampCropRect(rect, image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas')
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return canvasToBlob(canvas, 'image/png')
}

export async function getFourGridSplitPlanDataUrl(dataUrl: string): Promise<FourGridSplitPlan> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('当前浏览器不支持 Canvas')
  ctx.drawImage(image, 0, 0)

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const verticalBand = detectDividerBand(pixels, canvas.width, canvas.height, 'vertical')
  const horizontalBand = detectDividerBand(pixels, canvas.width, canvas.height, 'horizontal')
  return createFourGridSplitPlan(canvas.width, canvas.height, verticalBand, horizontalBand, pixels)
}

export async function splitFourGridImageDataUrl(dataUrl: string, rects?: ImageCropRect[]): Promise<Blob[]> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('当前浏览器不支持 Canvas')
  ctx.drawImage(image, 0, 0)

  const cropRects = rects ?? createFourGridSplitPlanFromCanvas(ctx, canvas.width, canvas.height).rects
  return Promise.all(cropRects.map((rect) => cropCanvasToBlob(canvas, rect)))
}

function createFourGridSplitPlanFromCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): FourGridSplitPlan {
  const pixels = ctx.getImageData(0, 0, width, height).data
  const verticalBand = detectDividerBand(pixels, width, height, 'vertical')
  const horizontalBand = detectDividerBand(pixels, width, height, 'horizontal')
  return createFourGridSplitPlan(width, height, verticalBand, horizontalBand, pixels)
}

export function createFourGridSplitPlan(
  imageWidth: number,
  imageHeight: number,
  verticalBand: SplitBand,
  horizontalBand: SplitBand,
  pixels?: Uint8ClampedArray,
): FourGridSplitPlan {
  const centerX = (verticalBand.start + verticalBand.end) / 2
  const centerY = (horizontalBand.start + horizontalBand.end) / 2
  const leftAvailable = Math.max(1, Math.floor(centerX))
  const rightAvailable = Math.max(1, Math.floor(imageWidth - centerX))
  const topAvailable = Math.max(1, Math.floor(centerY))
  const bottomAvailable = Math.max(1, Math.floor(imageHeight - centerY))
  const maxCellWidth = Math.max(1, Math.min(leftAvailable, rightAvailable))
  const maxCellHeight = Math.max(1, Math.min(topAvailable, bottomAvailable))
  const targetAspect = imageWidth / Math.max(1, imageHeight)
  const availableAspect = maxCellWidth / Math.max(1, maxCellHeight)
  const cellWidth = availableAspect > targetAspect
    ? Math.max(1, Math.min(maxCellWidth, Math.round(maxCellHeight * targetAspect)))
    : maxCellWidth
  const cellHeight = availableAspect > targetAspect
    ? maxCellHeight
    : Math.max(1, Math.min(maxCellHeight, Math.round(maxCellWidth / targetAspect)))
  const leftX = Math.max(0, Math.round(centerX - cellWidth))
  const rightX = Math.min(imageWidth - cellWidth, Math.round(centerX))
  const topY = Math.max(0, Math.round(centerY - cellHeight))
  const bottomY = Math.min(imageHeight - cellHeight, Math.round(centerY))
  const baseRects: ImageCropRect[] = [
    { x: leftX, y: topY, width: cellWidth, height: cellHeight },
    { x: rightX, y: topY, width: cellWidth, height: cellHeight },
    { x: leftX, y: bottomY, width: cellWidth, height: cellHeight },
    { x: rightX, y: bottomY, width: cellWidth, height: cellHeight },
  ]
  const rects = pixels
    ? fitCommonAspectRects(
        baseRects.map((rect) => trimSeparatorEdges(pixels, imageWidth, imageHeight, rect)),
        targetAspect,
      )
    : baseRects
  const exportCellWidth = rects[0]?.width ?? cellWidth
  const exportCellHeight = rects[0]?.height ?? cellHeight

  return {
    imageWidth,
    imageHeight,
    targetAspect,
    verticalBand,
    horizontalBand,
    cellWidth: exportCellWidth,
    cellHeight: exportCellHeight,
    rects,
  }
}

function trimSeparatorEdges(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  rect: ImageCropRect,
): ImageCropRect {
  let x = rect.x
  let y = rect.y
  let width = rect.width
  let height = rect.height
  const maxTrim = Math.max(2, Math.min(80, Math.floor(Math.min(rect.width, rect.height) * 0.08)))

  let trimmed = 0
  while (trimmed < maxTrim && width > 2 && isSeparatorLine(pixels, imageWidth, imageHeight, { x, y, width, height }, 'left')) {
    x += 1
    width -= 1
    trimmed += 1
  }

  trimmed = 0
  while (trimmed < maxTrim && width > 2 && isSeparatorLine(pixels, imageWidth, imageHeight, { x, y, width, height }, 'right')) {
    width -= 1
    trimmed += 1
  }

  trimmed = 0
  while (trimmed < maxTrim && height > 2 && isSeparatorLine(pixels, imageWidth, imageHeight, { x, y, width, height }, 'top')) {
    y += 1
    height -= 1
    trimmed += 1
  }

  trimmed = 0
  while (trimmed < maxTrim && height > 2 && isSeparatorLine(pixels, imageWidth, imageHeight, { x, y, width, height }, 'bottom')) {
    height -= 1
    trimmed += 1
  }

  return { x, y, width, height }
}

function fitCommonAspectRects(rects: ImageCropRect[], targetAspect: number): ImageCropRect[] {
  const maxWidth = Math.max(1, Math.min(...rects.map((rect) => rect.width)))
  const maxHeight = Math.max(1, Math.min(...rects.map((rect) => rect.height)))
  const availableAspect = maxWidth / Math.max(1, maxHeight)
  const width = availableAspect > targetAspect
    ? Math.max(1, Math.min(maxWidth, Math.round(maxHeight * targetAspect)))
    : maxWidth
  const height = availableAspect > targetAspect
    ? maxHeight
    : Math.max(1, Math.min(maxHeight, Math.round(maxWidth / targetAspect)))

  return rects.map((rect) => ({
    x: rect.x + Math.max(0, Math.floor((rect.width - width) / 2)),
    y: rect.y + Math.max(0, Math.floor((rect.height - height) / 2)),
    width,
    height,
  }))
}

function isSeparatorLine(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  rect: ImageCropRect,
  side: 'left' | 'right' | 'top' | 'bottom',
) {
  const horizontal = side === 'top' || side === 'bottom'
  const length = horizontal ? rect.width : rect.height
  const fixed = side === 'left'
    ? rect.x
    : side === 'right'
    ? rect.x + rect.width - 1
    : side === 'top'
    ? rect.y
    : rect.y + rect.height - 1
  const step = Math.max(1, Math.floor(length / 300))
  let separatorCount = 0
  let sampled = 0

  for (let offset = 0; offset < length; offset += step) {
    const x = horizontal ? rect.x + offset : fixed
    const y = horizontal ? fixed : rect.y + offset
    if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) continue
    const pixelOffset = (y * imageWidth + x) * 4
    if (isSeparatorPixel(pixels[pixelOffset], pixels[pixelOffset + 1], pixels[pixelOffset + 2])) separatorCount++
    sampled++
  }

  return sampled > 0 && separatorCount / sampled >= 0.72
}

function isSeparatorPixel(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const brightness = (r + g + b) / 3
  return brightness > 226 && max - min < 48
}

function clampCropRect(rect: ImageCropRect, imageWidth: number, imageHeight: number): ImageCropRect {
  const x = Math.max(0, Math.min(imageWidth - 1, Math.round(rect.x)))
  const y = Math.max(0, Math.min(imageHeight - 1, Math.round(rect.y)))
  const width = Math.max(1, Math.min(imageWidth - x, Math.round(rect.width)))
  const height = Math.max(1, Math.min(imageHeight - y, Math.round(rect.height)))
  return { x, y, width, height }
}

function cropCanvasToBlob(source: HTMLCanvasElement, rect: ImageCropRect): Promise<Blob> {
  const crop = clampCropRect(rect, source.width, source.height)
  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas')
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return canvasToBlob(canvas, 'image/png')
}

function detectDividerBand(pixels: Uint8ClampedArray, width: number, height: number, axis: 'vertical' | 'horizontal'): SplitBand {
  const length = axis === 'vertical' ? width : height
  const crossLength = axis === 'vertical' ? height : width
  const center = length / 2
  const minIndex = Math.max(1, Math.floor(length * 0.32))
  const maxIndex = Math.min(length - 2, Math.ceil(length * 0.68))
  const scores: number[] = []

  for (let index = minIndex; index <= maxIndex; index++) {
    let brightCount = 0
    let diffSum = 0
    const prevIndex = Math.max(0, index - 1)
    const nextIndex = Math.min(length - 1, index + 1)
    const step = Math.max(1, Math.floor(crossLength / 700))
    let sampled = 0

    for (let cross = 0; cross < crossLength; cross += step) {
      const offset = getPixelOffset(axis, index, cross, width)
      const prevOffset = getPixelOffset(axis, prevIndex, cross, width)
      const nextOffset = getPixelOffset(axis, nextIndex, cross, width)
      const r = pixels[offset]
      const g = pixels[offset + 1]
      const b = pixels[offset + 2]
      const brightness = (r + g + b) / 3
      if (r > 228 && g > 228 && b > 228) brightCount++
      diffSum += Math.abs(r - pixels[prevOffset]) + Math.abs(g - pixels[prevOffset + 1]) + Math.abs(b - pixels[prevOffset + 2])
      diffSum += Math.abs(r - pixels[nextOffset]) + Math.abs(g - pixels[nextOffset + 1]) + Math.abs(b - pixels[nextOffset + 2])
      if (brightness > 245) diffSum -= 18
      sampled++
    }

    const brightRatio = brightCount / Math.max(1, sampled)
    const smoothScore = Math.max(0, 1 - diffSum / Math.max(1, sampled * 255 * 3 * 2))
    const centerScore = 1 - Math.min(1, Math.abs(index - center) / Math.max(1, length * 0.18))
    scores[index] = brightRatio * 0.72 + smoothScore * 0.2 + centerScore * 0.08
  }

  let bestIndex = Math.round(center)
  let bestScore = -Infinity
  for (let index = minIndex; index <= maxIndex; index++) {
    const score = scores[index] ?? 0
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }

  if (bestScore < 0.34) return { start: Math.floor(center), end: Math.ceil(center) }

  const threshold = Math.max(0.32, bestScore - 0.08)
  let start = bestIndex
  let end = bestIndex + 1
  while (start > minIndex && (scores[start - 1] ?? 0) >= threshold) start--
  while (end < maxIndex && (scores[end] ?? 0) >= threshold) end++

  return {
    start: Math.max(1, Math.min(length - 2, start)),
    end: Math.max(2, Math.min(length - 1, end)),
  }
}

function getPixelOffset(axis: 'vertical' | 'horizontal', index: number, cross: number, width: number) {
  return axis === 'vertical'
    ? (cross * width + index) * 4
    : (index * width + cross) * 4
}
