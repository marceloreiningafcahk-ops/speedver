import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

const PANEL_WIDTH = 268
const PANEL_HEIGHT = 360

interface DateRangePickerProps {
  start: string
  end: string
  onChange: (start: string, end: string) => void
  className?: string
  placeholder?: string
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

const pad = (n: number) => String(n).padStart(2, '0')

/** Date -> YYYY-MM-DD（本地） */
function toKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** YYYY-MM-DD -> Date（本地零点），非法返回 null */
function fromKey(key: string): Date | null {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** 触发按钮上的区间文案 */
function formatRangeLabel(start: string, end: string, placeholder: string) {
  if (!start && !end) return placeholder
  if (start && end && start !== end) return `${start} ~ ${end}`
  return start || end
}

export default function DateRangePicker({ start, end, onChange, className, placeholder = '选择日期' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  // 选择过程中的临时起点（已选起点、待选终点）
  const [pendingStart, setPendingStart] = useState<string | null>(null)
  // 当前显示的月份（以该月 1 号表示）
  const [viewMonth, setViewMonth] = useState<Date>(() => fromKey(start) ?? new Date())
  // 弹层的 fixed 定位坐标（相对视口），通过 portal 渲染避免被祖先 overflow 裁剪
  const [panelPos, setPanelPos] = useState<{ left: number; top: number; placement: 'bottom' | 'top' }>({ left: 0, top: 0, placement: 'bottom' })
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // 根据触发器在视口中的位置计算弹层坐标（右对齐、空间不足则上翻）
  const updatePanelPos = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const margin = 8
    const availableBelow = window.innerHeight - rect.bottom - margin
    const placement: 'bottom' | 'top' = availableBelow < PANEL_HEIGHT && rect.top - margin > availableBelow ? 'top' : 'bottom'
    // 右对齐触发器，限制在视口内
    let left = rect.right - PANEL_WIDTH
    left = Math.max(margin, Math.min(left, window.innerWidth - PANEL_WIDTH - margin))
    const top = placement === 'bottom' ? rect.bottom + margin : rect.top - margin - PANEL_HEIGHT
    setPanelPos({ left, top: Math.max(margin, top), placement })
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setIsOpen(false)
      setPendingStart(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 打开时定位到已选起点所在月份并计算坐标；滚动/缩放时跟随
  useEffect(() => {
    if (!isOpen) return
    setViewMonth(fromKey(start) ?? new Date())
    updatePanelPos()
    const onScrollResize = () => updatePanelPos()
    window.addEventListener('resize', onScrollResize)
    window.addEventListener('scroll', onScrollResize, true)
    return () => {
      window.removeEventListener('resize', onScrollResize)
      window.removeEventListener('scroll', onScrollResize, true)
    }
  }, [isOpen, start])

  const handleDayClick = (key: string) => {
    if (!pendingStart) {
      // 第一次点击：设起点，等待终点
      setPendingStart(key)
      onChange(key, key)
      return
    }
    // 第二次点击：确定区间（自动排序），关闭
    const a = pendingStart
    const b = key
    const [s, e] = a <= b ? [a, b] : [b, a]
    onChange(s, e)
    setPendingStart(null)
    setIsOpen(false)
  }

  const goMonth = (delta: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const setToday = () => {
    const key = toKey(new Date())
    onChange(key, key)
    setPendingStart(null)
    setIsOpen(false)
  }

  // 计算当月日历格子（含前置空格）
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<string | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toKey(new Date(year, month, d)))

  // 高亮区间：选择中以 pendingStart 为单点，否则用已确认的 start~end
  const rangeStart = pendingStart ?? start
  const rangeEnd = pendingStart ? pendingStart : end
  const todayKey = toKey(new Date())

  const inRange = (key: string) => rangeStart && rangeEnd && key >= rangeStart && key <= rangeEnd

  return (
    <div ref={containerRef} className="relative">
      <div
        ref={triggerRef}
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center justify-between gap-1 cursor-pointer select-none ${className ?? ''}`}
      >
        <span className={`truncate ${start || end ? '' : 'text-gray-400 dark:text-gray-500'}`}>
          {formatRangeLabel(start, end, placeholder)}
        </span>
        <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', left: panelPos.left, top: panelPos.top, width: PANEL_WIDTH }}
          className={`z-[120] rounded-xl border border-gray-200/60 bg-white/95 p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-gray-900/95 dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] dark:ring-white/10 ${
            panelPos.placement === 'top' ? 'animate-dropdown-up' : 'animate-dropdown-down'
          }`}
        >
          {/* 月份导航 */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{year} 年 {month + 1} 月</span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          {/* 星期表头 */}
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEK_LABELS.map((label) => (
              <div key={label} className="flex h-7 items-center justify-center text-[11px] font-medium text-gray-400 dark:text-gray-500">{label}</div>
            ))}
          </div>

          {/* 日期格子 */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((key, idx) => {
              if (!key) return <div key={`empty-${idx}`} className="h-8" />
              const isEdge = key === rangeStart || key === rangeEnd
              const within = inRange(key)
              const isToday = key === todayKey
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDayClick(key)}
                  className={`flex h-8 items-center justify-center rounded-lg text-xs transition ${
                    isEdge
                      ? 'bg-blue-500 font-semibold text-white hover:bg-blue-600'
                      : within
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]'
                  } ${isToday && !isEdge ? 'ring-1 ring-inset ring-blue-400/60' : ''}`}
                >
                  {Number(key.slice(-2))}
                </button>
              )
            })}
          </div>

          {/* 底部操作 */}
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-white/[0.06]">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {pendingStart ? '请选择结束日期' : '点选起止日期'}
            </span>
            <button
              type="button"
              onClick={setToday}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
            >
              今天
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
