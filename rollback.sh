#!/usr/bin/env bash
#
# travel-plan 秒回滚：恢复最近一次（或指定版本的）留存旧容器，目标 10 秒内完成。
# （Sola Lab 部署规范 Step 5；deploy.sh 切流/复验失败时也会自动调用本脚本）
#
# 用法（火山机 /opt/git/travel-plan 下执行）：
#   ./rollback.sh               # 回滚到最新的留存旧版本
#   ./rollback.sh 20260929-abc  # 回滚到指定版本的留存旧容器
#
# 说明：
#   - 只删除「失败的新版本」容器（正式名容器）；travel-plan-old-* / travel-plan-api-old-*
#     是回滚资本，本脚本只在恢复它们时改名，绝不删除。
#   - 回滚会消耗掉这对留存旧容器：回滚完成后、下次成功部署之前，没有二次回滚点
#     （历史镜像都留在本机，可指定任意历史 tag 手动 docker run 兜底）。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

WEB_CONTAINER="travel-plan"
API_CONTAINER="travel-plan-api"
OLD_WEB_PREFIX="travel-plan-old-"
OLD_API_PREFIX="travel-plan-api-old-"
CAND_WEB="travel-plan-candidate"
CAND_API="travel-plan-api-candidate"
NPM_NETWORK="${NPM_NETWORK_NAME:-npm-network}"
CAND_NET="travel-plan-cand-net"
PUBLIC_URL="https://travel-plan.solalab.cn"
MARKER_HOME="AI 旅行规划与行程表制作工具"

die()  { echo "❌ $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

container_exists() { docker ps -a --format '{{.Names}}' | grep -qxF "$1"; }
http_body() { curl -sf --max-time 10 "$1" 2>/dev/null || true; }

# 防并发：deploy.sh 用 .deploy.lock，这里独立锁，互不干扰
if command -v flock >/dev/null 2>&1; then
  exec 9>"$ROOT/.rollback.lock"
  flock -n 9 || die "已有 rollback.sh 在运行"
fi

# ---------- 0. 清理 candidate 残留（candidate 永远可删） ----------
docker rm -f "$CAND_WEB" "$CAND_API" >/dev/null 2>&1 || true
docker network rm "$CAND_NET" >/dev/null 2>&1 || true

# ---------- 1. 定位要恢复的旧容器 ----------
step "[1/4] 定位回滚目标"
if [ -n "${1:-}" ]; then
  SUFFIX="$1"
  printf '%s' "$SUFFIX" | grep -qE '^[A-Za-z0-9._-]+$' || die "非法版本号：$SUFFIX"
else
  newest="$(docker ps -a --filter "name=${OLD_WEB_PREFIX}" --format '{{.Names}}\t{{.CreatedAt}}' | sort -t "$(printf '\t')" -k2 | tail -1 | cut -f1 || true)"
  [ -n "$newest" ] || die "没有可回滚的留存旧容器（${OLD_WEB_PREFIX}*）。历史镜像仍在本机，可指定 tag 手动 docker run 兜底。"
  SUFFIX="${newest#${OLD_WEB_PREFIX}}"
fi

WEB_OLD="${OLD_WEB_PREFIX}${SUFFIX}"
API_OLD="${OLD_API_PREFIX}${SUFFIX}"
if ! container_exists "$WEB_OLD" || ! container_exists "$API_OLD"; then
  echo "可用的留存旧容器：" >&2
  docker ps -a --filter "name=${OLD_WEB_PREFIX}" --format '  {{.Names}}' >&2
  docker ps -a --filter "name=${OLD_API_PREFIX}" --format '  {{.Names}}' >&2
  die "找不到配对的 $WEB_OLD + $API_OLD（留存期只有 24h，可能已过期被 deploy.sh 清理）"
fi
echo "  回滚目标：$SUFFIX"

# ---------- 2. 摘掉失败的新版本（只动正式名容器，不碰 -old-） ----------
step "[2/4] 移除当前版本"
for c in "$API_CONTAINER" "$WEB_CONTAINER"; do
  if container_exists "$c"; then
    docker rm -f "$c" >/dev/null
    echo "  已移除 $c"
  fi
done

# ---------- 3. 恢复旧容器（先 API 后前端，前端 nginx 启动时要能解析上游名） ----------
step "[3/4] 恢复 $SUFFIX"
docker rename "$API_OLD" "$API_CONTAINER"
docker network connect "$NPM_NETWORK" "$API_CONTAINER" 2>/dev/null || true
docker start "$API_CONTAINER" >/dev/null

i=0
until printf '%s' "$(docker exec "$API_CONTAINER" wget -qO- "http://127.0.0.1:8787/api/health" 2>/dev/null || true)" | grep -q '"ok":true'; do
  i=$((i + 1))
  [ "$i" -ge 30 ] && die "回滚后 API 健康检查未通过，请人工查看：docker logs $API_CONTAINER"
  sleep 1
done

docker rename "$WEB_OLD" "$WEB_CONTAINER"
docker network connect "$NPM_NETWORK" "$WEB_CONTAINER" 2>/dev/null || true
docker start "$WEB_CONTAINER" >/dev/null
echo "  ✅ 已恢复 $WEB_CONTAINER + $API_CONTAINER（版本 $SUFFIX）"

# ---------- 4. reload NPM + 公网复验 ----------
step "[4/4] 复验"
# .env 的 IMAGE_TAG 同步回滚后的版本，保持「.env 指向线上版本」的约定
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$SUFFIX/" "$ROOT/.env" 2>/dev/null || true

npm_c="$(docker ps --format '{{.Names}}\t{{.Image}}' | awk -F'\t' '$2 ~ /jc21\/nginx-proxy-manager/ {print $1; exit}' || true)"
if [ -n "$npm_c" ] && docker exec "$npm_c" nginx -s reload >/dev/null 2>&1; then
  echo "  ✅ 已 reload $npm_c"
else
  echo "  ⚠️ 未能自动 reload NPM，公网可能短暂指向旧容器 IP，必要时手动 reload"
fi

public_ok=0
for _ in 1 2 3; do
  if printf '%s' "$(http_body "$PUBLIC_URL/")" | grep -q "$MARKER_HOME" \
    && printf '%s' "$(http_body "$PUBLIC_URL/api/health")" | grep -q '"ok":true'; then
    public_ok=1
    break
  fi
  sleep 2
done
if [ "$public_ok" != 1 ]; then
  die "容器已恢复为 $SUFFIX 且本机健康，但公网 $PUBLIC_URL 复验未通过 —— 请检查 Nginx Proxy Manager 的 upstream 指向"
fi

echo
echo "✅ 回滚完成：线上已恢复到 $SUFFIX"
echo "   被替换的失败版本容器已删除（镜像仍在，可 docker run 排查）"
echo "   注意：留存旧容器已消耗，下次成功部署前没有二次回滚点。"
