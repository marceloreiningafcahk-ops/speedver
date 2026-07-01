# 项目交接文档：gpt-image-playground

> 面向下一位接手开发的 AI Agent。请先读本文件，再读 `AGENTS.md`、`README.md` 和 `docs/template-mode-refactor-plan.md`。当前项目是用户 fork 后的二次开发版本，主要推送目标是 GitHub remote `speedver`：`https://github.com/marceloreiningafcahk-ops/speedver.git`。

## 1. 当前状态

- 项目类型：纯前端单页应用，AI 图片生成 Playground。
- 技术栈：React 19 + Vite 6 + TypeScript 5.8 + Zustand 5 + Tailwind 3。
- 包管理：npm，有 `package-lock.json`，不要改用 yarn/pnpm。
- 当前版本：`package.json` 里是 `0.6.10`。
- 当前主分支：`main`，跟踪 `speedver/main`。
- 最近一次功能提交：`e30e7db Improve template replacements and image exports`，已推送到 `speedver/main`。
- 最近一次 EdgeOne 生产部署：2026-07-01，Deployment ID `dph5b5qx7gso`。
- 当前线上地址：`https://image-playground-lkm5myrs.edgeone.cool/`。

本轮最后验证结果：

```bash
npm run build
npm test
```

结果：全部通过。测试为 20 个文件、241 个用例。Vite 构建仍有 chunk 大小超过 500 kB 的常规 warning，不影响产物。

## 2. 常用命令

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

## 3. 功能模式

应用用 `appMode` 切换主要体验：

- 生图模式：`gallery`。普通图片生成、参考图输入、任务列表和详情。
- 批量模式：独立 UI，但仍复用生图任务提交/导出逻辑。通用参考图作为图一，超过一张时顺延为图二/图三。
- 模板模式：`template`。模板保存、模板组、批量套用、导入导出模板。
- 收藏夹：独立入口，代码在 `src/components/favorites/`。
- Agent：代码仍保留用于兼容历史数据，但主入口已隐藏；筛选和设置里的 Agent 专属项也已隐藏。不要删除 Agent 相关代码，除非用户明确要求迁移或清理。

## 4. 关键文件地图

| 文件 | 职责 |
| --- | --- |
| `src/store.ts` | 核心 Zustand store、任务动作、导入导出、模板套用、批量和输入图逻辑。文件很大，新工具函数尽量放到 `src/lib/`。 |
| `src/types.ts` | 共享类型：`TaskRecord`、`InputImage`、`MaskDraft`、`AppSettings`、API profile 等。 |
| `src/lib/db.ts` | IndexedDB 读写。改 schema 要升 `DB_VERSION` 并写迁移。 |
| `src/lib/apiProfiles.ts` | API profile、自定义服务商、导入合并/覆盖逻辑。 |
| `src/lib/imageExport.ts` | 图片自定义导出、四宫格切分、裁切导出的核心算法。 |
| `src/lib/downloadImages.ts` | 多图片直接下载工具。四宫格导出使用它，不再打 zip。 |
| `src/lib/exportZip.ts` | ZIP 数据导入导出底层工具。 |
| `src/lib/promptImageMentions.ts` | `@图一/@图二` 这种提示词图片引用的重排和替换。现在优先按 `slotId` 跟踪重复图片槽位。 |
| `src/lib/maskPreprocess.ts` | 蒙版编辑前处理和目标图替换。现在支持按 `slotId` 只替换重复图片中的目标槽位。 |
| `src/components/DetailModal.tsx` | 生图任务详情弹窗。自定义导出、四宫格切分预览、裁切导出 UI 都在这里。 |
| `src/components/Header.tsx` | 顶部栏。原作者更新时的右上角 `NEW` 标记已移除。 |
| `src/components/InputBar.tsx` | 生图模式底部输入区：提示词、参考图、粘贴/拖拽、多图导入进度、蒙版入口。 |
| `src/components/BatchWorkspace.tsx` | 批量模式 UI：通用设置、通用参考图、任务导入、任务卡、清空全部任务等。 |
| `src/components/TemplateWorkspace.tsx` | 模板模式主 UI：模板组、导入模板、清空模板、模型入口、备注、编辑模板字段等。 |
| `src/components/SaveTemplateModal.tsx` | 从当前输入保存模板，支持多替换图位和多个提示词局部替换段。 |
| `src/components/TemplateApplyModal.tsx` | 批量套用模板，支持单图/多图上传、多个提示词替换输入。 |
| `src/components/SettingsModal.tsx` | 设置弹窗。API 配置、习惯配置、模板管理、数据管理等 tab 在这里。 |
| `src/components/TutorialModal.tsx` | 新手教程/聚光灯引导。首次 API 配置引导和各模式教程都在这里。 |
| `README.md` | 面向开发者和用户的项目说明。 |

