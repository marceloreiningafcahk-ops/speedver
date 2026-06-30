# 项目交接文档（gpt-image-playground）

> 面向接手的 AI 开发助手。先读本文件，再读 `AGENTS.md`（代码风格强制规范）与 `docs/template-mode-refactor-plan.md`（模板模式总体规划）。

## 1. 项目概况

- **类型**：纯前端单页应用，AI 图片生成 Playground。
- **技术栈**：React 19 + Vite 6 + TypeScript 5.8 + Zustand 5（状态）+ Tailwind 3（样式）。
- **数据**：全部存浏览器本地。设置/任务元数据走 Zustand `persist`，图片二进制走 IndexedDB（`src/lib/db.ts`）。无后端。
- **包管理**：npm（有 `package-lock.json`），不要用 yarn/pnpm。
- **当前版本**：`package.json` 0.6.10。

### 常用命令

| 操作 | 命令 |
|------|------|
| 安装依赖 | `npm install` |
| 开发服务器 | `npm run dev` |
| 构建（含 tsc 类型检查） | `npm run build` |
| 运行测试 | `npm test`（Vitest） |
| 监听测试 | `npm run test:watch` |

**改完代码务必先 `npm run build` 验证编译，再 `npm test`。**

## 2. 三大功能模式（核心架构）

应用由 `appMode` 切换三块体验，store 字段 `appMode: 'gallery' | 'template' | 'agent'`：

1. **生图模式（gallery）**：普通图片生成 + 任务列表。卡片组件 `src/components/TaskCard.tsx`，列表 `TaskGrid.tsx`。
2. **模板模式（template）**：模板卡浏览 / 多选 / 批量复用 / 保存模板。主组件 `src/components/TemplateWorkspace.tsx`。
3. **收藏夹**：独立入口，`src/components/favorites/`。
4. **Agent（agent）**：旧入口，规划中已从主导航移除，但**数据与代码保留兼容**（`AgentWorkspace.tsx`、`lib/agentApi.ts` 等仍在）。不要删，只是不作主入口；生图模式来源筛选已隐藏 Agent 归类，设置页通用配置里 Agent 专属的“发送消息后自动滚动到底部 / 公式输出提示”也已隐藏。

### 模板与普通任务的区分

- 同一套任务体系，靠 `TaskRecord.kind` 区分：`kind: 'template'` 是模板，普通生图任务无此标记。
- 模板专属字段（见 `src/types.ts` 约 220-240 行）：
  - `customName?` — 模板自定义名称
  - `customColor?` — 标签颜色
  - `templateCoverImageId?` — 自定义封面图
  - `templateReplaceImageIndex?` — 旧版单个可替换图位下标，继续写入用于兼容历史逻辑
  - `templateReplaceImageIndexes?` — 新版多个可替换图位下标，批量套用时优先读取；通过 `getTemplateReplaceImageIndexes()` 做去重、排序和旧字段回退
  - `sourceTemplateName?` — 由模板生成的任务回填的来源名
- **模板多替换位规则（2026-06-29）**：
  - `SaveTemplateModal.tsx` 保存模板时可多选参考图作为替换图，默认仍选最后一张，至少保留一个替换位。
  - `TemplateWorkspace.tsx` 编辑模板时同样可多选替换图位，保存时写 `templateReplaceImageIndexes`，并同步旧字段 `templateReplaceImageIndex` 为第一个下标。
  - `TemplateApplyModal.tsx` 批量套用时会按选中模板的替换位数量生成上传槽：只含单替换模板时显示 1 个上传框；含多替换模板时显示多张参考图上传槽；单替换模板和多替换模板混选时同时显示“单张参考图上传”和多张上传槽。多替换模板按下标顺序使用第 1/2/3 张上传图。
  - `batchApplyTemplates()` 支持旧的单字符串参数，也支持 `{ singleImageDataUrl, multiImageDataUrls }`，老调用不会失效。
- **关键约束**：普通生图列表、收藏夹都要过滤掉 `kind==='template'` 的卡，模板只在模板模式出现。

## 3. 关键文件地图

