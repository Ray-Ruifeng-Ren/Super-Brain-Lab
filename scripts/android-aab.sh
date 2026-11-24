#!/bin/bash
# Google Play 上架包 AAB(2026-11-08):同 android-apk.sh 的签名(release key 兼作 Play 上传密钥),输出到 ~/Desktop/珠象-安卓上架材料/安装包/
set -e
W="${SBL_APP_WORKSPACE:-$HOME/Dev/sbl-app}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
cd "$W/android"
./gradlew bundleRelease --no-daemon -q
V=$(grep -o 'versionName "[^"]*"' app/build.gradle | cut -d'"' -f2)
OUT="$HOME/Desktop/珠象-安卓上架材料/安装包"; mkdir -p "$OUT"
cp app/build/outputs/bundle/release/app-release.aab "$OUT/珠象-GooglePlay-v$V.aab"
echo "AAB: $OUT/珠象-GooglePlay-v$V.aab"
