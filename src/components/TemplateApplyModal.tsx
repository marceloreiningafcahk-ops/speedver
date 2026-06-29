import { useEffect, useRef, useState } from 'react'
import { useStore, batchApplyTemplates } from '../store'
import { fileToDataUrl } from '../lib/dataUrl'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'

// 批量套用模板：上传一张材质/产品图，确认后对每个选中模板替换图位并批量生成
export default function TemplateApplyModal() {
  usePreventBackgroundScroll(true)

  const selectedCount = useStore((s) => s.selectedTemplateIds.length)
  const setOpen = useStore((s) => s.setShowTemplateApplyModal)
  const showToast = useStore((s) => s.showToast)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [productImage, setProductImage] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const onClose = () => setOpen(false)

  const handlePickFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error')
      return
    }
    try {
      setProductImage(await fileToDataUrl(file))
    } catch {
      showToast('图片读取失败', 'error')
    }
  }

  // 粘贴图片作为材质 / 产品图
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void handlePickFile(file)
            return
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const handleSubmit = async () => {
    if (!productImage) {
      showToast('请先上传材质 / 产品图', 'error')
      return
    }
    setSubmitting(true)
    const ok = await batchApplyTemplates(productImage)
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
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">批量套用模板</h3>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">已选 {selectedCount} 个模板，上传或粘贴一张材质 / 产品图，将替换每个模板中标记的图位</p>
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
          onChange={(e) => { void handlePickFile(e.target.files?.[0]); e.target.value = '' }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-blue-500/50"
        >
          {productImage ? (
            <img src={productImage} alt="材质/产品图" className="h-full w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-sm">点击上传或粘贴材质 / 产品图</span>
            </div>
          )}
        </button>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !productImage}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? '生成中…' : `批量生成（${selectedCount}）`}
          </button>
        </div>
      </div>
    </div>
  )
}
