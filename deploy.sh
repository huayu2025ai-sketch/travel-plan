#!/usr/bin/env bash
#
# travel-plan 线上部署：预验证 + 原子切流 + 秒回滚
# （Sola Lab 部署规范 2026-09-28：验证发生在切流之前；切流可逆）
#
# 用法（火山机 /opt/git/travel-plan 下执行）：
#   ./deploy.sh              # git pull → 构建新版 → 预验证 → 切流
#   ./deploy.sh --no-pull    # 跳过 git pull，用当前工作区代码重建（修构建错误时用）
#
# 前置：本地已把代码 push 到 origin 和 gitee 两个远端（服务器只从 gitee 拉）。
#
# ⚠️ 采用本脚本后，不要再对线上容器执行 docker compose down/up —— 容器已改由
#    本脚本用 docker run/rename 管理，compose down/up 会与「旧容器改名留存」
#    机制打架。docker compose build 仍由本脚本使用，无冲突。
#
# candidate 不发布宿主机端口：切流用 rename 晋升 candidate，-p 端口绑定会跟着
# 容器进生产并长期占用，下一轮 candidate 就无端口可用。预验证一律 docker exec
# 进容器内探测——生产流量本就走 npm-network（无宿主端口），容器内路径更真实。
#
# 失败行为：
#   candidate 阶段失败 → 清理 candidate，线上零感知，仍是旧版本
#   切流/复验阶段失败 → 自动调用 rollback.sh 回滚到留存旧容器

set -Eeuo pipefail

# ---------- 配置 ----------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

WEB_CONTAINER="travel-plan"
API_CONTAINER="travel-plan-api"
CAND_WEB="travel-plan-candidate"
CAND_API="travel-plan-api-candidate"
OLD_WEB_PREFIX="travel-plan-old-"       # 旧容器命名：travel-plan-old-<版本tag>
OLD_API_PREFIX="travel-plan-api-old-"
NPM_NETWORK="${NPM_NETWORK_NAME:-npm-network}"
CAND_NET="travel-plan-cand-net"         # candidate 专用隔离网络，不接公网流量
PUBLIC_URL="https://travel-plan.solalab.cn"
RETENTION_SECONDS=$((24 * 3600))        # 旧容器留存窗口，窗口内绝不删除

# 预验证内容标记（站点改版换了标题时同步这里）
MARKER_HOME="AI 旅行规划与行程表制作工具"   # SEO 首页（构建生成）
MARKER_APP="我的旅行行程表"                 # 看板应用页 /app/
MARKER_TPL_INDEX="旅行行程模板"
TPL_PAGE="/templates/chengdu-2-days/"
MARKER_TPL_PAGE="成都慢节奏两日游"
MARKER_SITEMAP="travel-plan.solalab.cn"

# ---------- 运行状态 ----------
PHASE="pre"       # pre → build → candidate → cutover → verify → done
TAG=""
OLD_SUFFIX=""     # 切流时旧容器使用的版本后缀，供自动回滚定位

