# 项目交接文档：gpt-image-playground

> 面向下一位接手开发的 AI Agent。请先读本文件，再读 `AGENTS.md`、`README.md` 和 `docs/template-mode-refactor-plan.md`。当前项目是用户 fork 后的二次开发版本，主要推送目标是 GitHub remote `speedver`：`https://github.com/marceloreiningafcahk-ops/speedver.git`。

## 1. 项目概况

- 类型：纯前端单页应用，AI 图片生成 Playground。
- 技术栈：React 19 + Vite 6 + TypeScript 5.8 + Zustand 5 + Tailwind 3。
- 数据：全部在浏览器本地保存。设置和任务元数据走 Zustand persist，图片 data URL/缩略图走 IndexedDB，核心封装在 `src/lib/db.ts`。
- 包管理：npm，有 `package-lock.json`，不要改用 yarn/pnpm。
- 当前版本：`package.json` 里是 `0.6.10`。
- 当前主分支：`main`，跟踪 `speedver/main`。

常用命令：

| 操作 | 命令 |
| --- | --- |
| 安装依赖 | `npm install` |
| 开发服务 | `npm run dev` |
| 构建和类型检查 | `npm run build` |
| 测试 | `npm test` |
| 监听测试 | `npm run test:watch` |

改完代码后至少跑：

```bash
npm run build
npm test
```

本轮最后验证结果：`npm run build` 通过，`npm test` 通过，19 个测试文件、235 个测试用例。

## 2. 功能模式和现状

应用用 `appMode` 切换主要体验：

- 生图模式：`gallery`。普通图片生成、参考图输入、任务列表和详情。
- 批量模式：当前在 UI 上独立呈现，但仍复用生图任务提交/导出逻辑。批量模式的通用参考图作为图一，超过一张时顺延为图二/图三；右侧任务卡使用和生图模式一致的卡片排列。
- 模板模式：`template`。模板保存、模板组、批量套用、导入导出模板。
- 收藏夹：独立入口，代码在 `src/components/favorites/`。
- Agent：代码仍保留用于兼容历史数据，但主入口已隐藏；筛选和设置里的 Agent 专属项也已隐藏。不要删除 Agent 相关代码，除非用户明确要求迁移或清理。

## 3. 关键文件地图

| 文件 | 职责 |
| --- | --- |
| `src/store.ts` | 核心 Zustand store、任务动作、导入导出、模板套用、批量和输入图逻辑。文件很大，新工具函数尽量放到 `src/lib/`。 |
| `src/types.ts` | 共享类型：`TaskRecord`、`InputImage`、`MaskDraft`、`AppSettings`、API profile 等。 |
| `src/lib/db.ts` | IndexedDB 读写。改 schema 要升 `DB_VERSION` 并写迁移。 |
| `src/lib/apiProfiles.ts` | API profile、自定义服务商、导入合并/覆盖逻辑。 |
| `src/lib/exportZip.ts` | ZIP 数据导入导出底层工具。 |
| `src/lib/promptImageMentions.ts` | `@图一/@图二` 这种提示词图片引用的重排和替换。现在优先按 `slotId` 跟踪重复图片槽位。 |
| `src/lib/maskPreprocess.ts` | 蒙版编辑前处理和目标图替换。现在支持按 `slotId` 只替换重复图片中的目标槽位。 |
| `src/components/InputBar.tsx` | 生图模式底部输入区：提示词、参考图、粘贴/拖拽、多图导入进度、蒙版入口。 |
| `src/components/BatchWorkspace.tsx` | 批量模式 UI：通用设置、通用参考图、任务导入、任务卡、清空全部任务等。 |
| `src/components/TemplateWorkspace.tsx` | 模板模式主 UI：模板组、导入模板、清空模板、备注、编辑模板字段等。 |
| `src/components/SaveTemplateModal.tsx` | 从当前输入保存模板，支持多替换图位和提示词局部替换。 |
| `src/components/TemplateApplyModal.tsx` | 批量套用模板，支持单图/多图上传、提示词替换输入。 |
| `src/components/SettingsModal.tsx` | 设置弹窗。API 配置、习惯配置、模板管理、数据管理等 tab 在这里。 |
| `src/components/TutorialModal.tsx` | 新手教程/聚光灯引导。首次 API 配置引导和各模式教程都在这里。 |
| `README.md` | 面向开发者和用户的项目说明，已补充主要功能和文件地图。 |

## 4. 本轮已完成的重点修改

