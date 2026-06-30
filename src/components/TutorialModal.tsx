import { useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { CURRENT_TUTORIAL_VERSION, type TutorialTopic, useStore } from '../store'
import { getActiveApiProfile, validateApiProfile } from '../lib/apiProfiles'
import type { AppMode } from '../types'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { CloseIcon, HelpCircleIcon } from './icons'

const MODE_TOPIC: Partial<Record<AppMode, TutorialTopic>> = {
  gallery: 'gallery',
  batch: 'batch',
  template: 'template',
}

const TOPIC_LABEL: Record<TutorialTopic, string> = {
  api: '导入 API 使用配置',
  gallery: '生图模式教程',
  batch: '批量模式教程',
  template: '模板模式教程',
}

interface TourStep {
  title: string
  body: string
  selector: string
  mode?: AppMode
  settingsTab?: 'api'
  points?: string[]
  action?: 'focus' | 'sample'
  nextLabel?: string
  allowTargetInteraction?: boolean
}

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
}

const API_STEPS: TourStep[] = [
  {
    title: '先导入 API 配置压缩包',
    body: '第一次使用建议先点这里导入配置 ZIP。这个入口只导入 API 配置，不会把历史任务或图片导进来。',
    selector: '[data-tour="api-config-import"]',
    settingsTab: 'api',
    allowTargetInteraction: true,
    points: [
      '有压缩包：点击高亮区域里的“从 ZIP 导入配置”。',
      '没有压缩包：点说明卡里的“没有压缩包，先跳过”。',
      '跳过后仍可进入网站，真正提交生图时会继续提示完善 API。',
    ],
    nextLabel: '已了解配置导入',
  },
]

const GALLERY_STEPS: TourStep[] = [
  {
    title: '在这里填写提示词',
    body: '生图模式的核心输入区在页面底部。把你想生成的画面、商品、风格、构图和限制条件写在这里。',
    selector: '[data-tour="gallery-prompt"]',
    mode: 'gallery',
    action: 'focus',
    points: ['可以输入 @ 引用参考图。', '写得越具体，结果越稳定。'],
  },
  {
    title: '需要参考图就从这里导入',
    body: '点击这个回形针按钮可以上传参考图；也可以直接把图片粘贴到输入区。',
    selector: '[data-tour="gallery-upload"]',
    mode: 'gallery',
    points: ['参考图会按图一、图二的顺序进入请求。', '需要局部重绘时，可对参考图添加遮罩。'],
  },
  {
    title: '点击这里开始生图',
    body: '提示词准备好后点击这个按钮提交任务。教程不会真的调用 API，也不会消耗额度。',
    selector: '[data-tour="gallery-submit"]',
    mode: 'gallery',
    points: ['如果 API 没配置，按钮会带你去设置页。', '提交后任务会出现在上方的任务列表。'],
  },
  {
    title: '生成结果会像这样出现在任务区',
    body: '这里放了一张内置示例卡片，只演示完成后的呈现位置和卡片状态，不会创建真实任务。',
    selector: '[data-tour="gallery-sample-card"]',
    mode: 'gallery',
    action: 'sample',
    points: ['真实生成成功后，结果会进入生图模式历史列表。', '可以点开详情、下载图片、复用配置，或继续编辑输出。'],
    nextLabel: '完成生图教程',
  },
]