# ---------- 基础工具 ----------
die()  { echo "❌ $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

container_exists() { docker ps -a --format '{{.Names}}' | grep -qxF "$1"; }
container_running() { [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }
image_suffix() { # 容器正在运行的 image tag，如 20260929-abc1234
  local img
  img="$(docker inspect -f '{{.Config.Image}}' "$1")"
  printf '%s' "${img##*:}"
}

# 取响应体再匹配，避免 `curl | grep -q` 在 pipefail 下因 SIGPIPE 产生假阴性
http_body() { curl -sf --max-time 10 "$1" 2>/dev/null || true; }
has_marker() { printf '%s' "$(http_body "$1")" | grep -q "$2"; }

# candidate 预验证从容器内发请求（两个镜像都含 busybox wget，切流后复验已在用）
cand_web_body() { docker exec "$CAND_WEB" wget -q -T 10 -O - "$1" 2>/dev/null || true; }
cand_api_body() { docker exec "$CAND_API" wget -q -T 10 -O - "$1" 2>/dev/null || true; }
cand_web_ok()     { docker exec "$CAND_WEB" wget -q -T 10 -O /dev/null "$1" 2>/dev/null; }
cand_marker_web() { printf '%s' "$(cand_web_body "$1")" | grep -q "$2"; }
cand_marker_api() { printf '%s' "$(cand_api_body "$1")" | grep -q "$2"; }

wait_in_container() { # <容器名> <容器内URL> [最大秒数]
  local i=0
  until docker exec "$1" wget -q -T 3 -O /dev/null "$2" 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -ge "${3:-30}" ] && return 1
    sleep 1
  done
}

# 预验证闸门：任何一条失败 → 打印原因、清理 candidate、线上保持旧版本
fail() {
  echo "  ❌ $1"
  echo
  echo "🛑 发布中止，线上仍是旧版本。candidate 已清理。"
  exit 1
}
gate() { # <描述> <检查函数> <参数...>
  local desc="$1"
  shift
  if "$@"; then
    echo "  ✅ $desc"
  else
    fail "预验证失败：$desc"
  fi
}
# 注：预验证不发布宿主端口，200 状态闸门用 cand_web_ok（busybox wget 对 4xx/5xx
# 返回非零），内容闸门用 cand_marker_*，全部从 candidate 容器内发请求

# 退出兜底：只删 candidate 容器。隔离网（cand-net）必须保留：candidate 切流时经
# rename 晋升，NetworkMode 永远指向该网，删网后容器（含未来的回滚目标）就无法
# docker start——2026-09-30 实机踩中，自动回滚因此失败
cleanup_candidates() {
  docker rm -f "$CAND_WEB" "$CAND_API" >/dev/null 2>&1 || true
}
trap cleanup_candidates EXIT

# 非预期错误兜底：candidate 阶段仅报告；切流/复验阶段自动回滚
on_err() {
  local rc="$1"
  echo
  echo "❌ deploy.sh 在阶段 [$PHASE] 意外失败（退出码 $rc）"
  local need_rollback=0
  if [ "$PHASE" = "verify" ]; then
    need_rollback=1                       # 新版已上线但复验失败 → 必须回滚
  elif [ "$PHASE" = "cutover" ] && [ -n "$OLD_SUFFIX" ]; then
    need_rollback=1                       # 旧容器已改名 = 切流已开始，此后任何失败都回滚
  elif [ "$PHASE" = "cutover" ] && ! container_running "$WEB_CONTAINER"; then
    need_rollback=1                       # 首次部署（无旧容器）切流断档 → 只能报错
  fi
  if [ "$need_rollback" = 1 ]; then
    if [ -n "$OLD_SUFFIX" ] && container_exists "${OLD_WEB_PREFIX}${OLD_SUFFIX}"; then
      echo "↩️ 自动回滚到 ${OLD_WEB_PREFIX}${OLD_SUFFIX} ..."
      "$ROOT/rollback.sh" "$OLD_SUFFIX" || echo "‼️ 自动回滚也未成功，需人工介入（docker ps / docker logs 排查现场）"
    else
      echo "‼️ 没有可回滚的留存旧容器（首次部署？），请按上方报错人工处理现场"
    fi
  else
    echo "线上容器未受影响，仍是旧版本。candidate 已清理。"
  fi
  exit "$rc"
}
trap 'on_err $?' ERR

# reload NPM：切流后上游容器 IP 变了，nginx 启动时缓存的旧 IP 不 reload 就会 502
reload_npm() {
  local npm_c
  npm_c="$(docker ps --format '{{.Names}}\t{{.Image}}' | awk -F'\t' '$2 ~ /jc21\/nginx-proxy-manager/ {print $1; exit}' || true)"
  if [ -z "$npm_c" ]; then
    echo "  ⚠️ 未找到 Nginx Proxy Manager 容器，请手动 reload（否则公网可能仍指向旧容器 IP）"
    return 1
  fi
  local err
  if err="$(docker exec "$npm_c" nginx -s reload 2>&1)"; then
    echo "  ✅ 已 reload $npm_c（上游 DNS 重新解析）"
  else
    echo "  ⚠️ docker exec $npm_c nginx -s reload 失败：$err"
    echo "     （多为无关站点死 upstream 卡住整体 reload，需清理 NPM 死配置）"
    return 1
  fi
}

# ---------- 参数 ----------
PULL=1
case "${1:-}" in
  "")        ;;
  --no-pull) PULL=0 ;;
  *)         die "用法：./deploy.sh [--no-pull]" ;;
esac

