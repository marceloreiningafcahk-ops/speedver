import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, batchApplyTemplates, getTemplateApplyUploadPlan, getTemplatePromptReplacement } from '../store'
import type { TaskRecord } from '../types'
import { fileToDataUrl } from '../lib/dataUrl'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'

type UploadSlotTarget = { kind: 'single' | 'multi'; index: number }

function TemplatePromptReplacementEditor({
  template,
  value,
  onChange,
}: {
  template: TaskRecord
  value: string
  onChange: (value: string) => void
}) {
  const replacement = getTemplatePromptReplacement(template)
  if (!replacement) return null
  const title = template.customName?.trim() || template.prompt.slice(0, 18) || '未命名模板'
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-semibold text-gray-700 dark:text-gray-200" title={title}>{title}</p>
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">提示词替换</span>
      </div>
      <div className="max-h-24 overflow-y-auto rounded-xl bg-white/70 px-3 py-2 text-xs leading-relaxed text-gray-600 custom-scrollbar dark:bg-black/10 dark:text-gray-300">
        <span>{template.prompt.slice(0, replacement.start)}</span>
        <mark className="rounded bg-yellow-200/80 px-1 text-yellow-950 dark:bg-yellow-400/25 dark:text-yellow-100">{replacement.originalText}</mark>
        <span>{template.prompt.slice(replacement.end)}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="填写替换这段提示词的内容；留空则保留原文"
        className="mt-2 w-full resize-y rounded-xl border border-gray-200/70 bg-white px-3 py-2 text-xs leading-relaxed outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100 dark:focus:border-blue-500/50"
      />
    </div>
  )
}

function UploadSlot({
  label,
  hint,
  value,
  active,
  onPick,
  onClear,
}: {
  label: string
  hint: string
  value: string
  active: boolean
  onPick: () => void
  onClear: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>
        </div>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg px-2 py-1 text-[11px] text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]"
          >
            清除
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onPick}
        className={`flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-gray-50 transition dark:bg-white/[0.03] ${
          active
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/40 dark:border-white/15 dark:hover:border-blue-500/50'
        }`}
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">点击上传或粘贴图片</span>
          </div>
        )}
      </button>
    </div>
  )
}