const BATCH_STEPS: TourStep[] = [
  {
    title: '左侧是批量通用设置',
    body: '通用提示词和通用参考图会应用到右侧所有任务，适合统一风格、统一背景或统一商品模板。',
    selector: '[data-tour="batch-common-settings"]',
    mode: 'batch',
    points: ['鼠标在左侧时粘贴图片，会进入通用参考图。', '通用提示词会和每个任务自己的提示词合并。'],
  },
  {
    title: '通用参考图从这里导入',
    body: '点击这个加号上传一张或多张通用参考图。第一张会作为图一，超过一张会顺延成图二、图三。',
    selector: '[data-tour="batch-common-upload"]',
    mode: 'batch',
    points: ['通用参考图会排在每个任务参考图最前面。', '每个任务卡前的占位会提示通用图位。'],
  },
  {
    title: '右侧导入任务图片',
    body: '在这里拖入、粘贴或点击多任务拆图导入图片，每张图片会变成一个任务卡。',
    selector: '[data-tour="batch-dropzone"], [data-tour="batch-split-upload"]',
    mode: 'batch',
    points: ['鼠标在右侧任务列表时粘贴图片，会生成任务。', '任务卡可以单独补充提示词和追加图片。'],
  },
  {
    title: '每个任务可以单独调整',
    body: '任务卡里可以写当前图片的额外提示词，也可以继续添加只属于这个任务的参考图。',
    selector: '[data-tour="batch-task-card"]',
    mode: 'batch',
    points: ['任务自己的图片不会影响其他任务。', '没有单独提示词时，会只使用通用提示词。'],
  },
  {
    title: '最后批量提交',
    body: '确认任务数量和提示词后点提交。提交后会进入生图模式画廊和历史记录。',
    selector: '[data-tour="batch-submit"]',
    mode: 'batch',
    nextLabel: '完成批量教程',
  },
]

const TEMPLATE_STEPS: TourStep[] = [
  {
    title: '先写模板提示词',
    body: '模板也是从生图输入区开始准备的。先把固定不变的画面要求、风格、构图、商品位说明写进提示词。',
    selector: '[data-tour="gallery-prompt"]',
    mode: 'gallery',
    action: 'focus',
    points: ['这里写的是以后每次套模板都会复用的固定部分。', '需要被替换的内容可以写成“把图一产品放入这个场景”这类明确描述。'],
  },
  {
    title: '再放入模板参考图',
    body: '参考图决定模板的基础结构。比如场景图、版式图、产品摆放示例，都先从这里上传或粘贴进来。',
    selector: '[data-tour="gallery-upload"]',
    mode: 'gallery',
    points: ['保存模板时可以把其中一张或多张参考图设为替换图。', '没有参考图也能保存模板，但多图替换教程需要先准备参考图。'],
  },
  {
    title: '准备好后保存为模板',
    body: '提示词和参考图都准备好之后，再点这个按钮保存模板。教程里点击高亮区域不会真的打开保存弹窗，避免误操作。',
    selector: '[data-tour="template-save-button"]',
    mode: 'gallery',
    points: ['保存时可以选择一张或多张参考图作为替换图。', '替换图位决定以后批量套用时需要上传几个框。'],
  },
  {
    title: '模板会集中显示在模板模式',
    body: '切到模板模式后，你会在这里看到所有模板。可以框选、多选、改名、改色、改封面和管理分组。',
    selector: '[data-tour="template-workspace"]',
    mode: 'template',
    points: ['如果这里还是空的，先回生图模式保存一个模板。', '导入的模板会按压缩包分组，方便管理。'],
  },
  {
    title: '选择模板后批量套用',
    body: '选中模板后底部会出现批量套用按钮。单替换位模板显示一个上传框，多替换位模板会显示多个上传框。',
    selector: '[data-tour="template-apply-button"], [data-tour="template-workspace"]',
    mode: 'template',
    points: ['套用后会创建普通生图任务。', '导出、历史和下载逻辑都沿用生图模式。'],
    nextLabel: '完成模板教程',
  },
]

function getTopicSteps(topic: TutorialTopic): TourStep[] {
  if (topic === 'api') return API_STEPS
  if (topic === 'batch') return BATCH_STEPS
  if (topic === 'template') return TEMPLATE_STEPS
  return GALLERY_STEPS
}

function getVisibleTarget(selector: string): HTMLElement | null {
  const selectors = selector.split(',').map((part) => part.trim()).filter(Boolean)
  for (const selectorPart of selectors) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selectorPart))
    const target = elements.find((element) => {
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    })
    if (target) return target
  }
  return null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getRect(element: HTMLElement | null): SpotlightRect | null {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  const padding = 10
  const top = clamp(rect.top - padding, 8, window.innerHeight - 24)
  const left = clamp(rect.left - padding, 8, window.innerWidth - 24)
  return {
    top,
    left,
    width: Math.min(rect.width + padding * 2, window.innerWidth - left - 8),
    height: Math.min(rect.height + padding * 2, window.innerHeight - top - 8),
  }
}

