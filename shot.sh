#!/bin/bash
# 用法:shot.sh <tag>  → 截 iPad(裁掉模拟器竖屏黑边)与 iPhone(转正)两张到 scratchpad/shots/S-<tag>-{ipad,iphone}.png
S="/private/tmp/claude-501/-Users-kongshan-Desktop/1804b6c3-8f05-4ca0-8b8b-d557f221b876/scratchpad/shots"; t="$1"
xcrun simctl io "iPad Pro 11-inch (M5)" screenshot "$S/raw-ipad.png" >/dev/null 2>&1; xcrun simctl io "iPhone 17" screenshot "$S/raw-iphone.png" >/dev/null 2>&1
ffmpeg -v error -y -i "$S/raw-ipad.png" -vf "crop=1668:1166:0:627" "$S/S-$t-ipad.png"; sips -Z 1400 "$S/S-$t-ipad.png" --out "$S/S-$t-ipad.png" >/dev/null
sips -r -90 "$S/raw-iphone.png" --out "$S/S-$t-iphone.png" >/dev/null; sips -Z 1400 "$S/S-$t-iphone.png" --out "$S/S-$t-iphone.png" >/dev/null
echo "shot $t"