### API 配置导入覆盖

- API ZIP 导入不再追加旧 API，而是覆盖 API 相关配置。
- 覆盖范围：`profiles`、`customProviders`、`providerOrder`、`activeProfileId`，以及依赖 API profile 的模板/Agent 默认配置。
- 保留范围：教程状态、输入习惯、下载路线等非 API 偏好。
- 主要实现：`replaceImportedApiSettings()` in `src/lib/apiProfiles.ts`，`importData()` in `src/store.ts`。
- 测试：`src/lib/apiProfiles.test.ts`。

### 模板导出内存优化

- `exportTemplates()` 不再 `getAllImages()` 后过滤。
- 现在先收集模板实际引用的 `inputImageIds` / `templateCoverImageId`，再逐个 `getImage(id)` 和 `getImageThumbnail(id)`。
- ZIP manifest 结构保持兼容，旧导入逻辑不用改。
- 导出失败 toast 会提示可尝试按模板组分批导出。

### 模板提示词局部替换

- `TaskRecord` 新增 `templatePromptReplacement?: { start; end; originalText }`。
- 保存模板时，用户可以在完整提示词里选中一段，点击“设为提示词替换”。
- 套用模板时，只有设置了替换段的模板才显示提示词替换 UI。
- 用户不填替换文本时保留原提示词；填写后只替换高亮段。
- 第一版只支持每个模板一个替换段，避免多模板混选时弹窗过复杂。
- 主要实现：
  - `src/components/SaveTemplateModal.tsx`
  - `src/components/TemplateApplyModal.tsx`
  - `getTemplatePromptReplacement()` / `applyTemplatePromptReplacement()` in `src/store.ts`

### 模板组备注

- `TaskRecord` 新增 `templateCollectionNote?: string`。
- 模板组标题旁有备注按钮，可编辑备注；鼠标悬停组标题/备注图标可查看备注。
- 修改备注会同步更新同组所有模板；导入导出模板时备注随模板保留。
- 未分组模板也支持备注，写入未分组模板记录。
- 主要实现：`src/components/TemplateWorkspace.tsx`、`updateTemplateCollectionNote()` in `src/store.ts`。

### 生图模式重复粘贴同一张图片

- `InputImage` 新增 `slotId`，UI 层参考图按槽位处理，同一张底层图片 id 可以重复出现。
- IndexedDB 图片内容仍按 hash 去重；重复的是输入区的参考图槽位。
- 粘贴、拖拽、多图导入、删除、替换、排序、`@图一/@图二` 重排都改为槽位优先。
- React key 不再只用图片 id，避免同 id 图片只渲染一个或删错。
- 蒙版目标也支持 `targetSlotId`，重复图片时只替换/删除目标槽位，不影响另一个相同图片槽位。
- 主要实现：
  - `src/types.ts`
  - `src/store.ts`
  - `src/components/InputBar.tsx`
  - `src/components/MaskEditorModal.tsx`
  - `src/lib/promptImageMentions.ts`
  - `src/lib/maskPreprocess.ts`

### 批量模式近期改动

- 通用参考图全部按图一开始顺延，超过一张时变成图二/图三。
- 批量任务卡改为和生图模式一致的卡片排列。
- 模型可以选择和修改，但模型 ID 不在批量生图模式直接显示，避免用户误改。
- 恢复“多任务拆图”按钮。
- 删除“添加任务”、左下角审核和透明背景选项。
- 鼠标在左侧通用设置时粘贴/拖拽添加通用参考图；在右侧任务列表时粘贴/拖拽添加任务。
- 增加清空全部任务。
- 上传多图作为任务时有 loading/进度框，避免用户误以为页面卡住。

### 模板模式近期改动

- 没有模板时增加“导入模板”按钮。
- 模板导入使用和批量/生图多图导入一致风格的进度条。
- 导入模板旁增加“一键清空模板”红色按钮。
- 建立模板时支持选择多张参考图作为替换图。
- 选择模板时，如果单替换图模板和多替换图模板混选，会打开上传页面，分别展示单张参考图上传和多张参考图上传槽。
- 图二里 Agent 分类已隐藏；图一设置里的 Agent 专属配置也已隐藏。

### 新手教程和首次 API 配置

