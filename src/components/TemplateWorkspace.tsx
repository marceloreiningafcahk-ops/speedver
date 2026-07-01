import { useEffect, useMemo, useRef, useState } from 'react'
import type { TaskRecord } from '../types'
import { useStore, ensureImageThumbnailCached, subscribeImageThumbnail, updateTaskInStore, removeTask, renameTemplateCollection, removeTemplateCollection, getTemplateCollections, moveTemplatesToCollection, reuseConfig, getTemplateReplaceImageIndexes, getLegacyTemplatePromptReplacement, getTemplatePromptReplacements, updateTemplateCollectionNote, importTemplates, clearTemplates } from '../store'
import { TemplateIcon, TagIcon, TrashIcon, ChevronDownIcon } from './icons'
import TemplateApplyModal from './TemplateApplyModal'
import Select from './Select'

function useImageThumb(imageId: string | undefined | null) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    setSrc('')
    if (!imageId) return
    let cancelled = false
    const unsubscribe = subscribeImageThumbnail(imageId, (thumbnail) => {
      if (!cancelled) setSrc(thumbnail.dataUrl)
    })
    ensureImageThumbnailCached(imageId).then((thumbnail) => {
      if (!cancelled && thumbnail) setSrc(thumbnail.dataUrl)
    }).catch(() => {})
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [imageId])
  return src
}

function TemplateThumbnail({ template }: { template: TaskRecord }) {
  const imageId = template.templateCoverImageId ?? template.inputImageIds[0]
  const src = useImageThumb(imageId)

  if (src) return <img src={src} alt="" className="h-full w-full object-cover" />
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300 dark:bg-white/[0.04] dark:text-gray-600">
      <TemplateIcon className="h-8 w-8" />
    </div>
  )
}

