# Speedver Image Playground

这是基于 `CookSleep/gpt_image_playground` fork 后进行二次开发的 AI 图片生成前端项目。

当前仓库重点围绕生图模式、模板模式、收藏夹与 API 配置管理继续迭代。原项目的在线体验、赞助信息和 Star 统计已从本 README 移除，避免与当前 fork 混淆。

## 项目概况

- 类型：纯前端单页应用，无后端服务
- 技术栈：React 19 + Vite 6 + TypeScript 5.8 + Zustand 5 + Tailwind CSS 3
- 数据存储：设置与任务元数据存于浏览器本地存储，图片二进制存于 IndexedDB
- 包管理：npm

## 本地开发

```bash
npm install
npm run dev
```

## 构建与测试

```bash
npm run build
npm test
```

修改代码后建议先运行 `npm run build`，再运行 `npm test`。

## 常用命令

| 操作 | 命令 |
| --- | --- |
| 安装依赖 | `npm install` |
| 启动开发服务器 | `npm run dev` |
| 构建静态产物 | `npm run build` |
| 运行测试 | `npm test` |
| 监听测试 | `npm run test:watch` |
| 启动模拟 API | `npm run mock:api` |

## 功能方向

- 生图模式：普通图片生成、任务历史、复用、收藏与下载
- 模板模式：模板保存、模板浏览、多选与批量复用
- 收藏夹：独立收藏夹入口，多收藏夹管理与批量下载
- API 配置：多供应商、多配置、本地导入导出

## 关键文档

- `docs/HANDOFF.md`：当前二开交接说明
- `docs/template-mode-refactor-plan.md`：模板模式改造计划
- `AGENTS.md`：代码风格与协作规范

## 目录说明

| 路径 | 说明 |
| --- | --- |
| `src/store.ts` | 核心 Zustand 状态与动作 |
| `src/types.ts` | 共享类型定义 |
| `src/lib/db.ts` | IndexedDB 图片存储封装 |
| `src/lib/exportZip.ts` | ZIP 导入导出逻辑 |
| `src/components/TaskCard.tsx` | 生图任务卡片 |
| `src/components/TemplateWorkspace.tsx` | 模板模式主界面 |
| `src/components/SettingsModal.tsx` | 设置弹窗 |

## 开发注意事项

- 不要手动修改 `dist/`，它由 Vite 构建生成
- 不要混用 yarn 或 pnpm，本项目使用 npm 与 `package-lock.json`
- 修改持久化数据结构时，需要注意旧 localStorage / IndexedDB 数据兼容
- 新增通用工具函数优先放入 `src/lib/`
- UI 文案与代码注释默认使用中文

## 部署

构建后会生成 `dist/` 目录，可部署到任意静态文件托管服务。

```bash
npm run build
```

项目中保留了多种部署配置，可根据需要选择：

- EdgeOne：`.edgeone/project.json`
- Cloudflare Workers：`wrangler.jsonc`
- Docker：`deploy/`
- Vercel：`vercel.json`

## 上游与许可证

本项目 fork 自 `CookSleep/gpt_image_playground`，遵循原项目的 MIT License。详见 `LICENSE`。