## 5. 本轮完成的重点修改

### 模板提示词多段替换

- 模板保存时，一段提示词里可以设置多个替换文案，不再只能选择一个。
- 套用模板时，替换输入会按原文位置生成本次任务提示词。
- 替换不会修改模板原始提示词，只影响这一次生成出来的 prompt。
- 保存和套用 UI 会展示高亮段，用户填写对应替换内容即可。
- 模板模式的模型切换入口已移到“一键清空模板”旁边，并保留间距，降低误触。
- 主要文件：`src/types.ts`、`src/store.ts`、`src/components/SaveTemplateModal.tsx`、`src/components/TemplateApplyModal.tsx`、`src/components/TemplateWorkspace.tsx`。
- 测试：`src/store.test.ts`。

### 生图卡片图片导出

- 任务详情弹窗里的导出入口已改名为“自定义导出”。
- 已移除原作者更新时右上角出现的 `NEW` 标记。
- 自定义分辨率导出：可输入宽高，例如 800 x 800，导出时按目标尺寸绘制。
- 四宫格切分：
  - 点击后先打开预览，不会立刻下载。
  - 根据原图比例和中心分隔位置计算四块区域，适配 1:1、3:4 等不同画面比例。
  - 会识别白色/浅色外框和中间白边，并尽量裁掉，只保留每格图片主体内容。
  - 如果四宫格没有白色外框、图片直接贴在一起，会回退到按中心和原图比例切分。
  - 导出时不再打 zip，而是直接下载四张 PNG。
  - 文件名使用任务/日期命名，并追加 `-切分01` 到 `-切分04`。
- 裁切导出：
  - 支持框选区域。
  - 选区可以整体拖动。
  - 四角和四边都可以拖拽调整大小。
- 主要文件：`src/components/DetailModal.tsx`、`src/lib/imageExport.ts`、`src/lib/downloadImages.ts`。
- 测试：`src/lib/imageExport.test.ts`。

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
- 主要实现：`src/types.ts`、`src/store.ts`、`src/components/InputBar.tsx`、`src/components/MaskEditorModal.tsx`、`src/lib/promptImageMentions.ts`、`src/lib/maskPreprocess.ts`。

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

## 6. 数据模型新增字段

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
templatePromptReplacements?: Array<{
  id: string
  start: number
  end: number
  originalText: string
}>

templatePromptReplacement?: {
  start: number
  end: number
  originalText: string
}

templateCollectionNote?: string
```

注意：

- 新逻辑使用 `templatePromptReplacements` 支持多段替换。
- `templatePromptReplacement` 是旧的单段字段，保留用于兼容旧数据。
- 替换段必须用当前 prompt 校验：`prompt.slice(start, end) === originalText`，否则视为失效。

## 7. 测试覆盖

重点测试文件：

- `src/lib/apiProfiles.test.ts`：API ZIP 覆盖导入。
- `src/store.test.ts`：模板提示词替换、模板组备注、重复 input image 槽位。
- `src/lib/imageExport.test.ts`：四宫格检测、边框裁剪、自定义尺寸导出等图片导出逻辑。
- `src/lib/promptImageMentions.test.ts`：重复图片槽位重排时 `@图X` 引用不串位。
- `src/lib/maskPreprocess.test.ts`：蒙版目标替换旧逻辑仍兼容。

最近一次已跑：

```bash
npm run build
npm test
```

结果：全部通过。

## 8. GitHub 同步

Git remote：

```bash
origin    https://github.com/CookSleep/gpt_image_playground.git
batch-ver https://github.com/ywjzywn-coder/batch-ver.git
speedver  https://github.com/marceloreiningafcahk-ops/speedver.git
```

当前用户要求的新开发主要推送到 `speedver`。本地 `main` 已跟踪 `speedver/main`。

最近一次已推送提交：

```bash
e30e7db Improve template replacements and image exports
```

提交链接：`https://github.com/marceloreiningafcahk-ops/speedver/commit/e30e7db`