/** 编辑面板里的封面候选缩略图（从模板参考图里选） */
function CoverChoice({ imageId, active, onClick, index }: { imageId: string; active: boolean; onClick: () => void; index: number }) {
  const src = useImageThumb(imageId)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 transition ${
        active ? 'border-emerald-500 ring-1 ring-emerald-500/40' : 'border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/30'
      }`}
      title={`图${index + 1}`}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-gray-100 text-[9px] text-gray-400 dark:bg-white/[0.04]">图{index + 1}</span>}
    </button>
  )
}

const TEMPLATE_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b']

function TemplateCard({ template, suppressClickUntil }: { template: TaskRecord; suppressClickUntil: React.MutableRefObject<number> }) {
  const selectedIds = useStore((s) => s.selectedTemplateIds)
  const toggleSelection = useStore((s) => s.toggleTemplateSelection)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const setAppMode = useStore((s) => s.setAppMode)
  const selected = selectedIds.includes(template.id)
  const color = template.customColor?.trim() ?? ''
  const displayName = template.customName?.trim() || template.prompt

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [colorDraft, setColorDraft] = useState('')
  const [coverDraft, setCoverDraft] = useState<string | null>(null)
  const [promptDraft, setPromptDraft] = useState('')
  const [replaceIndexDrafts, setReplaceIndexDrafts] = useState<number[]>([0])

  const startEdit = () => {
    setNameDraft(template.customName ?? '')
    setColorDraft(template.customColor ?? '')
    setCoverDraft(template.templateCoverImageId ?? template.inputImageIds[0] ?? null)
    setPromptDraft(template.prompt ?? '')
    setReplaceIndexDrafts(getTemplateReplaceImageIndexes(template))
    setEditing(true)
  }
  const commitEdit = () => {
    const nextPrompt = promptDraft.trim()
    if (!nextPrompt) {
      setConfirmDialog({ title: '提示词不能为空', message: '模板的提示词不能为空，请填写后再保存。', action: () => {} })
      return
    }
    const nextPromptReplacements = getTemplatePromptReplacements({
      prompt: nextPrompt,
      templatePromptReplacement: template.templatePromptReplacement,
      templatePromptReplacements: template.templatePromptReplacements,
    })
    updateTaskInStore(template.id, {
      customName: nameDraft.trim() || undefined,
      customColor: colorDraft.trim() || undefined,
      templateCoverImageId: coverDraft ?? undefined,
      prompt: nextPrompt,
      templateReplaceImageIndex: replaceIndexDrafts[0] ?? 0,
      templateReplaceImageIndexes: replaceIndexDrafts,
      templatePromptReplacement: getLegacyTemplatePromptReplacement({ prompt: nextPrompt, templatePromptReplacements: nextPromptReplacements }),
      templatePromptReplacements: nextPromptReplacements.length ? nextPromptReplacements : undefined,
    })
    setEditing(false)
  }

  // 把模板的提示词 / 参考图 / 参数复用到生图模式（画廊）输入区
  const toggleReplaceIndexDraft = (idx: number) => {
    setReplaceIndexDrafts((current) => {
      if (current.includes(idx)) return current.length > 1 ? current.filter((item) => item !== idx) : current
      return [...current, idx].sort((a, b) => a - b)
    })
  }

  const reuseToGallery = () => {
    setAppMode('gallery')
    void reuseConfig(template)
  }

  return (
    <div
      onClick={() => {
        // 框选拖拽刚结束时，吞掉这一次卡片点击，避免误切换选中
        if (Date.now() < suppressClickUntil.current) return
        toggleSelection(template.id)
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition dark:bg-white/[0.03] ${
        selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-200/70 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/20'
      }`}
      style={color && !selected ? { borderColor: color } : undefined}
    >
      {/* 选中勾选 */}
      <div className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
        selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-white/70 bg-black/30 text-transparent'
      }`}>
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      {color && <span className="absolute right-2 top-2 z-10 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900" style={{ backgroundColor: color }} />}

      <div className="aspect-square w-full overflow-hidden">
        <TemplateThumbnail template={template} />
      </div>

      <div className="p-2.5" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <div className="space-y-1.5">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
              placeholder="模板名称"
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100"
            />
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
              placeholder="提示词"
              rows={3}
              className="w-full resize-y rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs leading-relaxed outline-none custom-scrollbar dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100"
            />
            {template.inputImageIds.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] text-gray-400 dark:text-gray-500">可替换图位（套用时替换这张）</p>
                <div className="flex flex-wrap gap-1">
                  {template.inputImageIds.map((imgId, idx) => (
                    <CoverChoice key={`${imgId}-${idx}`} imageId={imgId} index={idx} active={replaceIndexDrafts.includes(idx)} onClick={() => toggleReplaceIndexDraft(idx)} />
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => setColorDraft('')} className={`h-5 w-5 rounded-full border text-gray-400 ${colorDraft === '' ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-gray-300 dark:border-white/20'}`} title="无颜色">
                <svg className="mx-auto h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              {TEMPLATE_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColorDraft(c)} className="h-5 w-5 rounded-full border border-white/40" style={colorDraft === c ? { backgroundColor: c, boxShadow: `0 0 0 1px #fff, 0 0 0 3px ${c}` } : { backgroundColor: c }} title={c} />
              ))}
            </div>
            {template.inputImageIds.length > 1 && (
              <div>
                <p className="mb-1 text-[10px] text-gray-400 dark:text-gray-500">封面</p>
                <div className="flex flex-wrap gap-1">
                  {template.inputImageIds.map((imgId, idx) => (
                    <CoverChoice key={`${imgId}-${idx}`} imageId={imgId} index={idx} active={coverDraft === imgId} onClick={() => setCoverDraft(imgId)} />
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-1.5 pt-0.5">
              <button onClick={() => setEditing(false)} className="rounded-md px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]">取消</button>
              <button onClick={commitEdit} className="rounded-md bg-blue-500 px-2 py-0.5 text-[11px] text-white hover:bg-blue-600">保存</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-gray-200" title={displayName}>{displayName}</p>
            <button
              onClick={reuseToGallery}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-950/30"
              title="复用到生图模式"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button onClick={startEdit} className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200" title="编辑模板">
              <TagIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDialog({ title: '删除模板', message: '确定删除这个模板吗？', action: () => removeTask(template) })}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
              title="删除模板"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface TemplateGroup {
  key: string
  title: string
  note?: string
  templates: TaskRecord[]
}

const UNGROUPED_KEY = '__ungrouped__'

interface ImportProgress {
  total: number
  done: number
}

function waitForBrowserPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

function newCollectionId() {
  return `tplcol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** 「移动到分组」弹出菜单 */
function MoveToGroupMenu({ selectedIds, onDone }: { selectedIds: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const collections = open ? getTemplateCollections() : []

  const move = async (collectionId: string | null, name?: string) => {
    await moveTemplatesToCollection(selectedIds, collectionId, name)
    setOpen(false)
    setCreating(false)
    setNewName('')
    onDone()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]"
      >
        移动到分组
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setCreating(false) }} />
          <div className="absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 overflow-hidden rounded-2xl border border-gray-200/60 bg-white/95 py-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10">
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              <button onClick={() => move(null)} className="flex w-full items-center px-3 py-2 text-left text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[0.06]">未分组</button>
              {collections.map((c) => (
                <button key={c.id} onClick={() => move(c.id, c.name)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[0.06]">
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">{c.count}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 dark:border-white/[0.06]">
              {creating ? (
                <div className="flex items-center gap-1 p-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') move(newCollectionId(), newName.trim() || '新分组'); if (e.key === 'Escape') setCreating(false) }}
                    placeholder="新分组名称"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100"
                  />
                  <button onClick={() => move(newCollectionId(), newName.trim() || '新分组')} className="shrink-0 rounded-md bg-blue-500 px-2 py-1 text-[11px] text-white hover:bg-blue-600">建</button>
                </div>
              ) : (
                <button onClick={() => setCreating(true)} className="flex w-full items-center px-3 py-2 text-left text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10">＋ 新建分组</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function TemplateWorkspace() {
  const tasks = useStore((s) => s.tasks)
  const selectedIds = useStore((s) => s.selectedTemplateIds)
  const clearSelection = useStore((s) => s.clearTemplateSelection)
  const setSelectedTemplateIds = useStore((s) => s.setSelectedTemplateIds)
  const setShowApply = useStore((s) => s.setShowTemplateApplyModal)
  const showApply = useStore((s) => s.showTemplateApplyModal)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)

  const importInputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [selectionBox, setSelectionBox] = useState<{ startPageX: number; startPageY: number; currentPageX: number; currentPageY: number } | null>(null)
  const dragStart = useRef<{ pageX: number; pageY: number } | null>(null)
  const lastClientPoint = useRef<{ x: number; y: number } | null>(null)
  const hasDragged = useRef(false)
  const isDragging = useRef(false)
  const dragScrollIntervalRef = useRef<number | null>(null)
  const dragScrollDirectionRef = useRef<-1 | 1 | null>(null)
  const suppressClickUntil = useRef(0)
  const startedOnCard = useRef(false)
  const startedWithCtrl = useRef(false)
  const initialSelection = useRef<string[]>([])
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null)
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [editingGroupNoteKey, setEditingGroupNoteKey] = useState<string | null>(null)
  const [groupNoteDraft, setGroupNoteDraft] = useState('')
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const isImporting = Boolean(importProgress)
  const currentProfile = settings.profiles.find((profile) => profile.id === settings.activeProfileId) ?? settings.profiles[0]
  const profileOptions = useMemo(
    () => settings.profiles.map((profile) => ({ label: profile.name, value: profile.id })),
    [settings.profiles],
  )

  const handleSwitchProfile = (profileId: string) => {
    if (profileId === settings.activeProfileId) return
    setSettings({ activeProfileId: profileId })
  }

  const toggleGroupCollapsed = (key: string) => setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }))

  const startRenameGroup = (key: string, currentTitle: string) => {
    setEditingGroupKey(key)
    setGroupNameDraft(currentTitle)
  }
  const commitRenameGroup = (key: string) => {
    renameTemplateCollection(key, groupNameDraft)
    setEditingGroupKey(null)
  }
  const startEditGroupNote = (key: string, note: string | undefined) => {
    setEditingGroupNoteKey(key)
    setGroupNoteDraft(note ?? '')
  }
  const commitGroupNote = async (key: string) => {
    await updateTemplateCollectionNote(key === UNGROUPED_KEY ? null : key, groupNoteDraft)
    setEditingGroupNoteKey(null)
  }

  const handleImportFiles = async (files: FileList | File[] | null) => {
    const zipFiles = Array.from(files ?? []).filter((file) => /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed')
    if (!zipFiles.length || isImporting) return
    setImportProgress({ total: zipFiles.length, done: 0 })
    await waitForBrowserPaint()
    try {
      await importTemplates(zipFiles, (done, total) => {
        setImportProgress({ total, done })
      })
      await waitForBrowserPaint()
    } finally {
      setImportProgress(null)
    }
  }

  // 按 templateCollectionId 分组：手动建的归「未分组」，每个导入 ZIP 各成一组
  const groups = useMemo<TemplateGroup[]>(() => {
    const templates = tasks.filter((t) => t.kind === 'template')
    const byKey = new Map<string, TemplateGroup>()
    for (const t of templates) {
      const key = t.templateCollectionId || UNGROUPED_KEY
      let group = byKey.get(key)
      if (!group) {
        group = {
          key,
          title: key === UNGROUPED_KEY ? '未分组' : (t.templateCollectionName?.trim() || '导入的模板'),
          note: t.templateCollectionNote?.trim() || undefined,
          templates: [],
        }
        byKey.set(key, group)
      }
      group.templates.push(t)
      // 同组内取最新的非空名作为标题（导入项一般同名）
      if (key !== UNGROUPED_KEY && t.templateCollectionName?.trim()) group.title = t.templateCollectionName.trim()
      if (t.templateCollectionNote?.trim()) group.note = t.templateCollectionNote.trim()
    }
    for (const group of byKey.values()) group.templates.sort((a, b) => b.createdAt - a.createdAt)
    // 未分组排最前，其余按组内最新模板时间倒序
    return Array.from(byKey.values()).sort((a, b) => {
      if (a.key === UNGROUPED_KEY) return -1
      if (b.key === UNGROUPED_KEY) return 1
      return (b.templates[0]?.createdAt ?? 0) - (a.templates[0]?.createdAt ?? 0)
    })
  }, [tasks])

  const totalTemplates = useMemo(() => groups.reduce((sum, g) => sum + g.templates.length, 0), [groups])

  const getPagePoint = (clientX: number, clientY: number) => ({
    pageX: clientX + window.scrollX,
    pageY: clientY + window.scrollY,
  })

  const beginSelection = (target: HTMLElement, clientX: number, clientY: number, isCtrl: boolean) => {
    const point = getPagePoint(clientX, clientY)
    startedOnCard.current = Boolean(target.closest('.template-card-wrapper'))
    startedWithCtrl.current = isCtrl
    initialSelection.current = [...useStore.getState().selectedTemplateIds]
    isDragging.current = true
    hasDragged.current = false
    dragStart.current = point
    lastClientPoint.current = { x: clientX, y: clientY }
    document.body.classList.add('select-none')
    document.body.classList.add('drag-selecting')
    setSelectionBox({ startPageX: point.pageX, startPageY: point.pageY, currentPageX: point.pageX, currentPageY: point.pageY })
  }

  const updateSelectionFromPoint = (pageX: number, pageY: number) => {
    const start = dragStart.current
    if (!start || !gridRef.current) return

    const minX = Math.min(start.pageX, pageX)
    const maxX = Math.max(start.pageX, pageX)
    const minY = Math.min(start.pageY, pageY)
    const maxY = Math.max(start.pageY, pageY)

    const cards = gridRef.current.querySelectorAll('.template-card-wrapper')
    const newSelected = new Set(initialSelection.current)
    const initialSelected = new Set(initialSelection.current)

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const id = card.getAttribute('data-template-id')
      if (!id) return

      const cardLeft = rect.left + window.scrollX
      const cardRight = rect.right + window.scrollX
      const cardTop = rect.top + window.scrollY
      const cardBottom = rect.bottom + window.scrollY

      const isIntersecting = minX < cardRight && maxX > cardLeft && minY < cardBottom && maxY > cardTop
      if (isIntersecting) {
        if (initialSelected.has(id)) newSelected.delete(id)
        else newSelected.add(id)
      } else if (!initialSelected.has(id)) {
        newSelected.delete(id)
      }
    })

    setSelectedTemplateIds(Array.from(newSelected))
  }

  useEffect(() => {
    const stopDragScroll = () => {
      if (dragScrollIntervalRef.current) {
        clearInterval(dragScrollIntervalRef.current)
        dragScrollIntervalRef.current = null
      }
      dragScrollDirectionRef.current = null
    }

    const startDragScroll = (direction: -1 | 1) => {
      if (dragScrollIntervalRef.current && dragScrollDirectionRef.current === direction) return
      stopDragScroll()
      dragScrollDirectionRef.current = direction
      dragScrollIntervalRef.current = window.setInterval(() => {
        window.scrollBy({ top: direction * 15, behavior: 'instant' })
      }, 16)
    }

    const endSelection = (clearEmptySurfaceClick = false, suppressClick = false) => {
      if (isDragging.current) {
        document.body.classList.remove('select-none')
        document.body.classList.remove('drag-selecting')
      }
      if (isDragging.current && clearEmptySurfaceClick && !hasDragged.current && !startedOnCard.current && !startedWithCtrl.current) {
        clearSelection()
      }
      if (isDragging.current && suppressClick && hasDragged.current) {
        suppressClickUntil.current = Date.now() + 250
      }
      stopDragScroll()
      isDragging.current = false
      dragStart.current = null
      lastClientPoint.current = null
      setSelectionBox(null)
    }

    const getEventElement = (e: MouseEvent) => {
      if (e.target instanceof Element) return e.target
      return document.elementFromPoint(e.clientX, e.clientY)
    }

    const handleDocumentMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = getEventElement(e)
      if (!target) return
      if (!target.closest('[data-template-grid-surface]')) return
      if (target.closest('[data-no-drag-select], [data-lightbox-root]')) return
      if (target.closest('button, a, input, textarea, select')) return

      const isCtrl = isMac ? e.metaKey : e.ctrlKey
      beginSelection(target as HTMLElement, e.clientX, e.clientY, isCtrl)
      e.preventDefault()
    }

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !dragStart.current) return
      const start = dragStart.current
      const point = getPagePoint(e.clientX, e.clientY)
      lastClientPoint.current = { x: e.clientX, y: e.clientY }
      const distance = Math.hypot(point.pageX - start.pageX, point.pageY - start.pageY)
      if (distance < 6 && !hasDragged.current) return

      hasDragged.current = true
      setSelectionBox({ startPageX: start.pageX, startPageY: start.pageY, currentPageX: point.pageX, currentPageY: point.pageY })
      updateSelectionFromPoint(point.pageX, point.pageY)
      e.preventDefault()

      const scrollThreshold = 40
      if (e.clientY < scrollThreshold) startDragScroll(-1)
      else if (e.clientY > window.innerHeight - scrollThreshold) startDragScroll(1)
      else stopDragScroll()
    }

    const handleDocumentScroll = () => {
      if (!isDragging.current || !dragStart.current || !lastClientPoint.current || !hasDragged.current) return
      const point = getPagePoint(lastClientPoint.current.x, lastClientPoint.current.y)
      const start = dragStart.current
      setSelectionBox({ startPageX: start.pageX, startPageY: start.pageY, currentPageX: point.pageX, currentPageY: point.pageY })
      updateSelectionFromPoint(point.pageX, point.pageY)
    }

    const handleDocumentWheel = (e: WheelEvent) => {
      if (!isDragging.current) return
      if ((e.buttons & 1) === 0) {
        endSelection()
        return
      }
    }

    const handleDocumentMouseUp = () => {
      endSelection(true, true)
    }

    document.addEventListener('mousedown', handleDocumentMouseDown, true)
    document.addEventListener('mousemove', handleDocumentMouseMove, true)
    document.addEventListener('mouseup', handleDocumentMouseUp, true)
    document.addEventListener('wheel', handleDocumentWheel, { capture: true, passive: false })
    window.addEventListener('scroll', handleDocumentScroll, true)
    return () => {
      stopDragScroll()
      document.removeEventListener('mousedown', handleDocumentMouseDown, true)
      document.removeEventListener('mousemove', handleDocumentMouseMove, true)
      document.removeEventListener('mouseup', handleDocumentMouseUp, true)
      document.removeEventListener('wheel', handleDocumentWheel, true)
      window.removeEventListener('scroll', handleDocumentScroll, true)
    }
  }, [clearSelection, setSelectedTemplateIds, isMac])

  return (
    <main className="pb-48" data-tour="template-workspace">
      <input
        ref={importInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? [])
          e.currentTarget.value = ''
          void handleImportFiles(files)
        }}
      />
      {importProgress && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/35 backdrop-blur-sm">
          <div className="w-[min(340px,calc(100vw-32px))] rounded-xl border border-gray-200 bg-white p-5 text-center shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
            <svg className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">正在导入模板</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {importProgress.done}/{importProgress.total} 个 ZIP 已处理
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.max(5, Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}
      <div className="safe-area-x max-w-7xl mx-auto px-1" data-template-grid-surface>
        <div data-no-drag-select className="flex items-center justify-between gap-3 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">模板模式</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">管理保存的模板，选择后可批量套用生成。</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDialog({
                title: '清空全部模板',
                message: '确定要删除所有模板及其专属图片吗？此操作不可恢复。',
                action: () => clearTemplates(),
              })}
              disabled={isImporting || totalTemplates === 0}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
            >
              一键清空模板
            </button>
            <label className="ml-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="shrink-0">当前配置</span>
              <Select
                value={currentProfile?.id ?? ''}
                onChange={(value) => handleSwitchProfile(String(value))}
                options={profileOptions}
                className="min-w-[150px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100"
              />
            </label>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]"
            >
              导入模板
            </button>
          </div>
        </div>
        {totalTemplates === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-center text-gray-400 dark:text-gray-500">
            <TemplateIcon className="w-12 h-12 opacity-40" />
            <p className="text-base font-medium text-gray-500 dark:text-gray-400">还没有模板</p>
            <p className="text-sm">在生图模式输入提示词与参考图后，点击「保存为模板」</p>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="mt-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              从 ZIP 导入模板
            </button>
          </div>
        ) : (
          <div ref={gridRef} className="relative py-4">
            {groups.map((group) => {
              const collapsed = !!collapsedGroups[group.key]
              const isUngrouped = group.key === UNGROUPED_KEY
              const isEditing = editingGroupKey === group.key
              const isEditingNote = editingGroupNoteKey === group.key
              return (
                <section key={group.key} className="mb-6">
                  <div data-no-drag-select className="mb-2 flex items-center gap-2 px-1">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapsed(group.key)}
                      className="flex items-center gap-2 rounded-lg py-1 pr-1 text-left transition hover:bg-gray-100/60 dark:hover:bg-white/[0.04]"
                      aria-expanded={!collapsed}
                    >
                      <ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
                      {!isEditing && <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{group.title}</h3>}
                    </button>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={groupNameDraft}
                        onChange={(e) => setGroupNameDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRenameGroup(group.key); if (e.key === 'Escape') setEditingGroupKey(null) }}
                        onBlur={() => commitRenameGroup(group.key)}
                        placeholder="分组名称"
                        className="w-44 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-300/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100"
                      />
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">{group.templates.length}</span>
                    )}
                    {!isUngrouped && !isEditing && (
                      <button
                        type="button"
                        onClick={() => startRenameGroup(group.key, group.title)}
                        className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                        title="重命名分组"
                      >
                        <TagIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEditGroupNote(group.key, group.note)}
                        className={`rounded-md p-1 transition hover:bg-gray-100 dark:hover:bg-white/[0.06] ${
                          group.note ? 'text-blue-500 dark:text-blue-300' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                        }`}
                        title={group.note ? `备注：${group.note}` : '添加分组备注'}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m8-2a9 9 0 11-4.5-7.794L21 4l-.206 4.5A8.96 8.96 0 0121 12z" />
                        </svg>
                      </button>
                    )}
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setConfirmDialog({
                          title: '删除整个分组',
                          message: `确定删除分组「${group.title}」及其中的 ${group.templates.length} 个模板吗？此操作不可恢复。`,
                          action: () => removeTemplateCollection(isUngrouped ? null : group.key),
                        })}
                        className="rounded-md p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                        title="删除整个分组"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {isEditingNote && (
                    <div data-no-drag-select className="mb-3 flex max-w-xl items-start gap-2 px-1">
                      <textarea
                        autoFocus
                        value={groupNoteDraft}
                        onChange={(e) => setGroupNoteDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingGroupNoteKey(null)
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void commitGroupNote(group.key)
                        }}
                        rows={2}
                        placeholder="填写这个模板组的使用备注"
                        className="min-w-0 flex-1 resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed outline-none focus:ring-1 focus:ring-blue-300/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100"
                      />
                      <div className="flex shrink-0 flex-col gap-1">
                        <button type="button" onClick={() => void commitGroupNote(group.key)} className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600">保存</button>
                        <button type="button" onClick={() => setEditingGroupNoteKey(null)} className="rounded-lg px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]">取消</button>
                      </div>
                    </div>
                  )}
                  {!isEditingNote && group.note && (
                    <p data-no-drag-select className="mb-3 max-w-3xl truncate px-1 text-xs text-gray-400 dark:text-gray-500" title={group.note}>
                      备注：{group.note}
                    </p>
                  )}
                  {!collapsed && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {group.templates.map((template) => (
                        <div key={template.id} className="template-card-wrapper" data-template-id={template.id}>
                          <TemplateCard template={template} suppressClickUntil={suppressClickUntil} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>

      {selectionBox && (
        <div
          className="fixed bg-blue-500/20 border border-blue-500/50 pointer-events-none z-[30]"
          style={{
            left: Math.min(selectionBox.startPageX, selectionBox.currentPageX) - window.scrollX,
            top: Math.min(selectionBox.startPageY, selectionBox.currentPageY) - window.scrollY,
            width: Math.abs(selectionBox.currentPageX - selectionBox.startPageX),
            height: Math.abs(selectionBox.currentPageY - selectionBox.startPageY),
          }}
        />
      )}

      {/* 批量套用操作栏 */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-gray-200/50 bg-white/90 p-1.5 pl-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur dark:border-white/10 dark:bg-gray-800/90">
            <span className="text-sm text-gray-600 dark:text-gray-300">已选 {selectedIds.length} 个模板</span>
            <button onClick={clearSelection} className="rounded-full px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/[0.06]">取消</button>
            <MoveToGroupMenu selectedIds={selectedIds} onDone={clearSelection} />
            <button data-tour="template-apply-button" onClick={() => setShowApply(true)} className="rounded-full bg-blue-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-600">批量套用</button>
          </div>
        </div>
      )}

      {showApply && <TemplateApplyModal />}
    </main>
  )
}
