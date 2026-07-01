import { describe, expect, it } from 'vitest'
import { createFourGridSplitPlan } from './imageExport'

describe('four grid export planning', () => {
  it('keeps all crop regions the same size and follows the source image aspect', () => {
    const plan = createFourGridSplitPlan(
      1300,
      1700,
      { start: 590, end: 640 },
      { start: 820, end: 875 },
    )

    expect(plan.cellWidth).toBe(615)
    expect(plan.cellHeight).toBe(804)
    expect(plan.rects).toEqual([
      { x: 0, y: 44, width: 615, height: 804 },
      { x: 615, y: 44, width: 615, height: 804 },
      { x: 0, y: 848, width: 615, height: 804 },
      { x: 615, y: 848, width: 615, height: 804 },
    ])
    expect(plan.cellWidth / plan.cellHeight).toBeCloseTo(1300 / 1700, 2)
  })

  it('uses divider centers so thick and thin separator bands with the same center export the same cells', () => {
    const thinPlan = createFourGridSplitPlan(
      1024,
      1024,
      { start: 511, end: 513 },
      { start: 511, end: 513 },
    )
    const thickPlan = createFourGridSplitPlan(
      1024,
      1024,
      { start: 500, end: 524 },
      { start: 492, end: 532 },
    )

    expect(thickPlan.rects).toEqual(thinPlan.rects)
    expect(new Set(thickPlan.rects.map((rect) => `${rect.width}x${rect.height}`))).toEqual(new Set(['512x512']))
  })

  it('trims light separator borders and exports only the content inside each grid frame', () => {
    const pixels = createGridPixels(100, 100)
    const plan = createFourGridSplitPlan(
      100,
      100,
      { start: 48, end: 52 },
      { start: 48, end: 52 },
      pixels,
    )

    expect(plan.rects).toEqual([
      { x: 4, y: 4, width: 44, height: 44 },
      { x: 52, y: 4, width: 44, height: 44 },
      { x: 4, y: 52, width: 44, height: 44 },
      { x: 52, y: 52, width: 44, height: 44 },
    ])
  })

  it('exports square cells for a square four-grid image', () => {
    const plan = createFourGridSplitPlan(
      1025,
      1025,
      { start: 512, end: 513 },
      { start: 512, end: 513 },
    )

    expect(new Set(plan.rects.map((rect) => `${rect.width}x${rect.height}`))).toEqual(new Set(['512x512']))
  })

  it('keeps portrait source image aspect instead of stretching cells to the divider bounds', () => {
    const plan = createFourGridSplitPlan(
      900,
      1200,
      { start: 450, end: 450 },
      { start: 600, end: 600 },
    )

    expect(new Set(plan.rects.map((rect) => `${rect.width}x${rect.height}`))).toEqual(new Set(['450x600']))
    expect(plan.cellWidth / plan.cellHeight).toBeCloseTo(900 / 1200, 2)
  })
})

function createGridPixels(width: number, height: number) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const separator = x < 4 || x >= 96 || y < 4 || y >= 96 || (x >= 48 && x < 52) || (y >= 48 && y < 52)
      pixels[offset] = separator ? 245 : 80
      pixels[offset + 1] = separator ? 245 : 120
      pixels[offset + 2] = separator ? 245 : 160
      pixels[offset + 3] = 255
    }
  }
  return pixels
}