推荐同步命令：

```bash
git status -sb
npm run build
npm test
git add README.md docs/HANDOFF.md src
git commit -m "Describe latest image export handoff"
git push speedver main
```

注意：当前环境没有安装 GitHub CLI `gh`，所以不能用 `gh pr create`。如需 PR，需要先安装并登录 `gh`，或直接在 GitHub 网页创建。

## 9. EdgeOne 部署

- EdgeOne 项目配置：`.edgeone/project.json`
- 项目名：`image-playground`
- Project ID：`makers-ooaiz1b6xhvz`
- 构建产物：`dist/`
- 部署命令：

```bash
npm run build
npx edgeone makers deploy ./dist --name image-playground --env production --json
```

最近一次生产部署：

- 日期：2026-07-01
- Deployment ID：`dph5b5qx7gso`
- 线上地址：`https://image-playground-lkm5myrs.edgeone.cool/`
- EdgeOne 控制台：`https://console.cloud.tencent.com/edgeone/pages/project/makers-ooaiz1b6xhvz/deployment/dph5b5qx7gso`

浏览器线上 QA 已确认：

- 页面可以正常加载。
- 页面非空白。
- 没有部署错误弹层。
- 控制台没有关键报错。

第一次打开线上站点可能会看到 API 导入/教程弹窗，这是浏览器本地状态导致的正常行为，不是部署失败。

## 10. 安全记录

- 2026-06-30 已在提交 `e5b72bb` 移除曾误打包进 `vite.config.ts` 的本地默认 API 配置。
- 本轮提交前执行过敏感信息扫描，未发现真实 `sk-...` API Key 或 EdgeOne token。扫描命中的 `task-live` 等为测试里的假任务 id。
- 由于密钥曾进入 Git 历史和旧部署包，相关 API Key 仍应在服务商后台轮换。
- 当前暂不支持 EdgeOne Function，也没有把 API Key 内置到 EdgeOne 后端；后续如果要隐藏 API Key，需要新增后端代理后再接入。

## 11. 接手注意事项

- 不要把模板任务和普通生图任务混在同一个列表展示；普通任务列表要过滤 `kind === 'template'`。
- 不要删除 Agent 代码；当前只是隐藏入口和部分 UI。
- 新增持久化字段时一定要更新 `normalize*` 函数，保持旧 localStorage/IndexedDB 数据能恢复。
- 输入区参考图现在按槽位处理：任何 UI key、删除、拖拽、蒙版主图判断都要优先考虑 `slotId`。
- API 配置 ZIP 导入是覆盖式；普通 URL/剪贴板自定义服务商导入仍保留合并逻辑。
- 模板导出不要重新改回 `getAllImages()`，大图库会造成内存压力。
- 四宫格切分逻辑要兼容两种图：有白色外框/中间白边的图，以及没有白边、四张图直接贴合的图。
- 四宫格每格内容应该保持和整张图一致的比例，不能固定写死 3:2 或 1:1。
- 四宫格导出不要改回 zip；用户明确要求直接下载四张图。
- 裁切导出选区必须能移动，也必须能拖拽四角四边调整。
- UI 文案保持中文；代码风格跟随现有文件：2 空格、单引号、无分号。

## 12. 当前未提交文件提醒

最近一次交接时，工作区里有这些未跟踪文件：

```text
docs/DESIGN-SYSTEM.md
vite-local-5178.err.log
vite-local-5178.log
```

这些不是本轮功能提交内容。不要随手删除或提交，除非用户明确要求处理。
