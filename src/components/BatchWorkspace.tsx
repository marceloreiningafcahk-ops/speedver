import { useEffect, useMemo, useState } from 'react'
import { createInputImageFromFile, deleteImageIfUnreferenced, submitBatchTasks, useStore, type BatchSubmitTaskInput } from '../store'
import type { InputImage, TaskParams } from '../types'
import { getOutputImageLimitForSettings } from '../lib/paramCompatibility'
import { CloseIcon, PlusIcon, TrashIcon } from './icons'
import Select from './Select'
import SizePickerModal from './SizePickerModal'

interface BatchDraftTask {
  id: string
  prompt: string
  images: InputImage[]
  fileName: string
}

function newDraftId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function getFileNameBase(file: File) {
  return file.name.replace(/\.[^.]+$/, '').trim()
}

function getImageFiles(files: FileList | File[]) {
  return Array.from(files).filter((file) => file.type.startsWith('image/'))
}

async function filesToInputImages(files: FileList | File[]) {
  const images: InputImage[] = []
  for (const file of getImageFiles(files)) {
    const image = await createInputImageFromFile(file)
    if (image) images.push(image)
  }
  return images
}

function filesToDraftTasks(files: FileList | File[], images: InputImage[]): BatchDraftTask[] {
  const imageFiles = getImageFiles(files)
  return images.map((image, index) => ({
    id: newDraftId(),
    prompt: '',
    images: [image],
    fileName: getFileNameBase(imageFiles[index]),
  }))
}