# 防并发（rollback.sh 用独立的 .rollback.lock，不与这里互斥：自动回滚要从 deploy 内调用）
if command -v flock >/dev/null 2>&1; then
  exec 9>"$ROOT/.deploy.lock"
  flock -n 9 || die "已有 deploy.sh 在运行"
fi

# ---------- Step 0：预检 ----------
step "[0/6] 预检"
command -v docker >/dev/null || die "服务器上没有 docker"
docker compose version >/dev/null 2>&1 || die "服务器上没有 docker compose"
[ -f "$ROOT/.env" ] || die "缺少 .env"
grep -q '^DEEPSEEK_API_KEY=..*' "$ROOT/.env" || die ".env 缺少 DEEPSEEK_API_KEY"

if [ "$PULL" = 1 ]; then
  script_sum="$(md5sum "$0" 2>/dev/null | cut -d" " -f1 || true)"
  git pull --ff-only || die "git pull 失败：服务器工作区改动与远端冲突，请人工处理后重试"
  # pull 更新了 deploy.sh 自身时，旧代码可能已在运行中；re-exec 保证全程跑的是最新逻辑
  if [ -n "$script_sum" ] && [ "$(md5sum "$0" 2>/dev/null | cut -d" " -f1)" != "$script_sum" ]; then
    echo "  ↻ deploy.sh 已被更新，重启执行最新版本"
    exec bash "$0" "$@"
  fi
fi
if ! git diff --quiet; then
  echo "  ⚠️ 服务器工作区有未提交改动（若涉及 Dockerfile/compose 请确认是有意覆盖）"
fi

TAG="$(TZ=Asia/Shanghai date +%Y%m%d)-$(git rev-parse --short HEAD)"
echo "  本次版本：$TAG"

# ---------- Step 1：清理上一轮残留 ----------
step "[1/6] 清理残留"
# 上一轮中断的 candidate（candidate 永远可删）
docker rm -f "$CAND_WEB" "$CAND_API" >/dev/null 2>&1 || true
# 超过 24h 留存窗口的旧容器（窗口内绝不删除）
now=$(date +%s)
for name in $(docker ps -a --filter "name=${OLD_WEB_PREFIX}" --format '{{.Names}}'; docker ps -a --filter "name=${OLD_API_PREFIX}" --format '{{.Names}}'); do
  created_ts="$(date -u -d "$(docker inspect -f '{{.Created}}' "$name")" +%s 2>/dev/null || echo 0)"
  if [ "$created_ts" -gt 0 ] && [ $((now - created_ts)) -gt "$RETENTION_SECONDS" ]; then
    docker rm "$name" >/dev/null
    echo "  🗑️ 已清理超过留存窗口的 $name"
  fi
done
docker image prune -f >/dev/null 2>&1 || true   # 只清悬空层，带 tag 的镜像一律保留
echo "  ✅ 清理完成"

# ---------- Step 2：构建带版本 tag 的镜像 ----------
PHASE="build"
step "[2/6] 构建镜像 $TAG"
docker compose config --quiet || die "docker compose config 校验失败（检查 .env 变量是否齐全）"
IMAGE_TAG="$TAG" docker compose build 2>&1 | tail -5
docker image inspect "travel-plan:$TAG" >/dev/null 2>&1 || die "前端镜像构建失败：travel-plan:$TAG 不存在"
docker image inspect "travel-plan-api:$TAG" >/dev/null 2>&1 || die "API 镜像构建失败：travel-plan-api:$TAG 不存在"
# 同步 .env 的 IMAGE_TAG，保证任何时候 .env 都指向当前线上版本
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" "$ROOT/.env"
grep -q '^IMAGE_TAG=' "$ROOT/.env" || echo "IMAGE_TAG=$TAG" >> "$ROOT/.env"
echo "  ✅ travel-plan:$TAG 与 travel-plan-api:$TAG 构建完成"

# ---------- Step 3：隔离网络起 candidate（不接流量、不占宿主机端口） ----------
PHASE="candidate"
step "[3/6] 启动 candidate（隔离网络，不接公网流量）"
docker network inspect "$CAND_NET" >/dev/null 2>&1 || docker network create "$CAND_NET" >/dev/null

