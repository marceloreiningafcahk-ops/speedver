import type { AppSettings } from '../../types'
import Select from '../Select'
import { Checkbox } from '../Checkbox'

interface SelectOption {
  label: string
  value: string
}

interface TemplateSettingsTabProps {
  draft: AppSettings
  templateProfileOptions: SelectOption[]
  commitSettings: (nextDraft: AppSettings) => void
  exportGroupOptions: SelectOption[]
  selectedExportGroups: string[]
  onToggleExportGroup: (value: string) => void
  onExportTemplates: () => void
  onImportTemplates: () => void
  onClearTemplates: () => void
  isImportingTemplates: boolean
}

export default function TemplateSettingsTab({
  draft,
  templateProfileOptions,
  commitSettings,
  exportGroupOptions,
  selectedExportGroups,
  onToggleExportGroup,
  onExportTemplates,
  onImportTemplates,
  onClearTemplates,
  isImportingTemplates,
}: TemplateSettingsTabProps) {
  const hasGroups = exportGroupOptions.length > 0
  const noneSelected = selectedExportGroups.length === 0
  return (
    <div className="space-y-5">
      {/* 功能1：模板生图默认 API 配置 */}
      <div className="block">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="block text-sm text-gray-600 dark:text-gray-300">默认生图 API 配置</span>
          <div className="w-44 shrink-0">
            <Select
              value={draft.templateApiProfileId ?? ''}
              onChange={(value) => commitSettings({ ...draft, templateApiProfileId: value ? String(value) : null })}
              options={[{ label: '跟随当前激活配置', value: '' }, ...templateProfileOptions]}
              className="w-full px-3 py-1.5 rounded-xl border border-gray-200/60 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06] text-xs transition-all duration-200 shadow-sm text-gray-700 dark:text-gray-200 outline-none"
            />
          </div>
        </div>
        <div data-selectable-text className="text-xs text-gray-500 dark:text-gray-500">
          批量套用模板生成图片时默认使用的 API 配置。选择「跟随当前激活配置」则与生图模式一致。
        </div>
      </div>

      {/* 功能2：导出模板（可多选分组） */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02] space-y-3 shadow-sm">
        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">导出模板</h4>
        <div data-selectable-text className="text-xs leading-relaxed text-gray-500 dark:text-gray-500">
          导出模板（含参考图、可替换图位、封面、名称、颜色），不影响普通任务。勾选要导出的模板组（可多选）；不勾选则导出全部模板。
        </div>
        {hasGroups && (
          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            {exportGroupOptions.map((opt) => (
              <Checkbox
                key={opt.value}
                checked={selectedExportGroups.includes(opt.value)}
                onChange={() => onToggleExportGroup(opt.value)}
                label={opt.label}
              />
            ))}
          </div>
        )}
        <button
          onClick={onExportTemplates}
          className="w-full rounded-xl bg-gray-100/80 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-200 hover:text-gray-900 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1] dark:hover:text-white"
        >
          {noneSelected ? '导出全部模板' : `导出选中的 ${selectedExportGroups.length} 个分组`}
        </button>
      </div>

      {/* 功能3：导入模板 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02] space-y-3 shadow-sm">
        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">导入模板</h4>
        <div data-selectable-text className="text-xs leading-relaxed text-gray-500 dark:text-gray-500">
          可一次选择多个模板 ZIP 导入，每个 ZIP 会各自建一个文件夹收纳，与其他来源分开。
        </div>
        <button
          onClick={onImportTemplates}
          disabled={isImportingTemplates}
          className="w-full rounded-xl bg-gray-100/80 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1] dark:hover:text-white flex items-center justify-center gap-2"
        >
          {isImportingTemplates ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              导入中...
            </>
          ) : (
            '从 ZIP 导入模板'
          )}
        </button>
      </div>

      {/* 功能4：清除全部模板 */}
      <div className="rounded-2xl border border-red-100/50 bg-red-50/30 p-4 dark:border-red-500/10 dark:bg-red-500/5 space-y-3 shadow-sm">
        <h4 className="text-sm font-bold text-red-500/90 dark:text-red-400">清除全部模板</h4>
        <div data-selectable-text className="text-xs leading-relaxed text-gray-500 dark:text-gray-500">
          删除所有模板及其专属参考图 / 封面图，不影响生图模式的普通任务与图片。此操作不可恢复，建议先导出备份。
        </div>
        <button
          onClick={onClearTemplates}
          className="w-full rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-2.5 text-sm font-medium text-red-500 transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:border-red-500/15 dark:bg-red-500/5 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:border-red-500/30 dark:hover:text-red-300"
        >
          清除全部模板
        </button>
      </div>
    </div>
  )
}
