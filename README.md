# 旅行规划看板 (Travel Plan Kanban)

一个 AI 驱动的旅行行程规划看板应用。输入旅行想法，AI 自动生成结构化行程；支持手动调整、拖拽排序、上下文优化、导入导出。

![React](https://img.shields.io/badge/React-19-blue) ![Vite](https://img.shields.io/badge/Vite-7-646CFF) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC)

---

## 功能特性

- **AI 行程生成** — 输入旅行想法，先抽取目的地与出行日期，再按日期匹配和风天气 7 天预报；当预报无法覆盖完整行程或服务不可用时，复用已解析坐标回退到 Open-Meteo，并结合 DeepSeek 生成带预算、交通、每日安排与天气的行程
- **上下文优化** — 生成后继续输入要求即可在原草案上调整；当前行程与最近 8 条沟通记录保存在浏览器本地（每次请求携带最近 6 条），点击「清空行程」一并清除
- **拖拽看板** — 天数横向排序、卡片跨天拖拽、同天内重新排序；行李清单同样支持拖拽排序
- **类型筛选** — 按交通 / 景点 / citywalk / 美食 / 酒店 / 娱乐 / 工作筛选卡片并显示各类型数量；筛选视图仅用于查看，此时拖拽排序暂停
- **灵活编辑** — 卡片支持添加 / 编辑 / 复制 / 删除，天数支持追加与删除（至少保留一天，删除含内容的当天需二次确认）；可设置出发日期，自动推算其余天数的日期、星期与周末标识
- **预算自动汇总** — 按卡片费用自动累计预算区间，顶部摘要卡同时展示推荐交通、规划范围（天数 · 项数）与携带物品进度
- **行李清单** — 添加、编辑、勾选、删除、拖拽排序、分类筛选与模糊搜索；点击摘要卡片可平滑滚动到清单，看板与清单均支持折叠
- **数据导入导出** — JSON、Markdown、PNG 图片三种导出，以及 JSON 备份恢复
- **外观与体验** — 亮 / 暗 / 跟随系统主题（页面加载前预置主题 class 避免闪烁）、生成进度条与阶段提示、AI 请求 / 响应调试面板
- **多模式运行** — 开发时用 Vite 内置 API，生产时可使用 Docker + Nginx、独立 Express 后端或 Vercel
- **开放访问与请求保护** — 无需注册或密码；生成接口按来源地址限流，并限制请求体和上下文大小

---

## 快速开始

环境要求：Node.js 20+（Docker 镜像基于 `node:20-alpine`，CI 使用 Node 22）。

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
# 仅在可信反向代理覆写客户端 IP 时开启；Docker Compose 已配置为 1
TRUST_PROXY=0
QWEATHER_API_KEY=your_qweather_api_key
QWEATHER_BASE_URL=https://devapi.qweather.com/v7
QWEATHER_GEO_URL=https://geoapi.qweather.com/v2
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 是 | 生成行程必需，在 [DeepSeek 开放平台](https://platform.deepseek.com/) 获取 |
| `DEEPSEEK_BASE_URL` | 否 | 默认 `https://api.deepseek.com`，使用代理或兼容接口时可修改 |
| `API_PORT` | 否 | 独立 Express 服务端口，默认 `8787` |
| `TRUST_PROXY` | 否 | 设为 `1` / `true` 时才信任代理覆写的 `X-Real-IP` / `X-Forwarded-For`；Docker Compose 已配置为 `1` |
| `QWEATHER_API_KEY` | 否 | 配置后优先使用和风天气；未配置或请求失败时自动回退到 Open-Meteo |
| `QWEATHER_BASE_URL` | 否 | 默认 `https://devapi.qweather.com/v7` |
| `QWEATHER_GEO_URL` | 否 | 默认 `https://geoapi.qweather.com/v2` |

Vite 开发模式会自动加载 `.env`；独立 Express 服务通过 `dotenv` 读取。

### 3. 启动开发服务器

```bash
npm run dev
# 或
npm run client
```

打开 http://localhost:3000

开发模式下，Vite 会同时提供前端页面和 `/api/*` 接口，无需单独启动后端。

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/generate` | 生成或优化行程，返回行程 JSON；请求体为 `{ idea, currentPlan?, history? }` |
| `GET` | `/api/health` | 健康检查，返回 `{ ok, hasDeepSeekKey }`；Dockerfile 与 compose healthcheck 使用 |

该流程在三个部署面（Vite 开发插件、Express、Vercel Serverless）之间共用 `server/generate-handler.js`，各部署面只保留传输层胶水代码。

---

## 脚本说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（含内置 API，别名） |
| `npm run client` | 启动 Vite 开发服务器（含内置 API，端口 3000） |
| `npm run server` | 独立启动 Express API 服务（默认端口 8787，可用 `API_PORT` 覆盖） |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 静态预览生产构建，**不包含 `/api`**（需要接口时另起 `npm run server`） |
| `npm test` | 运行 Vitest 测试 |

另有 `./run.sh {start\|stop\|restart\|status}` 用于后台方式托管开发服务器（默认端口 3000，可用 `APP_PORT` 覆盖）。

---

## 项目结构

```
travel-plan/
├── index.html             # HTML 入口（含主题预置脚本）
├── src/
│   ├── main.jsx           # 浏览器挂载入口
│   ├── App.jsx            # 应用编排、状态与导入导出交互（含 PNG 导出绘制）
│   ├── components/
│   │   ├── ItineraryComponents.jsx  # 行程卡片、天数列与行李清单 UI
│   │   └── TravelControls.jsx       # 主题切换与生成进度组件
│   ├── hooks/useTheme.js  # 亮 / 暗 / 跟随系统主题
│   ├── utils/             # date（日期推算）、plan（数据模型与预算）、storage（本地存储）、export（导出）
│   └── styles.css         # 全局样式与 Tailwind 指令
├── server/
│   ├── index.js           # Express 独立后端入口
│   ├── generate-handler.js # 三种 API 部署面共享的请求处理流程
│   ├── request-guard.js   # 请求体限制、字段截断、限流和错误收敛
│   ├── deepseek.js        # DeepSeek、天气查询与行程标准化逻辑
│   └── Dockerfile         # Node API 生产镜像
├── api/
│   ├── generate.js        # Vercel Serverless API：生成行程
│   └── health.js          # Vercel Serverless API：健康检查
├── tests/                 # Vitest 测试（server / api / components）
├── Dockerfile             # 前端静态文件与 Nginx API 反向代理镜像
├── docker-compose.yml     # Docker Compose 部署配置
├── vite.config.js         # Vite 配置（含开发环境 API 插件）
├── vitest.config.js       # Vitest 配置
├── tailwind.config.js     # Tailwind CSS 配置
├── vercel.json            # Vercel 部署配置
├── run.sh                 # 开发服务器 start/stop/restart/status 脚本
├── package.json
└── .env.example           # 环境变量模板
```

---

## 测试

```bash
npm test                                    # 运行全部测试（vitest run）
npm test -- tests/server/deepseek.test.js   # 运行单个测试文件
npm test -- --reporter=verbose              # 详细输出
```

当前共 4 个测试文件、35 个用例，全部通过：

| 文件 | 覆盖内容 |
|------|----------|
| `tests/server/deepseek.test.js` | 生成流程、重试逻辑、上下文注入、和风天气日期映射与 Open-Meteo 回退边界 |
| `tests/server/request-guard.test.js` | 请求校验、限流行为、公开错误收敛 |
| `tests/api/generate.test.js` | Vercel 路由方法守卫、参数校验与异常收敛 |
| `tests/components/App.test.jsx` | 行李清单与自定义卡片关键交互 |

框架为 Vitest v4 + `@testing-library/react`（组件测试用 jsdom 环境，服务端测试需在文件顶部声明 `// @vitest-environment node`），详见 `TESTING.md`。

## 请求限制

应用无需账号、密码或注册即可使用。为了保护 AI 服务额度，`/api/generate` 对同一来源地址默认限制为 10 分钟内最多 5 次成功生成（配额只在生成成功后计入，失败请求不消耗），超限返回 429 并附带 `Retry-After` 提示下一次可重试时间。

当前输入边界如下：请求体最多 1 MiB；旅行想法最多 2,000 个字符；沟通记录最多 8 条、每条最多 800 个字符；当前行程最多 16 天和 200 张卡片。请求体超过 1 MiB 会返回 413；请求体未超限时，超长字段会自动截断到边界内，只有结构性错误（如格式不是对象）才会被拒绝。异常情况下 API 只返回用户可理解的错误信息，上游错误详情仅记录在服务端日志。

默认情况下限流键取自连接地址，客户端伪造的 `X-Real-IP` / `X-Forwarded-For` 不会生效；只有在可信反向代理之后部署时，才设置 `TRUST_PROXY=1` 让 API 改用代理覆写后的头（Docker Compose 部署已默认开启，前端 Nginx 仅信任内网代理覆写该头）。

当前限流状态保存在 API 进程内。对于 Vercel 多实例部署，各实例分别计数；如需全局统一配额，需要接入共享限流存储。

## 使用指南

1. 在顶部输入框描述你的旅行想法（目的地、天数、预算等），点击「生成行程草案」
2. 已有行程或沟通上下文时，按钮变为「优化当前行程」，继续输入即可在原草案上调整；点击生成按钮旁的下拉箭头可展开查看发送给 DeepSeek 的请求与响应详情
3. 在看板中：
   - **拖拽天数图标** 调整天数顺序，**拖拽卡片** 调整顺序或移动到不同天数
   - 卡片操作：**铅笔图标** 编辑、**复制图标** 复制、**垃圾桶图标** 删除
   - **点击天数下的日期** 设置出发日期，其余天数自动顺推并显示星期 / 周末标识
   - **类型筛选条** 按类型显示或隐藏卡片（筛选视图下拖拽暂停）
   - 「添加天数」追加空白天；筛选条右侧的 **「+」按钮** 展开底部表单手动添加自定义卡片
4. 携带物品清单：添加、编辑、勾选、删除、拖拽排序、分类筛选与模糊搜索；点击顶部「携带物品」摘要卡片可跳转到清单
5. 通过「导出」菜单导出 JSON / Markdown / 图片，用「导入JSON」恢复之前导出的 JSON
6. 「清空行程」会同时重置看板、沟通上下文与本地存储；输入框右上角可切换亮暗主题

---

## 部署

### Vercel

本项目仍保留 `vercel.json` 和 `api/` 目录以兼容 Vercel：

```bash
npm i -g vercel
vercel
```

部署后需在 Vercel Dashboard 中设置环境变量 `DEEPSEEK_API_KEY`；如需优先使用和风天气，再配置 `QWEATHER_API_KEY`、`QWEATHER_BASE_URL` 和 `QWEATHER_GEO_URL`。Vercel 通常保持 `TRUST_PROXY=0`，未配置和风天气时会回退到 Open-Meteo。

### Docker Compose

生产部署推荐使用仓库中的 `Dockerfile`、`server/Dockerfile` 和 `docker-compose.yml`。前端容器内的 Nginx 提供静态页面，并将 `/api/` 反向代理到 `travel-plan-api:8787`；两个容器只使用内部端口，不直接映射到宿主机，且各自带 healthcheck（API 镜像内也内置了 `HEALTHCHECK`）。

先创建或复用 Nginx Proxy Manager 所在的外部网络：

```bash
docker network create npm-network
```

在项目根目录准备 `.env`，至少设置 `DEEPSEEK_API_KEY`，然后启动：

```bash
docker compose up -d --build
```

镜像标签默认为 `latest`，可通过 `IMAGE_TAG` 覆盖；外部网络名称默认为 `npm-network`，可通过 `NPM_NETWORK_NAME` 覆盖。

Nginx Proxy Manager 与本项目需要加入同一个 `npm-network`。创建代理主机时，将目标设置为 `travel-plan`、端口 `80`。浏览器访问页面和 `/api/*` 均通过前端 Nginx 同源转发，Node API 不需要暴露宿主机端口。

### 独立服务器

```bash
npm run build
npm run server
```

然后使用 Nginx 等反向代理将前端 `dist/` 目录和 API 端口（默认 8787）统一对外提供服务。

---

## 持续集成

仓库已配置 `.github/workflows/test.yml`，推送到 `master` / `main` 或发起 pull request 时都会自动运行 `npm test`。当前 CI 尚未执行生产构建检查。

---

## 技术栈

- **前端**：React 19, Vite 7, Tailwind CSS 3
- **拖拽**：@hello-pangea/dnd
- **图标**：Lucide React
- **后端**：Express 5（可选独立部署）/ Vercel Serverless Functions
- **AI**：DeepSeek Chat API
- **天气**：和风天气（可选优先）/ Open-Meteo（回退）
- **测试**：Vitest 4, Testing Library, jsdom

---

## 许可证

MIT