| 路径 | 职责 |
|------|------|
| `src/store.ts` | **核心状态（5000+ 行）**。state 定义 + action。含 `persist` + IndexedDB 持久化、`normalize*` 数据迁移函数。改动注意向后兼容。新纯函数请放 `src/lib/`，勿继续堆这里。 |
| `src/types.ts` | 共享类型（`TaskRecord`、`AppSettings`、`ApiProfile` 等）。 |
| `src/lib/db.ts` | IndexedDB 封装。改 schema 需升 `DB_VERSION` 并处理 `onupgradeneeded`。 |
| `src/lib/apiProfiles.ts` | 多供应商 API 配置，注意向后兼容。 |
| `src/lib/exportZip.ts` | ZIP 导入导出核心逻辑。 |
| `src/components/SettingsModal.tsx` | 设置弹窗（400+ 行 diff）。tab 见下。 |
| `src/components/TemplateWorkspace.tsx` | 模板模式 UI（含改名/改色/封面/可替换位编辑、多选、框选）。 |
| `src/components/SaveTemplateModal.tsx` | 从输入区保存模板（名称、封面、分组选择）。 |
| `src/components/TemplateApplyModal.tsx` | 模板批量套用，弹窗导入材质/产品图（**已支持粘贴图片**）。 |
| `src/components/TaskCard.tsx` | 生图任务卡。 |
| `src/components/DetailModal.tsx` | 任务详情弹窗（本轮改动 174 行）。 |
| `src/components/InputBar.tsx` | 底部输入区（提示词、参考图、粘贴处理）。 |
| `src/components/TutorialModal.tsx` | 新手教程与首次 API 配置引导。现在是页面聚光灯式 guided tour：高亮真实 UI、周围压暗、说明卡贴近目标。 |

### 设置弹窗 Tab 结构

`SettingsTab = 'general' | 'template' | 'api' | 'data' | 'about'`（`store.ts:122`）。
渲染分支在 `SettingsModal.tsx`：`api`(1375+)、`general`(1315)、`template`(1325)、`data`(1880)、`about`(1992)。

- **API 配置（api）**：API 供应商/profile 配置。**配置导入导出区已在此 tab 内部**（约 1835 行，"配置导入导出（仅 API 配置，不含生图任务）"）。
- **生图数据（data）**：普通任务与图片的导入导出 / 清理。
- **模板模式管理（template）**：模板的导入导出（按分组多选范围）/ 清理。

## 4. 当前开发状态

- git 分支 `main`。
- 当前工作区包含模板多替换位、Agent 隐藏、新手教程/首次配置引导、批量模式优化与项目 README 文件地图改动。
- 当前用户已要求推送 GitHub 并部署 EdgeOne；推送目标远端为 `speedver`（`marceloreiningafcahk-ops/speedver`）。
- 本轮已验证：`npm run build` 通过，`npm test` 通过 228 个测试。
- 教程系统已用本地 Chrome headless 验证：首次 API 配置聚光灯、配置 ZIP 高亮、跳过配置、生图/批量/模板真实页面引导、设置页“查看教程”重复打开均可用，控制台无错误。
- 接手者继续动手前仍建议跑一次 `git status --short` 和 `npm test`，确认没有用户测试期间产生的新改动。

## 5. 已完成/需回归事项

### 已完成：模板多替换位与多槽上传

- 建立模板时支持多选参考图作为替换图。
- 编辑模板时支持修改多替换图位。
- 批量套用模板时，根据选中模板自动显示单张上传和多张上传槽；多张上传按替换位顺序应用。
- 兼容旧字段 `templateReplaceImageIndex`，旧模板无需迁移即可继续使用。

### 已完成：Agent UI 隐藏

- 主导航中的 Agent 已隐藏（历史兼容代码保留）。
- 生图模式来源筛选不再显示 Agent 选项；如果旧持久化状态停留在 `agent` 筛选，会自动回到 `all`。
- 设置页通用配置中隐藏 Agent 专属的“发送消息后自动滚动到底部”和“公式输出提示”。

### 已完成：首次配置引导与分模式真实页面教程

