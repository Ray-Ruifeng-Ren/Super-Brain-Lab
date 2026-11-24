#!/bin/bash
# App 壳构建工作区同步(2026-10-15):Desktop 项目在 iCloud 里,node_modules 会被驱逐、Xcode/Capacitor 跑不动,
# 所以 Capacitor/Xcode 的活在 ~/Dev/sbl-app(不在 iCloud)做。源码以 Desktop 为准,这里只是单向同步过去再构建。
# 用法:bash scripts/app-sync.sh            # 同步源码 + 构建 app-www + cap sync ios
#      bash scripts/app-sync.sh --open     # 同步后再用 Xcode 打开
set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
W="${SBL_APP_WORKSPACE:-$HOME/Dev/sbl-app}"
mkdir -p "$W"
rsync -a --delete --exclude .git --exclude scratchpad --exclude .claude --exclude node_modules --exclude 'node_modules.nosync' \
  --exclude dist --exclude app-www --exclude ios --exclude android --exclude 'public/tts-bank*' --exclude public/tts-audition \
  --exclude 'public/*.mp4' --exclude .netlify --exclude '*.log' --exclude deploy-files.json --exclude 'shot.sh' --exclude 'dl*.sh' --exclude 'dl-*.txt' --exclude missing.txt "$SRC"/ "$W"/
cd "$W"
[ -d node_modules ] || npm ci --no-audit --no-fund
npm run build:app
[ -d ios ] || npx cap add ios --packagemanager SPM
# App 图标(resources/AppIcon-1024.png = brand/final/app-icon-1024.png,2026-11-02 起为珠象金象)
[ -f "$SRC/resources/AppIcon-1024.png" ] && cp "$SRC/resources/AppIcon-1024.png" ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
npx cap sync ios
# 安卓 Pad 版(2026-11-02):android/ 只在工作区里(rsync 排除),有就一起同步;出包见 scripts/android-apk.sh
[ -d android ] && npx cap sync android || true
# 方向:iPad、iPhone 都锁横屏(用户 2026-10-16「iPad 默认横着放」「手机也横屏」);UIRequiresFullScreen 否则 iPadOS 多任务会忽略方向限制
PL=ios/App/App/Info.plist
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations~ipad" "$PL" >/dev/null 2>&1; /usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad array" -c "Add :UISupportedInterfaceOrientations~ipad:0 string UIInterfaceOrientationLandscapeLeft" -c "Add :UISupportedInterfaceOrientations~ipad:1 string UIInterfaceOrientationLandscapeRight" "$PL"
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations" "$PL" >/dev/null 2>&1; /usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations array" -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationLandscapeLeft" -c "Add :UISupportedInterfaceOrientations:1 string UIInterfaceOrientationLandscapeRight" "$PL"
/usr/libexec/PlistBuddy -c "Delete :UIRequiresFullScreen" "$PL" >/dev/null 2>&1; /usr/libexec/PlistBuddy -c "Add :UIRequiresFullScreen bool true" "$PL"
# URL scheme superbrainlab://(深链接,src/components/DeepLinks.tsx)
PL=ios/App/App/Info.plist
/usr/libexec/PlistBuddy -c "Print :CFBundleURLTypes" "$PL" >/dev/null 2>&1 || /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" -c "Add :CFBundleURLTypes:0 dict" -c "Add :CFBundleURLTypes:0:CFBundleURLName string org.superbrainlab.app" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string superbrainlab" "$PL"
# 权限说明(2026-11-10 上架准备):语音作答用麦克风(FlashMathGame getUserMedia),比赛报名照片用相机/相册(contest/Join);
# 缺这几条,iOS 一调用就闪退、审核也会驳回。另声明只用标准 HTTPS 加密,免得每次上传都要答出口合规。
pset() { /usr/libexec/PlistBuddy -c "Delete :$1" "$PL" >/dev/null 2>&1 || true; /usr/libexec/PlistBuddy -c "Add :$1 $2 \"$3\"" "$PL"; }
pset NSMicrophoneUsageDescription string "「语音作答」时需要使用麦克风，把你说出的答案识别成数字。"
pset NSCameraUsageDescription string "报名比赛时需要拍一张选手本人正面照，用于比赛当天核对身份。"
pset NSPhotoLibraryUsageDescription string "报名比赛时可以从相册选一张选手本人正面照，用于比赛当天核对身份。"
pset ITSAppUsesNonExemptEncryption bool false
echo "workspace: $W"
[ "$1" = "--open" ] && npx cap open ios || true
