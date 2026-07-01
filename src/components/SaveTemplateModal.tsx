import { useMemo, useRef, useState } from 'react'
import type { TemplatePromptReplacement } from '../types'
import { useStore, saveCurrentInputAsTemplate, getTemplateCollections } from '../store'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import Select from './Select'

// 模板卡片可选颜色（与卡片边框/角标一致，留空表示不设颜色）
const TEMPLATE_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b']

const NEW_GROUP_VALUE = '__new_group__'
const UNGROUPED_VALUE = '__ungrouped__'

function newCollectionId() {
  return `tplcol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// 仅在弹窗打开时由 App 挂载，保证每次打开都重置状态
export default function SaveTemplateModal() {
  usePreventBackgroundScroll(true)

  const setOpen = useStore((s) => s.setShowSaveTemplateModal)
  const inputImages = useStore((s) => s.inputImages)
  const prompt = useStore((s) => s.prompt)
  const collections = useMemo(() => getTemplateCollections(), [])
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)

  // 默认沿用旧习惯：最后一张图作为可替换的材质/产品图
  const [replaceableIndexes, setReplaceableIndexes] = useState<number[]>(() => [Math.max(0, inputImages.length - 1)])
  // 封面默认用第一张参考图，可由用户另选
  const [coverIndex, setCoverIndex] = useState(0)
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [groupChoice, setGroupChoice] = useState<string>(UNGROUPED_VALUE)
  const [newGroupName, setNewGroupName] = useState('')
  const [promptReplacements, setPromptReplacements] = useState<TemplatePromptReplacement[]>([])
  const [saving, setSaving] = useState(false)

  const onClose = () => setOpen(false)

  const toggleReplaceableIndex = (idx: number) => {
    setReplaceableIndexes((current) => {
      if (current.includes(idx)) return current.length > 1 ? current.filter((item) => item !== idx) : current
      return [...current, idx].sort((a, b) => a - b)
    })
  }

  const handleSave = async () => {
    setSaving(true)
    let templateCollectionId: string | null = null
    let templateCollectionName: string | undefined
    if (groupChoice === NEW_GROUP_VALUE) {
      templateCollectionId = newCollectionId()
      templateCollectionName = newGroupName.trim() || '新分组'
    } else if (groupChoice !== UNGROUPED_VALUE) {
      templateCollectionId = groupChoice
      templateCollectionName = collections.find((c) => c.id === groupChoice)?.name
    }
    const ok = await saveCurrentInputAsTemplate({ replaceableIndex: replaceableIndexes[0] ?? 0, replaceableIndexes, coverIndex, promptReplacements, name, color, templateCollectionId, templateCollectionName })
    setSaving(false)
    if (ok) onClose()
  }

  const setSelectedPromptReplacement = () => {
    const el = promptTextareaRef.current
    if (!el) return
    const start = Math.min(el.selectionStart, el.selectionEnd)
    const end = Math.max(el.selectionStart, el.selectionEnd)
    const originalText = prompt.slice(start, end)
    if (!originalText.trim()) {
      return
    }
    const nextReplacement = { start, end, originalText }
    setPromptReplacements((current) => {
      const withoutOverlap = current.filter((item) => end <= item.start || start >= item.end)
      return [...withoutOverlap, nextReplacement].sort((a, b) => a.start - b.start || a.end - b.end)
    })
  }

  const removePromptReplacement = (index: number) => {
    setPromptReplacements((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div
      data-no-drag-select
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" onMouseDown={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in custom-scrollbar dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">保存为模板</h3>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">选择「可替换的材质 / 产品图」（套用时只替换这张），并可另选一张作为模板封面</p>
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

          <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">提示词替换段（可选）</p>
              <div className="flex items-center gap-1">
                {promptReplacements.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPromptReplacements([])}
                    className="rounded-lg px-2 py-1 text-[11px] text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]"
                  >
                    清除全部
                  </button>
                )}
                <button
                  type="button"
                  onClick={setSelectedPromptReplacement}
                  className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
                >
                  添加替换段
                </button>
              </div>
            </div>
            <textarea
              ref={promptTextareaRef}
              readOnly
              value={prompt}
              rows={4}
              className="w-full resize-y rounded-xl border border-gray-200/60 bg-gray-50/70 px-3 py-2 text-xs leading-relaxed text-gray-700 outline-none custom-scrollbar dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200"
            />
            {promptReplacements.length > 0 ? (
              <div className="mt-2 space-y-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
                <p className="font-medium">套用模板时可替换 {promptReplacements.length} 段：</p>
                {promptReplacements.map((item, index) => (
                  <div key={`${item.start}-${item.end}`} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{index + 1}. {item.originalText}</span>
                    <button
                      type="button"
                      onClick={() => removePromptReplacement(index)}
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] transition hover:bg-blue-100 dark:hover:bg-blue-500/15"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">选中上方提示词中的一段，再点击“添加替换段”；可重复添加多段，不设置则套用时不显示提示词替换。</p>
            )}
          </div>

          {/* 可替换图位选择 */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">可替换图位（点击选择）</p>
            <div className="flex flex-wrap gap-2">
              {inputImages.map((img, idx) => (
                <button
                  key={img.slotId ?? `${img.id}-${idx}`}
                  type="button"
                  onClick={() => toggleReplaceableIndex(idx)}
                  className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                    replaceableIndexes.includes(idx)
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                  title={`图${idx + 1}`}
                >
                  <img src={img.dataUrl} alt={`图${idx + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-black/55 px-1 text-[10px] font-medium text-white">图{idx + 1}</span>
                  {replaceableIndexes.includes(idx) && (
                    <span className="absolute bottom-0 left-0 right-0 bg-blue-500 py-0.5 text-center text-[10px] font-medium text-white">替换</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 封面图位选择 */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">封面图（点击选择，用于模板卡片展示）</p>
            <div className="flex flex-wrap gap-2">
              {inputImages.map((img, idx) => (
                <button
                  key={img.slotId ?? `${img.id}-${idx}`}
                  type="button"
                  onClick={() => setCoverIndex(idx)}
                  className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                    idx === coverIndex
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                  title={`图${idx + 1}`}
                >
                  <img src={img.dataUrl} alt={`图${idx + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-black/55 px-1 text-[10px] font-medium text-white">图{idx + 1}</span>
                  {idx === coverIndex && (
                    <span className="absolute bottom-0 left-0 right-0 bg-emerald-500 py-0.5 text-center text-[10px] font-medium text-white">封面</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 模板名称 */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">模板名称（可选）</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：沙发垫 SKU 图"
              className="w-full rounded-xl border border-gray-200/60 bg-white/50 px-3 py-2 text-sm outline-none transition focus:ring-1 focus:ring-blue-300/40 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100"
            />
          </div>

          {/* 模板颜色 */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">卡片颜色（可选）</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setColor('')}
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-gray-400 transition ${
                  color === '' ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-300 dark:border-white/20'
                }`}
                title="无颜色"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              {TEMPLATE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full border border-white/40 transition"
                  style={color === c ? { backgroundColor: c, boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${c}` } : { backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* 所属分组 */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">所属分组（可选）</p>
            <Select
              value={groupChoice}
              onChange={(value) => setGroupChoice(String(value))}
              options={[
                { label: '未分组', value: UNGROUPED_VALUE },
                ...collections.map((c) => ({ label: `${c.name}（${c.count}）`, value: c.id })),
                { label: '＋ 新建分组', value: NEW_GROUP_VALUE, variant: 'action' as const },
              ]}
              className="w-full rounded-xl border border-gray-200/60 bg-white/50 px-3 py-2 text-sm text-gray-700 outline-none transition dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200"
            />
            {groupChoice === NEW_GROUP_VALUE && (
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="新分组名称"
                className="mt-2 w-full rounded-xl border border-gray-200/60 bg-white/50 px-3 py-2 text-sm outline-none transition focus:ring-1 focus:ring-blue-300/40 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100"
              />
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存模板'}
          </button>
        </div>
      </div>
    </div>
  )
}