- `store.ts` 新增 `TutorialTopic`、`CURRENT_TUTORIAL_VERSION`、`onboardingApiConfigReady`、`tutorialSeenModes`、`tutorialTopic` 以及 `openTutorial()/closeTutorial()` 等动作。
- `App.tsx` 启动时会先检查 API 配置引导：若尚未完成/跳过引导，则打开“导入 API 使用配置”。不再因为本地已有可用 API Key 就静默跳过，这样首次进入站点仍会明确教用户导入 ZIP；完成或跳过后，再按当前 `appMode` 自动弹出生图/批量/模板教程；每个模式按版本只自动弹一次。
- API 配置教程不再是独立小弹窗：会打开设置页 API 配置 tab，高亮真实“从 ZIP 导入配置”区域。没有压缩包可点说明卡里的“没有压缩包，先跳过”，不会写入 API 配置，后续真正提交任务仍由原 API 校验提示完善。
- `SettingsModal.tsx` 的 API Key 输入框改为 `type="text"` + `[-webkit-text-security:disc]` + `autocomplete="new-password"`，视觉上仍是密文，但避免 Chrome 把它当登录密码框弹保存密码。
- 生图教程高亮真实底部输入框、上传参考图按钮、生图按钮，并在任务区上方浮出一张 `data-tour="gallery-sample-card"` 内置示例结果卡；教程不会真的调用 API，也不会创建真实任务。除 API 配置导入步骤外，聚光灯中间会有透明拦截层，避免用户点到真实“生成/保存/提交”按钮触发实际操作。
- 批量教程高亮真实通用设置、通用参考图上传、右侧任务导入/拖拽区、任务卡和提交按钮，说明多张通用参考图会顺延为图一/图二/图三。
- 模板教程会先切回生图模式，依次高亮“填写模板提示词”“上传/粘贴模板参考图”“保存为模板”，再切到模板模式高亮模板列表与批量套用流程，贴合真实创建路径。
- 教程目标选择现在按 selector 列表顺序查找，而不是浏览器 DOM 顺序；例如 `template-apply-button, template-workspace` 会优先高亮“批量套用”按钮，找不到按钮才兜底高亮工作区。说明卡也改为多候选位置自动避让高亮目标，避免遮住模板模式底部按钮。
- `SettingsModal.tsx` 左侧底部“查看教程”按钮会先保存/关闭设置弹窗，再按当前模式重新打开真实页面教程。
- 为教程锚点新增了若干 `data-tour` 属性：`gallery-prompt`、`gallery-upload`、`gallery-submit`、`template-save-button`、`batch-common-settings`、`batch-common-upload`、`batch-dropzone`、`batch-task-card`、`batch-submit`、`template-workspace`、`template-apply-button`、`api-config-import`。

### 需回归：API 配置导入导出移入 API 配置内部（与生图管理分开）

- **现状**：**该需求实际已基本完成**。`SettingsModal.tsx:1835` 处已有"配置导入导出（仅 API 配置，不含生图任务）"区块，位于 `activeTab === 'api'` 分支内；生图数据导入导出在 `data` tab，模板在 `template` tab，三者已分离。
- **接手须做**：回归验证三处导入导出互不串台：
  - API 配置导出**不含**生图任务/图片、不含模板。
  - 生图数据导出**不含** API 配置、不含模板。
  - 模板导出按分组范围，独立。
- 若用户测试发现仍有混用，再据实修正 `exportZip.ts` / 各 tab 的导出范围。

> 注：任务 2、3 在现有代码里已部分或大部分落地，**接手第一步是按上面的验证点逐项实测**，确认到底还差什么，而非从零重写。

## 6. EdgeOne 部署

- **CLI 已安装可用**：`npx edgeone --version` 正常输出。
- **项目已关联**：`.edgeone/project.json` → `{"Name":"image-playground","ProjectId":"makers-ooaiz1b6xhvz"}`。
- **构建产物**：`dist/`（已存在一份构建结果）。
- **部署流程**：
  1. `npm run build` 生成最新 `dist/`。
  2. 用 EdgeOne CLI 部署 `dist/` 静态产物到项目 `image-playground`。
  3. 当前可用命令：`npx edgeone makers deploy ./dist --name image-playground --env production --json`。
- **其他部署方式**（备选，见仓库）：Cloudflare（`wrangler.jsonc` + `npm run deploy:cf`）、Docker（`deploy/Dockerfile` + `nginx.conf`）、Vercel（`vercel.json`）。

## 7. 代码风格红线（详见 AGENTS.md）

- 2 空格缩进、单引号、**无分号**、箭头函数始终加括号。
- 简单优先：1-5 行单次逻辑直接内联，不抽函数。不留 TODO / stub，给完整实现。
- 跟随所改文件的现有风格（最高优先级）。
- **代码注释用中文**，UI 文案用中文。
- 新工具函数放 `src/lib/`，不要继续堆进 `store.ts`。
- `normalize*` 函数是 IndexedDB/localStorage 旧数据迁移用的，改动保持向后兼容。
