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
4. **Agent（agent）**：旧入口，规划中已从主导航移除，但**数据与代码保留兼容**（`AgentWorkspace.tsx`、`lib/agentApi.ts` 等仍在）。不要删，只是不作主入口。

### 模板与普通任务的区分

- 同一套任务体系，靠 `TaskRecord.kind` 区分：`kind: 'template'` 是模板，普通生图任务无此标记。
- 模板专属字段（见 `src/types.ts` 约 220-240 行）：
  - `customName?` — 模板自定义名称
  - `customColor?` — 标签颜色
  - `templateCoverImageId?` — 自定义封面图
  - `templateReplaceImageIndex?` — 可替换图位下标
  - `sourceTemplateName?` — 由模板生成的任务回填的来源名
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

### 设置弹窗 Tab 结构

`SettingsTab = 'general' | 'template' | 'api' | 'data' | 'about'`（`store.ts:122`）。
渲染分支在 `SettingsModal.tsx`：`api`(1375+)、`general`(1315)、`template`(1325)、`data`(1880)、`about`(1992)。

- **API 配置（api）**：API 供应商/profile 配置。**配置导入导出区已在此 tab 内部**（约 1835 行，"配置导入导出（仅 API 配置，不含生图任务）"）。
- **生图数据（data）**：普通任务与图片的导入导出 / 清理。
- **模板模式管理（template）**：模板的导入导出（按分组多选范围）/ 清理。

## 4. 当前未提交改动状态

git 分支 `main`，**有大量未提交改动**（约 31 个文件，+1537/-552）。新增未跟踪文件：

```
docs/template-mode-refactor-plan.md
src/components/DateRangePicker.tsx
src/components/SaveTemplateModal.tsx
src/components/TemplateApplyModal.tsx
src/components/TemplateWorkspace.tsx
src/components/settings/TemplateSettingsTab.tsx
src/lib/adminAccess.ts
src/lib/customProviderConfigUrl.data.test.ts
src/lib/geminiTikapiImageApi.ts
```

接手者：动手前先跑一次 `npm run build && npm test` 确认基线绿。

## 5. 待办任务（用户明确要求的三项）

### 任务 1：去掉「生图模式」点击自定义卡片名称

- **现状确认**：自定义名称（`customName`）目前**只存在于模板侧** `TemplateWorkspace.tsx`（行 65/75/89，`nameDraft` 改名 UI）。生图卡 `TaskCard.tsx` 本身**没有** `customName` 字段或改名输入框。
- **接手须先定位真实入口**：用户说的"生图模式点击自定义卡片名称"很可能在 **`DetailModal.tsx`**（本轮改 174 行）或卡片点击后的某处。请先 `grep` 确认入口：
  ```
  grep -rn "customName\|sourceTemplateName\|改名\|重命名\|名称" src/components/DetailModal.tsx src/components/TaskCard.tsx src/components/TaskGrid.tsx
  ```
- **目标**：移除生图模式下卡片名称的可点击编辑交互（保留模板模式的改名功能不动）。
- **风险**：勿误删模板侧 `customName` 逻辑；二者共用 `TaskRecord`。

### 任务 2：模板模式「参考图可粘贴」

- **现状**：`TemplateApplyModal.tsx`（批量套用时导入材质/产品图）**已实现** `document` 级 `paste` 监听（行 34-51），可粘贴图片。
- **需澄清/落实**：用户要的"模板模式参考图可粘贴"具体指哪一处：
  - (a) **保存模板** `SaveTemplateModal.tsx` —— 目前是否支持粘贴参考图？需确认并补全。
  - (b) **编辑模板** `TemplateWorkspace.tsx` 编辑态的参考图位 —— 是否要支持粘贴替换/新增？
- **参考实现**：可直接复用 `TemplateApplyModal.tsx:34-51` 的 paste 模式，或 `InputBar.tsx:1274` 的剪贴板图片处理。图片转 dataURL 用 `src/lib/dataUrl.ts` 的 `fileToDataUrl`。

### 任务 3：API 配置导入导出移入 API 配置内部（与生图管理分开）

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
- **部署流程**（用户会在本地终端确认后再上传）：
  1. `npm run build` 生成最新 `dist/`。
  2. 用 EdgeOne CLI 部署 `dist/` 静态产物到 Pages 项目 `image-playground`。
  3. 具体命令以 `npx edgeone pages deploy ./dist ...` 形式，部署前先 `npx edgeone pages --help` 核对子命令与参数。
- **其他部署方式**（备选，见仓库）：Cloudflare（`wrangler.jsonc` + `npm run deploy:cf`）、Docker（`deploy/Dockerfile` + `nginx.conf`）、Vercel（`vercel.json`）。

## 7. 代码风格红线（详见 AGENTS.md）

- 2 空格缩进、单引号、**无分号**、箭头函数始终加括号。
- 简单优先：1-5 行单次逻辑直接内联，不抽函数。不留 TODO / stub，给完整实现。
- 跟随所改文件的现有风格（最高优先级）。
- **代码注释用中文**，UI 文案用中文。
- 新工具函数放 `src/lib/`，不要继续堆进 `store.ts`。
- `normalize*` 函数是 IndexedDB/localStorage 旧数据迁移用的，改动保持向后兼容。
