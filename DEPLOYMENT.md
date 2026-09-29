# Sola Lab 线上部署规范：预验证 + 秒回滚

> **适用**：火山北京机（4C8G）上 Docker 部署的三个 Web App：`travel-plan` / `flexi-log-web`（fitness.solalab.cn）/ `china-travel`（travel.solalab.cn）
> **状态**：✅ 2026-09-28 与华哥对齐的方案，本文档即实施记录。travel-plan 已落地为仓库根的 `deploy.sh` / `rollback.sh`；flexi-log-web 与 china-travel 按第四节顺序跟进。
> **背景**：频繁更新不能影响线上稳定。结论 = 不上腾讯测试机，用「预验证 + 回滚」流程替代。

---

## 一、核心原则

把「更新上线」从一步拆成四步，每步有闸门：

```
禁止：  git push → 构建新镜像 → 杀旧容器 → 起新容器      ← 起不来/有 bug，线上直接挂
要求：  git push → 构建新镜像 → 并行起新容器 → 验证通过才切流 → 旧容器留存 24h 可秒回滚
```

两条铁律：

1. **验证发生在切流之前** —— 任何一步失败，线上保持旧版本不动。
2. **切流可逆** —— 旧镜像（版本 tag）+ 旧容器（改名留存）在回滚窗口（24h）结束前不得删除。

---

## 二、流程五步

### Step 1：构建带版本 tag 的新镜像

tag 格式 **`YYYYMMDD-<短哈希>`**（如 `20260929-abc1234`，北京时间）。短哈希对应具体 commit，回退历史版本时可查代码；纯时间戳做不到这点，不要用。

❌ 禁止用 `latest` 作为部署依据（覆盖后旧版本丢失）。构建失败在此终止，线上零感知。

### Step 2：起新容器（并行，不接流量）

```bash
docker run -d --name <项目>-candidate -p 127.0.0.1:3001:<容器内端口> <镜像>:<TAG>
```

- candidate 端口**只绑 `127.0.0.1`**，公网摸不到；旧容器照常服务，切换期间用户无感知。
- **隔离机制**：流量入口是 Nginx Proxy Manager（NPM）所在的 `npm-network`，candidate 不挂该网络 = 天然不接流量。
- **多容器项目**（前端按容器名反代后端，如 travel-plan 的 `proxy_pass http://travel-plan-api:8787`）：另建专用隔离网（如 `travel-plan-cand-net`），candidate 全挂上去，并给后端 candidate 加 `--network-alias <生产后端容器名>`。这样 candidate 前端的 proxy_pass 会解析到「新后端」，实现新栈全链路预验证；别名只在隔离网内生效，不与生产容器冲突。

### Step 3：预验证（闸门，任何一条挂 = 放弃本次发布）

```bash
# 1) 存活
curl -f http://127.0.0.1:3001/ || fail
# 2) 内容正确性（不是只看 200，要抽查关键内容标记）
curl -s http://127.0.0.1:3001/ | grep -q "关键标题/文案" || fail
# 3) SEO 资产（有公开站的查）
curl -s http://127.0.0.1:3001/sitemap.xml | grep -q "<正式域名>" || fail
# 4) 后端连通 + 配置完整（有后端的必查；health 返回里带密钥标志的连配置错误一起兜住）
curl -s http://127.0.0.1:3001/api/health | grep -q '"ok":true' || fail
```

`fail()` 行为：打印失败项 + 「发布中止，线上仍是旧版本」+ 清理 candidate 容器 + 退出码非 0。

### Step 4：原子切流

```bash
# 旧容器按「自身运行的镜像版本」改名留存（可并存多个历史版本）
docker stop <项目>-api && docker rename <项目>-api <项目>-api-old-<旧TAG>
docker stop <项目>     && docker rename <项目>     <项目>-old-<旧TAG>
# candidate 换正式名 → 接回 npm-network → 启动（先 API 后前端，前端 nginx 启动时要能解析上游名）
docker rename <项目>-api-candidate <项目>-api && docker network connect npm-network <项目>-api && docker start <项目>-api
docker rename <项目>-candidate     <项目>     && docker network connect npm-network <项目>     && docker start <项目>
```

- 切流窗口秒级（stop 旧 → start 新）。
- ⚠️ **切流后必须 reload NPM**：nginx 对按容器名的 upstream 是启动时解析一次，candidate 挂上 `npm-network` 后是新 IP，不 reload 公网就会继续打到旧 IP → 502。命令：`docker exec <npm容器> nginx -s reload`。**回滚时同理。**
- 切流后必须做**公网复验**（走正式域名 200 + 内容标记），不过关按发布失败处理。
- 旧容器留存 24 小时，确认无异常后由下一次部署的开头自动清理（脚本按容器创建时间判断超期）。

### Step 5：回滚（出问题时的三条命令）

```bash
docker stop <项目> && docker rm <项目>     # 只删失败的新版本容器
docker rename <项目>-old-<TAG> <项目> && docker start <项目>
docker exec <npm容器> nginx -s reload      # 别忘了
```

目标：10 秒内恢复旧版本。历史镜像（版本 tag）都留在本机，可回退到任意历史版本（`docker run` 指定历史 tag 手动兜底）。

---

## 三、三站差异

