# App 版(iOS / Android)

网页版代码直接打进原生壳(Capacitor),功能与 superbrainlab.org 完全一致;App 内接口和听算词块库走线上站点(词块库 230MB 不随包分发,联网按需加载)。

## 构建
项目在 iCloud Desktop 里,Capacitor/Xcode 跑不动,所以构建在 `~/Dev/sbl-app`(不在 iCloud)进行,源码以本仓库为准:

```bash
bash scripts/app-sync.sh --open   # 同步源码 → 安装依赖 → 打包网页 → 生成/同步 iOS 工程 → 用 Xcode 打开
```

Xcode 里选一台 iPad/iPhone 模拟器或真机,点 Run。真机与上架需要 Apple Developer 账号并在 Xcode 的 Signing 里选团队。

## 相关文件
- `capacitor.config.ts`:appId `org.superbrainlab.app`,应用名 Super Brain Lab
- `scripts/build-app.mjs`:生成 `app-www`(vite 产物 + public,不含词块库)
- `src/lib/appEnv.ts`:原生壳判断与线上地址前缀
- `resources/AppIcon-1024.png`:App 图标
- `src/index.css` 末尾「App 壳」段:状态栏安全区、手机/平板底栏

## Android
需要安装 Android Studio 后 `npx cap add android`(其余同上)。