function ImageThumb({ image, onRemove }: { image: InputImage; onRemove: () => void }) {
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-white/[0.08] dark:bg-white/[0.04]">
      <img src={image.dataUrl} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white transition hover:bg-black/80"
        aria-label="移除图片"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function BatchWorkspace() {
  const settings = useStore((s) => s.settings)
  const params = useStore((s) => s.params)
  const tasksInStore = useStore((s) => s.tasks)
  const [batchName, setBatchName] = useState('批量生图')
  const [commonPrompt, setCommonPrompt] = useState('')
  const [commonImage, setCommonImage] = useState<InputImage | null>(null)
  const [batchParams, setBatchParams] = useState<TaskParams>(() => ({ ...params }))
  const [showSizePicker, setShowSizePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [draftTasks, setDraftTasks] = useState<BatchDraftTask[]>([
    { id: newDraftId(), prompt: '', images: [], fileName: '' },
  ])

  const latestBatchTasks = useMemo(() => (
    tasksInStore
      .filter((task) => task.sourceMode === 'batch')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
  ), [tasksInStore])
  const readyTaskCount = draftTasks.filter((task) => commonPrompt.trim() || task.prompt.trim() || task.images.length > 0 || commonImage).length
  const currentProfile = settings.profiles.find((profile) => profile.id === settings.activeProfileId) ?? settings.profiles[0]
  const outputImageLimit = getOutputImageLimitForSettings(settings)
  const selectClass = 'px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm transition shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100'
  const fieldClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100'

  const setBatchParam = (patch: Partial<TaskParams>) => {
    setBatchParams((current) => ({ ...current, ...patch }))
  }

  const addEmptyTask = () => {
    setDraftTasks((items) => [...items, { id: newDraftId(), prompt: '', images: [], fileName: '' }])
  }

  const removeImage = async (image: InputImage, onAfter: () => void) => {
    onAfter()
    await deleteImageIfUnreferenced(image.id)
  }

  const updateTask = (id: string, patch: Partial<BatchDraftTask>) => {
    setDraftTasks((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const removeTask = async (id: string) => {
    const task = draftTasks.find((item) => item.id === id)
    setDraftTasks((items) => items.length === 1 ? [{ id: newDraftId(), prompt: '', images: [], fileName: '' }] : items.filter((item) => item.id !== id))
    if (task) {
      for (const image of task.images) await deleteImageIfUnreferenced(image.id)
    }
  }

  const handleCommonImageFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const [image] = await filesToInputImages(files)
    if (!image) return
    const previous = commonImage
    setCommonImage(image)
    if (previous) await deleteImageIfUnreferenced(previous.id)
  }

  const handleTaskImageFiles = async (taskId: string, files: FileList | null) => {
    if (!files?.length) return
    const images = await filesToInputImages(files)
    if (!images.length) return
    setDraftTasks((items) => items.map((item) =>
      item.id === taskId ? { ...item, images: [...item.images, ...images] } : item,
    ))
  }

  const appendImageTasks = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    const images = await filesToInputImages(files)
    if (!images.length) return
    const nextTasks = filesToDraftTasks(files, images)
    setDraftTasks((items) => {
      const hasOnlyEmptyTask = items.length === 1 && !items[0].prompt.trim() && !items[0].images.length && !items[0].fileName.trim()
      return hasOnlyEmptyTask ? nextTasks : [...items, ...nextTasks]
    })
  }

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (!files.length) return
      event.preventDefault()
      void appendImageTasks(files)
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragActive(false)
    void appendImageTasks(event.dataTransfer.files)
  }

  const handleSubmit = async () => {
    const tasks: BatchSubmitTaskInput[] = draftTasks.map((task) => ({
      prompt: task.prompt,
      images: task.images,
      fileName: task.fileName,
    }))
    setSubmitting(true)
    try {
      await submitBatchTasks({
        batchName,
        commonPrompt,
        commonImage,
        tasks,
        params: batchParams,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      className="safe-area-x mx-auto max-w-7xl pb-16 pt-4"
      onDragEnter={(e) => {
        if (getImageFiles(e.dataTransfer.files).length > 0) setDragActive(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!dragActive) setDragActive(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false)
      }}
      onDrop={handleDrop}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">批量模式</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">共用参考图和提示词，也可以为每个任务追加图片与独立提示词。</p>
        </div>
      </div>

      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px]">
          <div className="rounded-xl border border-blue-400 bg-white px-5 py-3 text-sm font-medium text-blue-700 shadow-lg dark:bg-gray-900 dark:text-blue-200">
            松开后按图片数量创建任务卡
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">通用设置</h3>
              <span className="truncate text-xs text-gray-400">{currentProfile?.name ?? '未配置'}</span>
            </div>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">批次名称</span>
              <input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">通用提示词</span>
              <textarea
                value={commonPrompt}
                onChange={(e) => setCommonPrompt(e.target.value)}
                rows={7}
                placeholder="例如：保持参考图风格，生成高级电商主图，干净背景，柔和布光。"
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100"
              />
            </label>
            <div className="mb-3">
              <span className="mb-2 block text-xs text-gray-500 dark:text-gray-400">通用参考图</span>
              <div className="flex items-center gap-2">
                {commonImage ? (
                  <ImageThumb image={commonImage} onRemove={() => void removeImage(commonImage, () => setCommonImage(null))} />
                ) : (
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 transition hover:bg-gray-50 dark:border-white/[0.12] dark:hover:bg-white/[0.04]">
                    <PlusIcon className="h-5 w-5" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleCommonImageFiles(e.target.files)} />
                  </label>
                )}
                <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">会自动放在每个任务的参考图最前面。</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">生图参数</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label>
                <span className="mb-1 block text-gray-500 dark:text-gray-400">尺寸</span>
                <button
                  type="button"
                  onClick={() => setShowSizePicker(true)}
                  className={`${fieldClass} text-left font-mono`}
                >
                  {batchParams.size || 'auto'}
                </button>
              </label>
              <label>
                <span className="mb-1 block text-gray-500 dark:text-gray-400">数量</span>
                <input
                  value={batchParams.n}
                  onChange={(e) => setBatchParam({ n: Math.min(outputImageLimit, Math.max(1, Number(e.target.value) || 1)) })}
                  type="number"
                  min={1}
                  max={outputImageLimit}
                  className={`${fieldClass} font-mono`}
                />
              </label>
              <label>
                <span className="mb-1 block text-gray-500 dark:text-gray-400">质量</span>
                <Select
                  value={batchParams.quality}
                  onChange={(value) => setBatchParam({ quality: value as TaskParams['quality'] })}
                  options={[
                    { label: 'auto', value: 'auto' },
                    { label: 'low', value: 'low' },
                    { label: 'medium', value: 'medium' },
                    { label: 'high', value: 'high' },
                  ]}
                  className={selectClass}
                />
              </label>
              <label>
                <span className="mb-1 block text-gray-500 dark:text-gray-400">格式</span>
                <Select
                  value={batchParams.output_format}
                  onChange={(value) => {
                    const outputFormat = value as TaskParams['output_format']
                    setBatchParam({
                      output_format: outputFormat,
                      output_compression: outputFormat === 'png' ? null : batchParams.output_compression,
                      transparent_output: outputFormat === 'png' ? batchParams.transparent_output : false,
                    })
                  }}
                  options={[
                    { label: 'PNG', value: 'png' },
                    { label: 'JPEG', value: 'jpeg' },
                    { label: 'WebP', value: 'webp' },
                  ]}
                  className={selectClass}
                />
              </label>
              <label>
                <span className="mb-1 block text-gray-500 dark:text-gray-400">审核</span>
                <Select
                  value={batchParams.moderation}
                  onChange={(value) => setBatchParam({ moderation: value as TaskParams['moderation'] })}
                  options={[
                    { label: 'auto', value: 'auto' },
                    { label: 'low', value: 'low' },
                  ]}
                  className={selectClass}
                />
              </label>
              {batchParams.output_format === 'png' ? (
                <label>
                  <span className="mb-1 block text-gray-500 dark:text-gray-400">透明背景</span>
                  <Select
                    value={batchParams.transparent_output ? 'on' : 'off'}
                    onChange={(value) => setBatchParam({ transparent_output: value === 'on', output_compression: null })}
                    options={[
                      { label: 'false', value: 'off' },
                      { label: 'true', value: 'on' },
                    ]}
                    className={selectClass}
                  />
                </label>
              ) : (
                <label>
                  <span className="mb-1 block text-gray-500 dark:text-gray-400">压缩率</span>
                  <input
                    value={batchParams.output_compression ?? ''}
                    onChange={(e) => setBatchParam({ output_compression: e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0-100"
                    className={`${fieldClass} font-mono`}
                  />
                </label>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-gray-900">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">任务列表</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{readyTaskCount} 个可提交任务</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.04]">
                  多图拆任务
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void appendImageTasks(e.target.files)} />
                </label>
                <button
                  type="button"
                  onClick={addEmptyTask}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <PlusIcon className="h-4 w-4" />
                  添加任务
                </button>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500 dark:border-white/[0.12] dark:bg-white/[0.03] dark:text-gray-400">
              拖入多张图片，或直接粘贴剪贴板图片，会按图片数量创建任务卡。
            </div>

            <div className="space-y-3">
              {draftTasks.map((task, index) => (
                <div key={task.id} className="rounded-lg border border-gray-200 p-3 dark:border-white/[0.08]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">任务 {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => void removeTask(task.id)}
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      aria-label="删除任务"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    value={task.prompt}
                    onChange={(e) => updateTask(task.id, { prompt: e.target.value })}
                    rows={3}
                    placeholder="当前任务额外提示词，可留空只使用通用提示词。"
                    className="mb-3 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100"
                  />
                  <div className="mb-3 flex flex-wrap gap-2">
                    {task.images.map((image) => (
                      <ImageThumb
                        key={image.id}
                        image={image}
                        onRemove={() => void removeImage(image, () => updateTask(task.id, { images: task.images.filter((item) => item.id !== image.id) }))}
                      />
                    ))}
                    <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 transition hover:bg-gray-50 dark:border-white/[0.12] dark:hover:bg-white/[0.04]">
                      <PlusIcon className="h-5 w-5" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void handleTaskImageFiles(task.id, e.target.files)} />
                    </label>
                  </div>
                  <input
                    value={task.fileName}
                    onChange={(e) => updateTask(task.id, { fileName: e.target.value })}
                    placeholder="导出文件名，可选"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100"
                  />
                </div>
              ))}
            </div>

            <div className="sticky bottom-4 mt-4 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-white/[0.08] dark:bg-gray-900/95 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                提交后会进入现有生图模式画廊与历史记录。
              </div>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || readyTaskCount === 0}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
              >
                {submitting ? '提交中...' : `提交 ${readyTaskCount} 个任务`}
              </button>
            </div>
          </div>

          {latestBatchTasks.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-gray-900">
              <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">最近批量任务</h3>
              <div className="space-y-2">
                {latestBatchTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-white/[0.04]">
                    <div className="min-w-0">
                      <div className="truncate text-gray-700 dark:text-gray-200">{task.batchName || '批量任务'} · {task.batchIndex}/{task.batchTotal}</div>
                      <div className="truncate text-gray-400">{task.prompt}</div>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-1 ${
                      task.status === 'done'
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300'
                        : task.status === 'error'
                          ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                    }`}>
                      {task.status === 'done' ? '完成' : task.status === 'error' ? '失败' : '运行中'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      {showSizePicker && (
        <SizePickerModal
          currentSize={batchParams.size}
          onSelect={(size) => setBatchParam({ size })}
          onClose={() => setShowSizePicker(false)}
        />
      )}
    </main>
  )
}
