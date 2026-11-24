#!/bin/bash
# 安卓 Pad 版正式包(2026-11-02):先 bash scripts/app-sync.sh 同步,再在工作区出 release APK(签名密钥 ~/Dev/zhuxiang-signing(备份 ~/Documents/珠象安卓签名备份;app-sync 的 rsync --delete 会删工作区里源码没有的目录,所以密钥不能放工作区))
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
W="${SBL_APP_WORKSPACE:-$HOME/Dev/sbl-app}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
cd "$W/android"
./gradlew assembleRelease --no-daemon -q
V=$(grep -o 'versionName "[^"]*"' app/build.gradle | cut -d'"' -f2)
OUT="$HOME/Desktop/珠象-安卓Pad-v$V.apk"
cp app/build/outputs/apk/release/app-release.apk "$OUT"
echo "APK: $OUT"
# 2026-11-03 固定下载链接 https://superbrainlab.org/download/(用户「做一个链接,把最新安装包放上面」):
# 拷到 ~/Dev/zhuxiang-release/download/,下次 netlify-deploy-api.mjs 发布时一起上线
R="$HOME/Dev/zhuxiang-release/download"; mkdir -p "$R"
cp "$OUT" "$R/zhuxiang-pad.apk"
SIZE=$(du -m "$R/zhuxiang-pad.apk" | cut -f1); DATE=$(date "+%Y-%m-%d")
sed -e "s/__VER__/$V/g" -e "s/__SIZE__/$SIZE/g" -e "s/__DATE__/$DATE/g" "$HERE/download-page.html" > "$R/index.html"
echo "download page: $R (v$V, ${SIZE}MB)"

