#!/bin/bash
# 在本机执行:把珠象整套服务传到新服务器并启动。只连新服务器,不碰线上(Netlify / Supabase 云端)。
#   bash server/deploy.sh root@<服务器IP>            # 第一次:传代码 + 安装 + 启动
#   bash server/deploy.sh root@<服务器IP> --web-only # 之后只更新网页
# 网页用的是 ~/Dev/sbl-app/dist(先 npm run build),Supabase 官方部署文件第一次会自动从 GitHub 拉到本机再传上去
# (国内服务器访问 GitHub 不稳定,所以在本机拉)。
set -euo pipefail
HOST="${1:?用法: bash server/deploy.sh root@服务器IP [--web-only]}"
MODE="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
W="${SBL_APP_WORKSPACE:-$HOME/Dev/sbl-app}"
ZX=/srv/zhuxiang
# Supabase 官方自建配置,固定到一个版本(升级时改这里并在测试服上先试)
SUPABASE_REF="${SUPABASE_REF:-master}"
VENDOR="$HERE/vendor/supabase-docker"

[ -f "$W/dist/index.html" ] || { echo "✗ 缺 $W/dist,先在 $W 里 npm run build"; exit 1; }
ssh "$HOST" "mkdir -p $ZX/www $ZX/app $ZX/supabase/docker"

if [ "$MODE" != "--web-only" ]; then
  echo "1. 准备云函数"
  node "$HERE/fn/prepare.mjs"
  if [ ! -f "$VENDOR/docker-compose.yml" ]; then
    echo "2. 从 GitHub 拉 Supabase 官方 docker 目录($SUPABASE_REF)"
    T=$(mktemp -d)
    git clone --depth 1 --filter=blob:none --sparse -b "$SUPABASE_REF" https://github.com/supabase/supabase "$T/sb"
    (cd "$T/sb" && git sparse-checkout set docker && git rev-parse HEAD > "$T/sb/docker/.supabase-commit")
    mkdir -p "$(dirname "$VENDOR")"; mv "$T/sb/docker" "$VENDOR"
  fi
  echo "   Supabase 版本:$(cat "$VENDOR/.supabase-commit" 2>/dev/null || echo 未知)"
  echo "3. 上传服务端代码"
  rsync -az --delete --exclude vendor --exclude node_modules --exclude blobs-data "$HERE/" "$HOST:$ZX/app/"
  # 官方目录:不覆盖服务器上已经生成的 .env 和数据库数据
  rsync -az --exclude .env --exclude volumes/db/data --exclude volumes/storage "$VENDOR/" "$HOST:$ZX/supabase/docker/"
  ssh "$HOST" "chmod 700 $ZX/app/fn/functions"   # 里面有 _secrets.mjs
fi

echo "4. 上传网页(含报题语音库,第一次约 300MB)"
rsync -az --delete "$W/dist/" "$HOST:$ZX/www/"
[ -d "$HOME/Dev/zhuxiang-release/download" ] && rsync -az "$HOME/Dev/zhuxiang-release/download/" "$HOST:$ZX/www/download/"

if [ "$MODE" != "--web-only" ]; then
  echo "5. 安装并启动"
  ssh "$HOST" "bash $ZX/app/scripts/setup-server.sh"
fi
echo "✓ 完成"