- 第一次打开网站会强制进入 API 使用配置引导，要求导入 API 配置 ZIP；没有压缩包可以跳过。
- 跳过只跳过教程/引导，不写入任何 API 配置。
- 设置里的“查看教程”可以重复打开教程。
- 生图教程只展示真实页面和虚假示例结果卡，不会真的调用 API 或创建真实任务。
- 批量教程说明如何导入图片、通用参考图、多张参考图区别。
- 模板教程先引导用户在生图模式填写提示词和参考图并保存模板，再切到模板模式介绍套用流程。
- API Key 输入框已改为避免浏览器弹保存密码弹窗的写法：视觉仍是密文，但 `autocomplete` 使用 `new-password`。

## 5. 数据模型新增字段

### `InputImage`

```ts
interface InputImage {
  id: string
  slotId?: string
  dataUrl: string
}
```

`id` 是 IndexedDB 图片 hash，`slotId` 是 UI 槽位。重复图片功能依赖 `slotId`，不要再用 `id` 当唯一 UI key。

### `MaskDraft`

```ts
interface MaskDraft {
  targetImageId: string
  targetSlotId?: string
  maskDataUrl: string
  updatedAt: number
}
```

旧数据没有 `targetSlotId` 时仍按 `targetImageId` 回退。

### `TaskRecord` 模板字段

```ts
templatePromptReplacement?: {
  start: number
  end: number
  originalText: string
}
templateCollectionNote?: string
```

`templatePromptReplacement` 必须用当前 prompt 校验：`prompt.slice(start, end) === originalText`，否则视为失效。

## 6. 测试覆盖

新增/调整过的重点测试：

- `src/lib/apiProfiles.test.ts`：API ZIP 覆盖导入。
- `src/store.test.ts`：模板提示词替换、模板组备注、重复 input image 槽位。
- `src/lib/promptImageMentions.test.ts`：重复图片槽位重排时 `@图X` 引用不串位。
- `src/lib/maskPreprocess.test.ts`：蒙版目标替换旧逻辑仍兼容。

本轮完成后已跑：

```bash
npm run build
npm test
```

结果：全部通过。

## 7. GitHub 和部署

Git remote：

```bash
origin    https://github.com/CookSleep/gpt_image_playground.git
batch-ver https://github.com/ywjzywn-coder/batch-ver.git
speedver  https://github.com/marceloreiningafcahk-ops/speedver.git
```

当前用户要求的新开发主要推送到 `speedver`。本地 `main` 已跟踪 `speedver/main`。

推荐同步命令：

```bash
git status -sb
npm run build
npm test
git add README.md docs/HANDOFF.md src
git commit -m "Improve template API import and duplicate image handling"
git push speedver main
```

注意：当前环境没有安装 GitHub CLI `gh`，所以不能用 `gh pr create`。如需 PR，需要先安装并登录 `gh`，或直接在 GitHub 网页创建。

## 8. EdgeOne 部署

- EdgeOne 项目配置：`.edgeone/project.json`
- 项目名：`image-playground`
- Project ID：`makers-ooaiz1b6xhvz`
- 构建产物：`dist/`
- 部署命令：

```bash
npm run build
npx edgeone makers deploy ./dist --name image-playground --env production --json
```

最近一次已知生产部署：2026-06-30，Deployment ID `dpqdqy3b3ep4`。

当前用户这次只要求同步 GitHub，没有要求部署 EdgeOne。

## 9. 安全记录

- 2026-06-30 已在提交 `e5b72bb` 移除曾误打包进 `vite.config.ts` 的本地默认 API 配置。
- 本轮提交前执行过敏感信息扫描，未发现真实 `sk-...` API Key 或 EdgeOne token。扫描命中的 `task-live` 等为测试里的假任务 id。
- 由于密钥曾进入 Git 历史和旧部署包，相关 API Key 仍应在服务商后台轮换。

## 10. 接手注意事项

- 不要把模板任务和普通生图任务混在同一个列表展示；普通任务列表要过滤 `kind === 'template'`。
- 不要删除 Agent 代码；当前只是隐藏入口和部分 UI。
- 新增持久化字段时一定要更新 `normalize*` 函数，保持旧 localStorage/IndexedDB 数据能恢复。
- 输入区参考图现在按槽位处理：任何 UI key、删除、拖拽、蒙版主图判断都要优先考虑 `slotId`。
- API 配置 ZIP 导入是覆盖式；普通 URL/剪贴板自定义服务商导入仍保留合并逻辑。
- 模板导出不要重新改回 `getAllImages()`，大图库会造成内存压力。
- UI 文案保持中文；代码风格跟随现有文件：2 空格、单引号、无分号。