# API candidate：挂在隔离网络并用别名 travel-plan-api，让 candidate 前端的
# proxy_pass（按容器名解析）指向「新 API」，实现新栈全链路预验证。
# 不带 -p：切流 rename 会把端口绑定带进生产，预验证走 docker exec 容器内探测
docker run -d --name "$CAND_API" \
  --network "$CAND_NET" --network-alias "$API_CONTAINER" \
  --restart unless-stopped \
  --env-file "$ROOT/.env" \
  -e NODE_ENV=production -e API_PORT=8787 -e TZ=Asia/Shanghai -e TRUST_PROXY=1 \
  "travel-plan-api:$TAG" >/dev/null
wait_in_container "$CAND_API" "http://127.0.0.1:8787/api/health" 30 \
  || fail "API candidate 30 秒内未就绪（docker logs $CAND_API）"

# 前端 candidate（--restart 会随 rename 带进生产，补上 compose 的自愈语义）
docker run -d --name "$CAND_WEB" \
  --network "$CAND_NET" \
  --restart unless-stopped \
  "travel-plan:$TAG" >/dev/null
wait_in_container "$CAND_WEB" "http://127.0.0.1/" 30 \
  || fail "前端 candidate 30 秒内未就绪（docker logs $CAND_WEB）"
echo "  candidate 已启动（隔离网内容器自检，不占宿主机端口）"

# ---------- Step 4：预验证闸门 ----------
step "[4/6] 预验证（任何一条失败 = 放弃本次发布）"
WEB_URL="http://127.0.0.1"         # candidate 前端（容器内）
API_URL="http://127.0.0.1:8787"    # candidate API（容器内）

gate "前端首页 200"                              cand_web_ok "$WEB_URL/"
gate "首页内容正确（含「$MARKER_HOME」）"          cand_marker_web "$WEB_URL/" "$MARKER_HOME"
gate "看板应用页 /app/ 200"                       cand_web_ok "$WEB_URL/app/"
gate "看板页内容（含「$MARKER_APP」）"             cand_marker_web "$WEB_URL/app/" "$MARKER_APP"
gate "模板列表页 200"                             cand_web_ok "$WEB_URL/templates/"
gate "模板列表页内容（含「$MARKER_TPL_INDEX」）"   cand_marker_web "$WEB_URL/templates/" "$MARKER_TPL_INDEX"
gate "模板详情页 $TPL_PAGE 200"                   cand_web_ok "$WEB_URL$TPL_PAGE"
gate "模板详情页内容（含「$MARKER_TPL_PAGE」）"    cand_marker_web "$WEB_URL$TPL_PAGE" "$MARKER_TPL_PAGE"
gate "sitemap.xml 200"                            cand_web_ok "$WEB_URL/sitemap.xml"
gate "sitemap 含正式域名"                         cand_marker_web "$WEB_URL/sitemap.xml" "$MARKER_SITEMAP"
gate "API 健康（candidate 直连）"                 cand_marker_api "$API_URL/api/health" '"ok":true'
gate "API 密钥已注入（hasDeepSeekKey）"           cand_marker_api "$API_URL/api/health" '"hasDeepSeekKey":true'
# 全链路：candidate 前端 → proxy_pass 按容器名 → 新 API candidate，等价验证线上链路
gate "前端→API 全链路（新栈自洽）"                cand_marker_web "$WEB_URL/api/health" '"ok":true'

echo
echo "  ✅ 预验证全部通过"

# ---------- Step 5：原子切流 ----------
PHASE="cutover"
step "[5/6] 原子切流（切流窗口秒级）"

unique_old_name() { # <带前缀的基础名> → 重名时追加 -2、-3
  local base="$1" name="$1" i=2
  while container_exists "$name"; do
    name="${base}-$i"
    i=$((i + 1))
  done
  printf '%s' "$name"
}

# 5.1 旧容器改名留存。配对后缀取自旧前端镜像的 tag（前后端同次构建，tag 一致），
#     回滚按该后缀找回一对旧容器。
PAIR_SUFFIX=""
if container_exists "$WEB_CONTAINER"; then
  PAIR_SUFFIX="$(image_suffix "$WEB_CONTAINER")"
elif container_exists "$API_CONTAINER"; then
  PAIR_SUFFIX="$(image_suffix "$API_CONTAINER")"
fi

