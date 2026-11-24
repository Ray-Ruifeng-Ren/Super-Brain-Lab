#!/bin/bash
# 应用商店截图(2026-11-08):需本地 dev 服务器(launch.json 的 sbl-w,端口 5222)在跑;场景在 src/pages/DevShots.tsx。
# 输出 ~/Desktop/珠象-安卓上架材料/截图/{横屏1920x1080,平板2560x1600}/ 与 Google Play 置顶大图 1024x500。
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$HOME/Desktop/珠象-安卓上架材料/截图"; mkdir -p "$OUT/横屏1920x1080" "$OUT/平板2560x1600"
shot() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size="$2" --virtual-time-budget=6000 --screenshot="$3" "http://localhost:5222/dev/shots/$1" >/dev/null 2>&1; echo "$3"; }
i=1; for s in flash teach coach teachmul contest exam; do
  shot $s 1920,1080 "$OUT/横屏1920x1080/$i-$s.png"; shot $s 2560,1600 "$OUT/平板2560x1600/$i-$s.png"; i=$((i+1)); done
shot feature 1024,500 "$OUT/GooglePlay置顶大图-1024x500.png"