function rectsOverlap(
  first: { top: number; left: number; width: number; height: number },
  second: { top: number; left: number; width: number; height: number },
) {
  return (
    first.left < second.left + second.width &&
    first.left + first.width > second.left &&
    first.top < second.top + second.height &&
    first.top + first.height > second.top
  )
}

function getFloatingCardStyle(spotlightRect: SpotlightRect | null, pointCount: number): CSSProperties {
  const margin = 16
  const gap = 18
  const width = Math.min(360, window.innerWidth - margin * 2)
  const estimatedHeight = clamp(210 + pointCount * 22, 240, Math.min(360, window.innerHeight - margin * 2))
  const fallbackLeft = Math.max(margin, (window.innerWidth - width) / 2)
  const fallbackTop = Math.max(margin, window.innerHeight / 2 - estimatedHeight / 2)
  const maxHeight = window.innerHeight - margin * 2

  if (!spotlightRect) {
    return { top: fallbackTop, left: fallbackLeft, width, maxHeight }
  }

  const centeredLeft = clamp(
    spotlightRect.left + spotlightRect.width / 2 - width / 2,
    margin,
    window.innerWidth - width - margin,
  )
  const sideTop = clamp(
    spotlightRect.top + spotlightRect.height / 2 - estimatedHeight / 2,
    margin,
    window.innerHeight - estimatedHeight - margin,
  )
  const candidates = [
    { left: spotlightRect.left + spotlightRect.width + gap, top: sideTop },
    { left: spotlightRect.left - width - gap, top: sideTop },
    { left: centeredLeft, top: spotlightRect.top + spotlightRect.height + gap },
    { left: centeredLeft, top: spotlightRect.top - estimatedHeight - gap },
    { left: margin, top: margin },
    { left: window.innerWidth - width - margin, top: margin },
    { left: margin, top: window.innerHeight - estimatedHeight - margin },
    { left: window.innerWidth - width - margin, top: window.innerHeight - estimatedHeight - margin },
  ]

  const scoredCandidates = candidates.map((candidate) => {
    const left = clamp(candidate.left, margin, window.innerWidth - width - margin)
    const top = clamp(candidate.top, margin, window.innerHeight - estimatedHeight - margin)
    const cardRect = { left, top, width, height: estimatedHeight }
    const overlapsTarget = rectsOverlap(cardRect, spotlightRect)
    const distanceFromTarget = Math.hypot(
      left + width / 2 - (spotlightRect.left + spotlightRect.width / 2),
      top + estimatedHeight / 2 - (spotlightRect.top + spotlightRect.height / 2),
    )
    return { left, top, overlapsTarget, distanceFromTarget }
  })

  const best = scoredCandidates
    .sort((a, b) => Number(a.overlapsTarget) - Number(b.overlapsTarget) || a.distanceFromTarget - b.distanceFromTarget)[0]

  return { top: best.top, left: best.left, width, maxHeight }
}

function isApiProfileReady() {
  const settings = useStore.getState().settings
  return validateApiProfile(getActiveApiProfile(settings)) == null
}

