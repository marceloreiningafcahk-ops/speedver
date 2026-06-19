import { describe, expect, it } from 'vitest'

import type { AppSettings, StoredImage, StoredImageThumbnail, TaskParams, TaskRecord } from '../types'
import { buildExportZip, readExportZip, readExportZipFileAsDataUrl } from './exportZip'

describe('exportZip', () => {
  it('builds and reads backup zip entries without changing manifest shape', () => {
    const task: TaskRecord = {
      id: 'task-1',
      prompt: '提示词',
      params: {} as TaskParams,
      inputImageIds: ['img-1'],
      outputImages: [],
      status: 'done',
      error: null,
      createdAt: 1700000000000,
      finishedAt: 1700000000200,
      elapsed: 200,
    }
    const images: StoredImage[] = [{
      id: 'img-1',
      dataUrl: 'data:image/png;base64,AAECAw==',
      source: 'generated',
    }]
    const thumbnail: StoredImageThumbnail = {
      id: 'img-1',
      thumbnailDataUrl: 'data:image/jpeg;base64,BAUG',
      width: 32,
      height: 24,
      thumbnailVersion: 2,
    }

    const { manifest, bytes } = buildExportZip({
      options: { exportConfig: true, exportTasks: true },
      exportedAt: 1700000001000,
      settings: {} as AppSettings,
      tasks: [task],
      images,
      thumbnailsByImageId: new Map([[thumbnail.id, thumbnail]]),
      favoriteCollections: [],
      defaultFavoriteCollectionId: null,
      agentConversations: [],
    })
    const parsed = readExportZip(bytes)

    expect(parsed.manifest).toEqual(manifest)
    expect(parsed.manifest.version).toBe(3)
    expect(parsed.manifest.exportedAt).toBe(new Date(1700000001000).toISOString())
    expect(parsed.manifest.imageFiles?.['img-1']).toEqual({
      path: 'images/img-1.png',
      createdAt: 1700000000000,
      source: 'generated',
      width: 32,
      height: 24,
    })
    expect(parsed.manifest.thumbnailFiles?.['img-1']).toEqual({
      path: 'thumbnails/img-1.jpeg',
      width: 32,
      height: 24,
      thumbnailVersion: 2,
    })
    expect(readExportZipFileAsDataUrl(parsed.files, 'images/img-1.png')).toBe(images[0].dataUrl)
    expect(readExportZipFileAsDataUrl(parsed.files, 'thumbnails/img-1.jpeg')).toBe(thumbnail.thumbnailDataUrl)
  })
})