if [ -n "$PAIR_SUFFIX" ]; then
  OLD_SUFFIX="$PAIR_SUFFIX"
  old_api_name="$(unique_old_name "${OLD_API_PREFIX}${PAIR_SUFFIX}")"
  old_web_name="$(unique_old_name "${OLD_WEB_PREFIX}${PAIR_SUFFIX}")"
  if container_exists "$API_CONTAINER"; then
    if container_running "$API_CONTAINER"; then docker stop -t 15 "$API_CONTAINER" >/dev/null; fi
    docker rename "$API_CONTAINER" "$old_api_name"
    echo "  旧 API 留存为 $old_api_name"
  fi
  if container_exists "$WEB_CONTAINER"; then
    if container_running "$WEB_CONTAINER"; then docker stop -t 15 "$WEB_CONTAINER" >/dev/null; fi
    docker rename "$WEB_CONTAINER" "$old_web_name"
    echo "  旧前端留存为 $old_web_name"
  fi
else
  OLD_SUFFIX=""
  echo "  ℹ️ 首次部署：线上无旧容器，直接上线"
fi

# 5.2 API：candidate 摘下隔离网 → 换正式名 → 接回 npm-network → 先启动（前端 nginx 要解析它）
docker stop -t 15 "$CAND_API" >/dev/null
docker rename "$CAND_API" "$API_CONTAINER"
docker network disconnect "$CAND_NET" "$API_CONTAINER" >/dev/null
docker network connect "$NPM_NETWORK" "$API_CONTAINER" >/dev/null
docker start "$API_CONTAINER" >/dev/null
i=0
until docker exec "$API_CONTAINER" wget -qO- "http://127.0.0.1:8787/api/health" 2>/dev/null | grep -q '"ok":true'; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then echo "新 API 健康检查超时" >&2; false; fi
  sleep 1
done
echo "  ✅ 新 API 已上线（$API_CONTAINER）"

# 5.3 前端：同上，API 健康后再启动（nginx 启动时要能解析上游容器名）
docker stop -t 15 "$CAND_WEB" >/dev/null
docker rename "$CAND_WEB" "$WEB_CONTAINER"
docker network disconnect "$CAND_NET" "$WEB_CONTAINER" >/dev/null
docker network connect "$NPM_NETWORK" "$WEB_CONTAINER" >/dev/null
docker start "$WEB_CONTAINER" >/dev/null
echo "  ✅ 新前端已上线（$WEB_CONTAINER）"

# ---------- Step 6：切流后复验（公网） ----------
PHASE="verify"
step "[6/6] 切流后复验"
reload_npm || true

has_marker_ok() { printf '%s' "$(docker exec "$WEB_CONTAINER" wget -qO- "$1" 2>/dev/null || true)" | grep -q "$2"; }
has_marker_ok "http://127.0.0.1/" "$MARKER_HOME" || { echo "容器内首页校验失败" >&2; false; }
has_marker_ok "http://127.0.0.1/api/health" '"ok":true' || { echo "容器内 API 校验失败" >&2; false; }
echo "  ✅ 容器内检查通过"

public_ok=0
for _ in 1 2 3; do
  if has_marker "$PUBLIC_URL/" "$MARKER_HOME" && has_marker "$PUBLIC_URL/api/health" '"ok":true'; then
    public_ok=1
    break
  fi
  sleep 2
done
if [ "$public_ok" != 1 ]; then
  echo "公网 $PUBLIC_URL 复验未通过（多为 NPM 上游解析问题）" >&2
  false   # 触发 ERR 兜底 → 自动回滚
fi
echo "  ✅ 公网复验通过：$PUBLIC_URL"

# ---------- 完成 ----------
PHASE="done"
step "部署完成"
echo "  版本：$TAG"
if [ -n "$OLD_SUFFIX" ]; then
  echo "  旧版本：${OLD_WEB_PREFIX}${OLD_SUFFIX} / ${OLD_API_PREFIX}${OLD_SUFFIX}"
  echo "          留存 24h（至 $(TZ=Asia/Shanghai date -d '+24 hours' '+%Y-%m-%d %H:%M' 2>/dev/null || echo '明日此时')），窗口内勿删"
  echo "  回滚命令：./rollback.sh              # 恢复到 $OLD_SUFFIX"
  echo "            ./rollback.sh <历史版本>   # 回退到任意历史留存版本"
fi
