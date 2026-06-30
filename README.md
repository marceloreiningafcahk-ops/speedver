# Speedver Image Playground

这是基于 `CookSleep/gpt_image_playground` fork 后继续二次开发的 AI 图片生成前端项目。当前版本重点强化了生图模式、批量模式、模板模式、API 配置导入、分模式新手教程，以及适合二开接手的代码结构说明。

项目是纯前端单页应用，没有自建业务后端。设置与任务元数据保存在浏览器本地存储，图片二进制保存在 IndexedDB。

## 技术栈

- React 19 + TypeScript 5.8
- Vite 6
- Zustand 5
- Tailwind CSS 3
- Vitest
- fflate（ZIP 导入导出）
- npm + `package-lock.json`

## 本地开发

```bash
npm install
npm run dev
```

常用验证命令：

```bash
npm run build
npm test
```

## 主要功能

- 生图模式：提示词输入、参考图、任务历史、复用配置、收藏、详情、下载、遮罩与透明背景等。
- 批量模式：通用提示词、通用参考图、批量导入任务图、多任务拆图、批量提交到生图历史。
- 模板模式：从生图输入保存模板、模板管理、多替换图位、单张/多张上传槽批量套用。
- API 配置：多供应商 profile、本地导入导出、ZIP 配置导入引导、API Key 密文输入。
- 新手教程：首次 API 配置引导，以及生图/批量/模板三个模式的真实页面聚光灯教程。
- 收藏夹：多收藏夹管理、收藏任务、批量下载。
- 兼容保留：Agent 相关数据与代码仍保留，主入口和相关 UI 已隐藏。

## 功能到文件索引

| 功能/区域 | 主要文件 | 说明 |
| --- | --- | --- |
| 应用入口与模式切换 | `src/App.tsx` | 根据 `appMode` 渲染生图、批量、模板等主界面；负责启动时打开首次 API 引导和模式教程。 |
| 全局状态与任务动作 | `src/store.ts` | Zustand store、持久化、任务创建/执行、模板保存/套用、教程状态、筛选匹配等核心动作。 |
| 共享类型 | `src/types.ts` | `TaskRecord`、`AppSettings`、`ApiProfile`、模板替换图位等类型定义。 |
| 生图底部输入区 | `src/components/InputBar.tsx` | 提示词、参考图、粘贴图片、保存模板按钮、生图提交按钮、批量操作入口。 |
| 生图任务列表 | `src/components/TaskGrid.tsx` | 普通任务列表、筛选后的排序、框选、多选和任务卡点击。 |
| 生图任务卡 | `src/components/TaskCard.tsx` | 任务缩略图、状态、参数标签、收藏、复用、编辑输出、删除等操作。 |
| 任务详情 | `src/components/DetailModal.tsx` | 查看输出图、流式预览、错误、下载、编辑输出等。 |
| 搜索与筛选 | `src/components/SearchBar.tsx` | 搜索、收藏筛选、日期筛选、模式来源筛选；Agent 来源已隐藏。 |
| 批量模式 | `src/components/BatchWorkspace.tsx` | 通用设置、通用参考图、任务图导入、多任务拆图、批量提交。 |
| 模板模式列表 | `src/components/TemplateWorkspace.tsx` | 模板卡片、分组、多选、框选、改名/改色/封面/替换图位编辑、批量套用入口。 |
| 保存模板弹窗 | `src/components/SaveTemplateModal.tsx` | 从当前生图输入保存模板，支持多选替换图位、封面、名称、颜色、分组。 |
| 模板批量套用弹窗 | `src/components/TemplateApplyModal.tsx` | 根据模板替换图位生成单张/多张上传槽，支持粘贴和批量套用。 |
| 设置弹窗 | `src/components/SettingsModal.tsx` | API 配置、习惯配置、模板/生图数据管理、关于页、查看教程入口。 |
| 通用设置页 | `src/components/settings/GeneralSettingsTab.tsx` | 习惯配置；Agent 专属设置已隐藏。 |
| 模板设置页 | `src/components/settings/TemplateSettingsTab.tsx` | 模板数据导入导出、分组范围管理等。 |
| 新手教程 | `src/components/TutorialModal.tsx` | 真实页面聚光灯式教程、API ZIP 引导、示例结果卡、目标避让布局和点击拦截。 |
| 收藏夹 | `src/components/favorites/` | 收藏夹列表、管理、选择器、封面卡等。 |
| API profile 管理 | `src/lib/apiProfiles.ts` | 多供应商配置、默认值、导入合并、校验与兼容处理。 |
| API 请求 | `src/lib/api.ts`, `src/lib/openaiCompatibleImageApi.ts`, `src/lib/falAiImageApi.ts`, `src/lib/geminiTikapiImageApi.ts` | 不同供应商的图片生成请求与响应解析。 |
| IndexedDB 存储 | `src/lib/db.ts` | 图片与任务相关二进制数据持久化。 |
| ZIP 导入导出 | `src/lib/exportZip.ts` | 配置、任务、模板等 ZIP 数据导入导出。 |
| 下载图片 | `src/lib/downloadImages.ts` | 单图/批量/ZIP 下载。 |
| 遮罩与透明背景 | `src/lib/mask.ts`, `src/lib/maskPreprocess.ts`, `src/lib/transparentImage.ts` | 局部重绘遮罩和透明背景处理。 |
| 测试 | `src/store.test.ts`, `src/lib/*.test.ts` | store 核心动作、API URL、参数兼容、遮罩、透明背景等回归测试。 |

## 数据与模板规则

- 普通生图任务与模板共用 `TaskRecord`，通过 `kind === 'template'` 区分。
- 普通生图列表和收藏夹会过滤模板任务，模板只在模板模式显示。
- 模板替换图位使用 `templateReplaceImageIndexes`，旧字段 `templateReplaceImageIndex` 保留兼容。
- 模板批量套用会读取替换图位数量，自动显示单张或多张上传槽。
- 批量模式的通用参考图会排在每个任务参考图最前面，作为图一、图二、图三顺延。

## 文档

- `docs/HANDOFF.md`：当前二开交接文档，包含近期改动、注意事项和部署记录。
- `docs/template-mode-refactor-plan.md`：模板模式改造计划与完成状态。
- `docs/mock-image-api.md`：本地模拟图片 API 使用说明。
- `docs/custom-provider-llm-prompt.md`：自定义供应商配置相关提示词说明。
- `AGENTS.md`：代码风格与协作规范。

## 部署

构建后会生成 `dist/` 静态产物：

```bash
npm run build
```

当前仓库保留的部署配置：

- EdgeOne：`.edgeone/project.json`
- Cloudflare Workers：`wrangler.jsonc`
- Vercel：`vercel.json`
- Docker：`deploy/`

EdgeOne 当前项目配置为 `image-playground`，部署前应先确认 `npm run build` 通过。

## 开发注意事项

- 不要手动修改 `dist/`，它由 Vite 构建生成。
- 不要混用 yarn 或 pnpm，本项目使用 npm 与 `package-lock.json`。
- 修改持久化数据结构时，要兼容旧 localStorage / IndexedDB 数据。
- 新增通用工具函数优先放入 `src/lib/`。
- UI 文案与代码注释默认使用中文。
- 大改动后至少运行 `npm run build` 和 `npm test`。

## 上游与许可证

本项目 fork 自 `CookSleep/gpt_image_playground`，遵循原项目 MIT License。详见 `LICENSE`。
