# 旅行规划看板 (Travel Plan Kanban)

一个 AI 驱动的旅行行程规划看板应用。输入旅行想法，AI 自动生成结构化行程；支持手动调整、拖拽排序、导入导出。

![React](https://img.shields.io/badge/React-19-blue) ![Vite](https://img.shields.io/badge/Vite-7-646CFF) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC)

---

## 功能特性

- **AI 行程生成** — 输入旅行想法，先抽取目的地与日期，再调用 Open-Meteo 查询真实天气并结合 DeepSeek 生成带预算、交通、每日安排的行程；支持上下文式优化
- **拖拽看板** — 支持天数排序、卡片跨天拖拽、同天内重新排序
- **灵活编辑** — 添加/编辑/删除卡片和天数，实时保存到浏览器本地存储
- **行李清单** — 添加、勾选、删除、拖拽排序、搜索和筛选行李；点击摘要卡片可平滑滚动到清单
- **数据导入导出** — JSON 格式备份与恢复
- **双模式运行** — 开发时用 Vite 内置 API，生产时可独立启动 Express 后端或部署到 Vercel

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入你的配置：

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
API_PORT=8787
```

> 密钥可在 [DeepSeek 开放平台](https://platform.deepseek.com/) 获取。`DEEPSEEK_BASE_URL` 通常保持默认即可，如需使用代理或兼容接口可修改。

### 3. 启动开发服务器

```bash
npm run dev
# 或
npm run client
```

打开 http://localhost:3000

开发模式下，Vite 会同时提供前端页面和 `/api/*` 接口，无需单独启动后端。

---

## 脚本说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（含内置 API，别名） |
| `npm run client` | 启动 Vite 开发服务器（含内置 API） |
| `npm run server` | 独立启动 Express API 服务（端口 8787） |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npm test` | 运行 Vitest 测试 |

---

## 项目结构

```
travel-plan/
├── src/
│   ├── main.jsx          # 主应用入口（React 看板组件）
│   └── styles.css        # 全局样式与 Tailwind 指令
├── api/
│   ├── generate.js       # Vercel Serverless API：生成行程
│   └── health.js         # Vercel Serverless API：健康检查
├── server/
│   ├── index.js          # Express 独立后端（复用 api/ 下的 handler）
│   └── deepseek.js       # DeepSeek API 调用封装
├── vite.config.js        # Vite 配置（含开发环境 API 插件）
├── tailwind.config.js    # Tailwind CSS 配置
├── vercel.json           # Vercel 部署配置
├── package.json
└── .env.example          # 环境变量模板
```

---

## 测试

```bash
npm test
```

测试使用 Vitest，详见 `TESTING.md`。

## 持续集成

仓库已配置 `.github/workflows/test.yml`，每次 push 和 pull_request 都会自动运行 `npm test`。

## 使用指南

1. 在顶部输入框描述你的旅行想法（目的地、天数、预算等）
2. 点击「生成行程草案」，AI 会自动生成多日行程
3. 在看板中：
   - **拖拽卡片** 调整顺序或移动到不同天数
   - **拖拽天数图标** 调整天数顺序
   - **点击铅笔图标** 编辑卡片内容
   - **点击垃圾桶图标** 删除卡片或天数
4. 使用底部表单手动添加自定义卡片
5. 点击「导出 JSON」备份行程，「导入 JSON」恢复之前的数据

---

## 部署

### Vercel

本项目已配置 `vercel.json`，支持一键部署到 Vercel：

```bash
npm i -g vercel
vercel
```

部署后需在 Vercel Dashboard 中设置环境变量 `DEEPSEEK_API_KEY`。

### 独立服务器

```bash
npm run build
npm run server
```

然后使用 Nginx 等反向代理将前端 `dist/` 目录和 API 端口（默认 8787）统一对外提供服务。

---

## 技术栈

- **前端**：React 19, Vite 7, Tailwind CSS 3
- **拖拽**：@hello-pangea/dnd
- **图标**：Lucide React
- **后端**：Express 5（可选独立部署）/ Vercel Serverless Functions
- **AI**：DeepSeek Chat API

---

## 许可证

MIT
