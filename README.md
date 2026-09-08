# 旅行规划看板 (Travel Plan Kanban)

一个 AI 驱动的旅行行程规划看板应用。输入旅行想法，AI 自动生成结构化行程；支持手动调整、拖拽排序、导入导出。

![React](https://img.shields.io/badge/React-19-blue) ![Vite](https://img.shields.io/badge/Vite-7-646CFF) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC)

---

## 功能特性

- **AI 行程生成** — 输入旅行想法，先抽取目的地与日期，再优先调用和风天气、失败时回退到 Open-Meteo 查询真实天气，并结合 DeepSeek 生成带预算、交通、每日安排的行程；支持上下文式优化
- **拖拽看板** — 支持天数排序、卡片跨天拖拽、同天内重新排序
- **灵活编辑** — 添加/编辑/删除卡片和天数，实时保存到浏览器本地存储
- **行李清单** — 添加、勾选、删除、拖拽排序、搜索和筛选行李；点击摘要卡片可平滑滚动到清单
- **数据导入导出** — JSON 格式备份与恢复
- **双模式运行** — 开发时用 Vite 内置 API，生产时可独立启动 Express 后端或部署到 Vercel
- **开放访问与请求保护** — 无需注册或密码；生成接口按来源地址限流，并限制请求体和上下文大小

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
QWEATHER_API_KEY=your_qweather_api_key
QWEATHER_BASE_URL=https://devapi.qweather.com/v7
QWEATHER_GEO_URL=https://geoapi.qweather.com/v2
```

> 密钥可在 [DeepSeek 开放平台](https://platform.deepseek.com/) 获取。`DEEPSEEK_BASE_URL` 通常保持默认即可，如需使用代理或兼容接口可修改。
> `QWEATHER_API_KEY` 为可选配置。配置后优先使用和风天气；未配置或和风天气请求失败时，自动回退到 Open-Meteo。

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
│   ├── main.jsx          # 浏览器挂载入口
│   ├── App.jsx           # 应用编排、状态与导入导出交互
│   ├── components/       # 看板、行程卡片、装箱清单和加载状态组件
│   ├── hooks/            # 主题等可复用 React hooks
│   ├── utils/            # 日期、计划模型、本地存储和导出工具
│   └── styles.css        # 全局样式与 Tailwind 指令
├── api/
│   ├── generate.js       # Vercel Serverless API：生成行程
│   └── health.js         # Vercel Serverless API：健康检查
├── server/
│   ├── index.js          # Express 独立后端（复用 server/deepseek.js 的生成逻辑）
│   ├── Dockerfile         # Node API 生产镜像
│   └── deepseek.js       # DeepSeek、天气查询与行程标准化逻辑
├── Dockerfile             # 前端静态文件与 Nginx API 反向代理镜像
├── docker-compose.yml     # 火山云 Docker Compose 部署配置
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

## 请求限制

应用无需账号、密码或注册即可使用。为了保护 AI 服务额度，`/api/generate` 对同一来源地址默认限制为 10 分钟内 5 次请求，并返回 `Retry-After` 提示下一次可重试时间。

当前输入边界如下：请求体最多 1 MiB；旅行想法最多 2,000 个字符；沟通记录最多 8 条、每条最多 800 个字符；当前行程最多 16 天和 200 张卡片。超限的内容会被自动截断到边界内，只有结构性错误（如格式不是对象）才会被拒绝。异常情况下 API 只返回用户可理解的错误信息，不返回上游服务的原始错误详情。

默认情况下限流键取自连接地址，客户端伪造的 `X-Real-IP` / `X-Forwarded-For` 不会生效；只有在可信反向代理之后部署时，才设置 `TRUST_PROXY=1` 让 API 改用代理覆写后的头（Docker Compose 部署已默认开启，前端 Nginx 仅信任内网代理覆写该头）。

当前限流状态保存在 API 进程内。对于 Vercel 多实例部署，各实例分别计数；如需全局统一配额，需要接入共享限流存储。

## 持续集成

仓库已配置 `.github/workflows/test.yml`，每次 push 和 pull_request 都会自动运行 `npm test`。当前 CI 尚未执行生产构建检查。

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

本项目仍保留 `vercel.json` 和 `api/` 目录以兼容 Vercel：

```bash
npm i -g vercel
vercel
```

部署后需在 Vercel Dashboard 中设置环境变量 `DEEPSEEK_API_KEY`；如需优先使用和风天气，再配置 `QWEATHER_API_KEY`、`QWEATHER_BASE_URL` 和 `QWEATHER_GEO_URL`。未配置和风天气时会回退到 Open-Meteo。

### 火山云 Docker

生产部署推荐使用仓库中的 `Dockerfile`、`server/Dockerfile` 和 `docker-compose.yml`。前端容器内的 Nginx 提供静态页面，并将 `/api/` 反向代理到 `travel-plan-api:8787`；两个容器只使用内部端口，不直接映射到宿主机。

先创建或复用 Nginx Proxy Manager 所在的外部网络：

```bash
docker network create npm-network
```

在项目根目录准备 `.env`，至少设置 `DEEPSEEK_API_KEY`，然后启动：

```bash
docker compose up -d --build
```

Nginx Proxy Manager 与本项目需要加入同一个 `npm-network`。创建代理主机时，将目标设置为 `travel-plan`、端口 `80`。浏览器访问页面和 `/api/*` 均通过前端 Nginx 同源转发，Node API 不需要暴露宿主机端口。若网络名称不是 `npm-network`，可通过 `NPM_NETWORK_NAME` 覆盖。

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
- **天气**：和风天气（可选优先）/ Open-Meteo（回退）

---

## 许可证

MIT
