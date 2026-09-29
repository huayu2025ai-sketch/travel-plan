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
CAND_WEB_PORT=3001                      # candidate 预验证端口（仅绑定 127.0.0.1）
CAND_API_PORT=8788
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
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# 取响应体再匹配，避免 `curl | grep -q` 在 pipefail 下因 SIGPIPE 产生假阴性
http_body() { curl -sf --max-time 10 "$1" 2>/dev/null || true; }
has_marker() { printf '%s' "$(http_body "$1")" | grep -q "$2"; }

wait_http() { # <url> [最大秒数]
  local i=0
  until curl -sf --max-time 3 "$1" >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -ge "${2:-30}" ] && return 1
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
gate_status() { [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1")" = "200" ]; }
gate() { # <描述> <检查函数> <参数...>
  local desc="$1"
  shift
  if "$@"; then
    echo "  ✅ $desc"
  else
    fail "预验证失败：$desc"
  fi
}

# 退出兜底：删除 candidate 容器与隔离网络（切流完成后两者已改名/解绑，此操作为无害空转）
cleanup_candidates() {
  docker rm -f "$CAND_WEB" "$CAND_API" >/dev/null 2>&1 || true
  docker network rm "$CAND_NET" >/dev/null 2>&1 || true
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
  elif [ "$PHASE" = "cutover" ] && ! container_running "$WEB_CONTAINER"; then
    need_rollback=1                       # 切流中途断档且旧版未在跑 → 回滚
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
  if docker exec "$npm_c" nginx -s reload >/dev/null 2>&1; then
    echo "  ✅ 已 reload $npm_c（上游 DNS 重新解析）"
  else
    echo "  ⚠️ docker exec $npm_c nginx -s reload 失败，请手动 reload NPM"
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

# ---------- Step 3：隔离网络起 candidate（不接流量） ----------
PHASE="candidate"
step "[3/6] 启动 candidate（隔离网络，不接公网流量）"
for port in "$CAND_WEB_PORT" "$CAND_API_PORT"; do
  if port_busy "$port"; then
    die "端口 $port 已被占用，先排查：ss -ltnp | grep $port"
  fi
done

docker network inspect "$CAND_NET" >/dev/null 2>&1 || docker network create "$CAND_NET" >/dev/null

# API candidate：挂在隔离网络并用别名 travel-plan-api，让 candidate 前端的
# proxy_pass（按容器名解析）指向「新 API」，实现新栈全链路预验证
docker run -d --name "$CAND_API" \
  --network "$CAND_NET" --network-alias "$API_CONTAINER" \
  -p "127.0.0.1:${CAND_API_PORT}:8787" \
  --env-file "$ROOT/.env" \
  -e NODE_ENV=production -e API_PORT=8787 -e TZ=Asia/Shanghai -e TRUST_PROXY=1 \
  "travel-plan-api:$TAG" >/dev/null
wait_http "http://127.0.0.1:${CAND_API_PORT}/api/health" 30 \
  || fail "API candidate 30 秒内未就绪（docker logs $CAND_API）"

# 前端 candidate
docker run -d --name "$CAND_WEB" \
  --network "$CAND_NET" \
  -p "127.0.0.1:${CAND_WEB_PORT}:80" \
  "travel-plan:$TAG" >/dev/null
wait_http "http://127.0.0.1:${CAND_WEB_PORT}/" 30 \
  || fail "前端 candidate 30 秒内未就绪（docker logs $CAND_WEB）"
echo "  candidate 已启动：127.0.0.1:${CAND_WEB_PORT}（前端）/ 127.0.0.1:${CAND_API_PORT}（API）"

# ---------- Step 4：预验证闸门 ----------
step "[4/6] 预验证（任何一条失败 = 放弃本次发布）"
CAND_URL="http://127.0.0.1:${CAND_WEB_PORT}"
API_URL="http://127.0.0.1:${CAND_API_PORT}"

gate "前端首页 200"                              gate_status "$CAND_URL/"
gate "首页内容正确（含「$MARKER_HOME」）"          has_marker "$CAND_URL/" "$MARKER_HOME"
gate "看板应用页 /app/ 200"                       gate_status "$CAND_URL/app/"
gate "看板页内容（含「$MARKER_APP」）"             has_marker "$CAND_URL/app/" "$MARKER_APP"
gate "模板列表页 200"                             gate_status "$CAND_URL/templates/"
gate "模板列表页内容（含「$MARKER_TPL_INDEX」）"   has_marker "$CAND_URL/templates/" "$MARKER_TPL_INDEX"
gate "模板详情页 $TPL_PAGE 200"                   gate_status "$CAND_URL$TPL_PAGE"
gate "模板详情页内容（含「$MARKER_TPL_PAGE」）"    has_marker "$CAND_URL$TPL_PAGE" "$MARKER_TPL_PAGE"
gate "sitemap.xml 200"                            gate_status "$CAND_URL/sitemap.xml"
gate "sitemap 含正式域名"                         has_marker "$CAND_URL/sitemap.xml" "$MARKER_SITEMAP"
gate "API 健康（candidate 直连）"                 has_marker "$API_URL/api/health" '"ok":true'
gate "API 密钥已注入（hasDeepSeekKey）"           has_marker "$API_URL/api/health" '"hasDeepSeekKey":true'
# 全链路：candidate 前端 → proxy_pass 按容器名 → 新 API candidate，等价验证线上链路
gate "前端→API 全链路（新栈自洽）"                has_marker "$CAND_URL/api/health" '"ok":true'

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