| 站点 | 形态 | Step 3 验证内容 | 特殊注意 |
|---|---|---|---|
| travel-plan | **双容器**：前端 Nginx + Node API（8787），无 DB | `/`、`/templates/`、模板页 200 + 标题标记；`/sitemap.xml` 含域名；`/api/health` 的 `ok` 与 `hasDeepSeekKey` | ✅ 已落地脚本；前端按容器名反代 API，candidate 需隔离网 + 别名（见 Step 2） |
| flexi-log-web | 容器 3000 | `/` 200 + 标题；`/sitemap.xml`；DB 连通冒烟 | compose 已有 healthcheck 可复用 |
| china-travel | 前端 + FastAPI 后端双容器 | 前端 `/` 200；后端 `/api/health` 200 | 有 Alembic，见第五节 |

实施顺序（风险从低到高）：**travel-plan（✅ 2026-09-29）→ flexi-log-web → china-travel**。后续可选：挂 gitee webhook 自动触发 deploy.sh，流程不变。

---

## 四、travel-plan 落地实现（本仓库）

### 日常操作

```bash
# 本地：改完代码，推送双远端（服务器只从 gitee 拉，两个都要推）
git push origin master && git push gitee master

# 服务器：部署（构建约数分钟，SSH 记得设长超时）
ssh root@huoshan "cd /opt/git/travel-plan && ./deploy.sh"

# 出问题：秒回滚（省略版本号 = 最近一次留存版本）
ssh root@huoshan "cd /opt/git/travel-plan && ./rollback.sh"
```

`deploy.sh --no-pull`：跳过 git pull 用当前工作区代码重建（修构建错误时用）。

### 关键参数

| 项 | 值 |
|---|---|
| 容器 | `travel-plan`（前端 Nginx:80）、`travel-plan-api`（Node:8787） |
| candidate | `travel-plan-candidate` / `travel-plan-api-candidate`，端口 `127.0.0.1:3001` / `127.0.0.1:8788`，隔离网 `travel-plan-cand-net` |
| 旧容器 | `travel-plan-old-<TAG>` / `travel-plan-api-old-<TAG>`，留存 24h |
| 正式域名 | `https://travel-plan.solalab.cn` |
| 镜像 tag | `YYYYMMDD-<短哈希>`，构建后同步进 `.env` 的 `IMAGE_TAG` |

### 预验证闸门（11 条）

首页 200 + 标题「AI 旅行规划与行程表制作工具」→ 看板页 `/app/` 200 + 标题「我的旅行行程表」→ 模板列表页 200 + 标记 → 成都模板页 200 + 标记 → `sitemap.xml` 200 + 含域名 → API 直连 `ok:true` → `hasDeepSeekKey:true` → 前端→API 全链路 `ok:true`。内容标记定义在脚本头部配置区，站点改版换标题时同步（SEO 首页标题以 `dist/index.html` 构建产物为准，不是源码 `index.html`）。

### 失败行为

- **candidate 阶段失败**（构建失败、起不来、任一闸门挂）：清理 candidate，线上零感知。
- **切流/复验阶段失败**（容器起不来、公网复验不过）：自动调用 `rollback.sh` 回滚到留存旧容器。

### ⚠️ 采用脚本后明确禁止

- **不得再对该站执行 `docker compose down` / `up`** —— 容器已由脚本用 docker run/rename 管理，compose down/up 会与「旧容器改名留存」机制打架。`docker compose build` 仍由脚本使用，无冲突。
- 回滚窗口（24h）内不得 `docker rm` 任何 `-old-*` 容器、不得 `docker rmi` 任何带版本 tag 的镜像。

### 首跑清单

1. 本脚本先提交并**推送双远端**（Gitee + GitHub），服务器首次需手动 `git pull` 一次。
2. 首跑即磨刀石：盯完整输出，确认每步 PASS。
3. 首次成功后演练闭环：`./rollback.sh` 验证 10 秒回滚 → `./deploy.sh --no-pull` 用同一 commit 部署回去。

---

## 五、数据库与迁移规则（china-travel 重点）

代码可回滚，数据库 schema 回滚不了——含 Alembic 迁移的发布，deploy.sh 必须在跑迁移前先备份：

```bash
docker exec <pg容器> pg_dump -U <user> <db> > backup_$(date +%Y%m%d-%H%M).sql
```

迁移失败的恢复路径 = 恢复备份 + 回滚容器，两件事都要在脚本里体现。flexi-log-web / travel-plan 无迁移机制，发布不触碰 schema。

## 六、本流程不解决的（边界，勿误判为脚本 bug）

| 风险 | 说明 |
|---|---|
| 环境配置错误 | `.env` 改坏，冒烟检查只能兜住大部分（travel-plan 已用 `hasDeepSeekKey` 兜住密钥丢失） |
| 长尾功能 bug | 预验证只抽查关键路径，不能替代人工点验 |
| 百度收录波动 | 与部署无关；域名 + 200 稳定即可，收录问题走 SEO 线处理 |

## 七、明确不做的事

- ❌ 不买腾讯服务器做测试站（冷启动期环境冗余 = 负债；理由：三站全是 Docker 隔离，更新本身不会打断线上，缺的只是回滚预案——本规范补上后无需第二台机器）
- ❌ 不用 `latest` tag 部署
- ❌ 旧容器/旧镜像在回滚窗口（24h）内不得 `docker rm` / `docker rmi`
- ❌ 未经 Step 3 验证的容器不得接入 `npm-network`