function SampleResultCard() {
  return (
    <div
      data-tour="gallery-sample-card"
      data-no-drag-select
      className="fixed left-1/2 top-[124px] z-[121] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900"
    >
      <div className="flex h-40">
        <div className="relative h-full w-40 min-w-[10rem] overflow-hidden bg-[#f8d9d2]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_28%,rgba(255,255,255,0.8)_0,rgba(255,255,255,0.8)_11%,transparent_12%),linear-gradient(135deg,#fca5a5_0%,#ef4444_48%,#7f1d1d_100%)]" />
          <div className="absolute left-8 top-12 h-12 w-24 rounded-md bg-red-700 shadow-lg" />
          <div className="absolute left-14 top-9 h-8 w-28 rounded-md bg-red-500 shadow-md" />
          <div className="absolute bottom-5 left-12 h-9 w-20 rounded-full bg-rose-900/80 shadow-xl" />
          <div className="absolute left-1.5 top-1.5 flex gap-1">
            <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white">1:1</span>
            <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white">4096x4096</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-3">
          <p className="line-clamp-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            示例：红色礼盒与拖鞋的产品图，柔和摄影光线，干净背景，节日促销氛围。
          </p>
          <div className="mt-auto space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-600 dark:bg-green-500/10 dark:text-green-300">完成</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">示例卡片</span>
            </div>
            <div className="flex justify-end gap-1 text-gray-400">
              <span className="h-6 w-6 rounded-md bg-gray-100 dark:bg-white/[0.06]" />
              <span className="h-6 w-6 rounded-md bg-gray-100 dark:bg-white/[0.06]" />
              <span className="h-6 w-6 rounded-md bg-gray-100 dark:bg-white/[0.06]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function shouldOpenTutorialForMode(mode: AppMode, seenModes: Partial<Record<TutorialTopic, number>>) {
  const topic = MODE_TOPIC[mode]
  return topic && (seenModes[topic] ?? 0) < CURRENT_TUTORIAL_VERSION ? topic : null
}

export default function TutorialModal() {
  const topic = useStore((s) => s.tutorialTopic)
  const appMode = useStore((s) => s.appMode)
  const settings = useStore((s) => s.settings)
  const setAppMode = useStore((s) => s.setAppMode)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setOnboardingApiConfigReady = useStore((s) => s.setOnboardingApiConfigReady)
  const closeTutorial = useStore((s) => s.closeTutorial)
  const showToast = useStore((s) => s.showToast)
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const [targetMissing, setTargetMissing] = useState(false)
  const apiWasReadyOnOpenRef = useRef(false)

  const steps = useMemo(() => topic ? getTopicSteps(topic) : [], [topic])
  const step = steps[stepIndex]

  const completeTutorial = () => {
    if (topic === 'api') {
      setOnboardingApiConfigReady(true)
      setShowSettings(false)
    }
    closeTutorial({ markSeen: true })
  }

  useCloseOnEscape(Boolean(topic), completeTutorial)

  useEffect(() => {
    setStepIndex(0)
    apiWasReadyOnOpenRef.current = topic === 'api' ? isApiProfileReady() : false
  }, [topic])

  useEffect(() => {
    if (!topic || !step) return
    if (step.settingsTab) setShowSettings(true, step.settingsTab)
    if (step.mode) {
      setShowSettings(false)
      if (appMode !== step.mode) setAppMode(step.mode)
    }
  }, [appMode, setAppMode, setShowSettings, step, topic])

  useEffect(() => {
    if (topic !== 'api') return
    if (apiWasReadyOnOpenRef.current) return
    if (!isApiProfileReady()) return
    setOnboardingApiConfigReady(true)
    setShowSettings(false)
    closeTutorial({ markSeen: true })
    showToast('API 使用配置已完成', 'success')
  }, [closeTutorial, setOnboardingApiConfigReady, setShowSettings, settings, showToast, topic])

  useEffect(() => {
    if (!topic || !step) return
    let frame = 0
    let timer: number | null = null

    const updateRect = () => {
      frame = window.requestAnimationFrame(() => {
        const nextTarget = getVisibleTarget(step.selector)
        const nextRect = getRect(nextTarget)
        setSpotlightRect(nextRect)
        setTargetMissing(!nextRect)
        if (step.action === 'focus' && nextTarget) nextTarget.focus({ preventScroll: true })
      })
    }

    const scrollToTarget = () => {
      const target = getVisibleTarget(step.selector)
      if (target) {
        target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      }
      updateRect()
    }

    scrollToTarget()
    timer = window.setTimeout(scrollToTarget, 350)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.cancelAnimationFrame(frame)
      if (timer != null) window.clearTimeout(timer)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [step, topic])

  if (!topic || !step) return null

  const skipApi = () => {
    setOnboardingApiConfigReady(true)
    setShowSettings(false)
    closeTutorial({ markSeen: true })
    showToast('已跳过 API 配置导入，可稍后在设置中补充', 'info')
  }
  const next = () => {
    if (topic === 'api' && stepIndex >= steps.length - 1 && !isApiProfileReady()) {
      skipApi()
      return
    }
    if (stepIndex >= steps.length - 1) completeTutorial()
    else setStepIndex((index) => index + 1)
  }
  const previous = () => setStepIndex((index) => Math.max(0, index - 1))
  const blockTargetInteraction = !step.allowTargetInteraction
  const stopTargetInteraction = (event: SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const cardStyle = getFloatingCardStyle(spotlightRect, step.points?.length ?? 0)

  const overlay = spotlightRect ? (
    <>
      <div className="fixed left-0 right-0 top-0 z-[120] bg-black/70 backdrop-blur-[1px]" style={{ height: spotlightRect.top }} />
      <div className="fixed left-0 right-0 z-[120] bg-black/70 backdrop-blur-[1px]" style={{ top: spotlightRect.top + spotlightRect.height, bottom: 0 }} />
      <div className="fixed left-0 z-[120] bg-black/70 backdrop-blur-[1px]" style={{ top: spotlightRect.top, width: spotlightRect.left, height: spotlightRect.height }} />
      <div className="fixed right-0 z-[120] bg-black/70 backdrop-blur-[1px]" style={{ top: spotlightRect.top, left: spotlightRect.left + spotlightRect.width, height: spotlightRect.height }} />
      <div
        className="pointer-events-none fixed z-[121] rounded-2xl border-2 border-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.25),0_0_32px_rgba(59,130,246,0.55)]"
        style={spotlightRect}
      />
      {blockTargetInteraction && (
        <div
          className="fixed z-[121] rounded-2xl"
          style={spotlightRect}
          aria-hidden="true"
          onClickCapture={stopTargetInteraction}
          onDoubleClickCapture={stopTargetInteraction}
          onMouseDownCapture={stopTargetInteraction}
          onPointerDownCapture={stopTargetInteraction}
          onTouchStartCapture={stopTargetInteraction}
        />
      )}
    </>
  ) : (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-[1px]" />
  )

  return createPortal(
    <>
      {step.action === 'sample' && <SampleResultCard />}
      {overlay}
      <div
        data-no-drag-select
        className="fixed z-[122] w-full overflow-y-auto rounded-2xl border border-white/15 bg-gray-900/95 p-4 text-gray-100 shadow-2xl ring-1 ring-black/40"
        style={cardStyle}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-blue-300">
              <HelpCircleIcon className="h-4 w-4" />
              {TOPIC_LABEL[topic]} · 第 {stepIndex + 1} / {steps.length} 步
            </div>
            <h3 className="text-base font-semibold text-white">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={completeTutorial}
            className="rounded-full p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="关闭教程"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm leading-6 text-gray-300">{step.body}</p>
        {step.points && (
          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-gray-300">
            {step.points.map((point) => (
              <li key={point} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
        {targetMissing && (
          <div className="mt-3 rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-100">
            当前目标区域暂时没有出现。教程已自动切换页面；如果仍未出现，请确认页面加载完成。
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={previous}
            disabled={stepIndex === 0}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一步
          </button>
          <div className="flex gap-1">
            {steps.map((item, index) => (
              <span key={item.title} className={`h-1.5 w-5 rounded-full ${index === stepIndex ? 'bg-blue-400' : 'bg-white/20'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {topic === 'api' ? (
              <button
                type="button"
                onClick={skipApi}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/10"
              >
                没有压缩包，先跳过
              </button>
            ) : (
              <button
                type="button"
                onClick={completeTutorial}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/10"
              >
                跳过教程
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-xl bg-blue-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600"
            >
              {stepIndex === steps.length - 1 ? (step.nextLabel ?? '完成') : (step.nextLabel ?? '下一步')}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