export default function TemplateApplyModal() {
  usePreventBackgroundScroll(true)

  const selectedTemplateIds = useStore((s) => s.selectedTemplateIds)
  const tasks = useStore((s) => s.tasks)
  const setOpen = useStore((s) => s.setShowTemplateApplyModal)
  const showToast = useStore((s) => s.showToast)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [singleImage, setSingleImage] = useState('')
  const [multiImages, setMultiImages] = useState<string[]>([])
  const [promptReplacements, setPromptReplacements] = useState<Record<string, string>>({})
  const [activeSlot, setActiveSlot] = useState<UploadSlotTarget>({ kind: 'single', index: 0 })
  const [pendingSlot, setPendingSlot] = useState<UploadSlotTarget>({ kind: 'single', index: 0 })
  const [submitting, setSubmitting] = useState(false)

  const templates = useMemo(
    () => tasks.filter((task) => task.kind === 'template' && selectedTemplateIds.includes(task.id)),
    [tasks, selectedTemplateIds],
  )
  const slotPlan = useMemo(() => getTemplateApplyUploadPlan(templates), [templates])
  const promptReplacementTemplates = useMemo(
    () => templates.filter((template) => Boolean(getTemplatePromptReplacement(template))),
    [templates],
  )

  useEffect(() => {
    setMultiImages((current) => Array.from({ length: slotPlan.maxMultiSlots }, (_, index) => current[index] ?? ''))
    if (!slotPlan.hasSingleSlot && slotPlan.maxMultiSlots > 0) {
      setActiveSlot({ kind: 'multi', index: 0 })
      setPendingSlot({ kind: 'multi', index: 0 })
    }
  }, [slotPlan.hasSingleSlot, slotPlan.maxMultiSlots])

  useEffect(() => {
    const activeIds = new Set(promptReplacementTemplates.map((template) => template.id))
    setPromptReplacements((current) => Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id))))
  }, [promptReplacementTemplates])

  const onClose = () => setOpen(false)

  const setImageForSlot = (slot: UploadSlotTarget, dataUrl: string) => {
    if (slot.kind === 'single') {
      setSingleImage(dataUrl)
      return
    }
    setMultiImages((current) => current.map((item, index) => index === slot.index ? dataUrl : item))
  }

  const clearImageForSlot = (slot: UploadSlotTarget) => {
    if (slot.kind === 'single') {
      setSingleImage('')
      return
    }
    setMultiImages((current) => current.map((item, index) => index === slot.index ? '' : item))
  }

  const handlePickFile = async (slot: UploadSlotTarget, file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error')
      return
    }
    try {
      setImageForSlot(slot, await fileToDataUrl(file))
      setActiveSlot(slot)
    } catch {
      showToast('图片读取失败', 'error')
    }
  }

  const openFilePicker = (slot: UploadSlotTarget) => {
    setActiveSlot(slot)
    setPendingSlot(slot)
    fileInputRef.current?.click()
  }

  const choosePasteSlot = (): UploadSlotTarget => {
    if (activeSlot.kind === 'single' && slotPlan.hasSingleSlot) return activeSlot
    if (activeSlot.kind === 'multi' && activeSlot.index < slotPlan.maxMultiSlots) return activeSlot
    if (slotPlan.hasSingleSlot && !singleImage) return { kind: 'single', index: 0 }
    const emptyMultiIndex = multiImages.findIndex((item) => !item)
    if (emptyMultiIndex >= 0) return { kind: 'multi', index: emptyMultiIndex }
    return slotPlan.hasSingleSlot ? { kind: 'single', index: 0 } : { kind: 'multi', index: 0 }
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void handlePickFile(choosePasteSlot(), file)
            return
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [activeSlot, singleImage, multiImages, slotPlan.hasSingleSlot, slotPlan.maxMultiSlots])

  const missingSingle = slotPlan.hasSingleSlot && !singleImage
  const missingMulti = slotPlan.maxMultiSlots > 0 && multiImages.slice(0, slotPlan.maxMultiSlots).some((item) => !item)
  const canSubmit = !submitting && !missingSingle && !missingMulti

  const handleSubmit = async () => {
    if (missingSingle || missingMulti) {
      showToast('请先补齐需要替换的图片', 'error')
      return
    }
    setSubmitting(true)
    const ok = await batchApplyTemplates({
      singleImageDataUrl: slotPlan.hasSingleSlot ? singleImage : undefined,
      multiImageDataUrls: slotPlan.maxMultiSlots > 0 ? multiImages.slice(0, slotPlan.maxMultiSlots) : undefined,
      promptReplacements,
    })
    setSubmitting(false)
    if (ok) {
      onClose()
      useStore.getState().setAppMode('gallery')
    }
  }

  return (
    <div
      data-no-drag-select
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" onMouseDown={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col rounded-3xl border border-white/50 bg-white/95 shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-white/[0.06]">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">批量套用模板</h3>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              已选 {slotPlan.selectedCount} 个模板。单替换模板使用单张参考图，多替换模板按图位顺序使用多张参考图。
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handlePickFile(pendingSlot, e.target.files?.[0])
            e.target.value = ''
          }}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
          {promptReplacementTemplates.length > 0 && (
            <div className="mb-5 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">提示词替换</p>
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">只显示保存模板时设置过替换段的模板；留空会保留模板原文。</p>
              </div>
              {promptReplacementTemplates.map((template) => (
                <TemplatePromptReplacementEditor
                  key={template.id}
                  template={template}
                  value={promptReplacements[template.id] ?? ''}
                  onChange={(value) => setPromptReplacements((current) => ({ ...current, [template.id]: value }))}
                />
              ))}
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            {slotPlan.hasSingleSlot && (
              <UploadSlot
                label="单张参考图上传"
                hint="用于替换只标记了 1 张替换图的模板"
                value={singleImage}
                active={activeSlot.kind === 'single'}
                onPick={() => openFilePicker({ kind: 'single', index: 0 })}
                onClear={() => clearImageForSlot({ kind: 'single', index: 0 })}
              />
            )}

            {Array.from({ length: slotPlan.maxMultiSlots }, (_, index) => (
              <UploadSlot
                key={index}
                label={`多张参考图上传 ${index + 1}`}
                hint={`用于多替换模板的第 ${index + 1} 个替换图位`}
                value={multiImages[index] ?? ''}
                active={activeSlot.kind === 'multi' && activeSlot.index === index}
                onPick={() => openFilePicker({ kind: 'multi', index })}
                onClear={() => clearImageForSlot({ kind: 'multi', index })}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 p-5 dark:border-white/[0.06]">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? '生成中...' : `批量生成（${slotPlan.selectedCount}）`}
          </button>
        </div>
      </div>
    </div>
  )
}
