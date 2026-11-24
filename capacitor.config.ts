import type { CapacitorConfig } from "@capacitor/cli";

// App 壳:把网页版整个打进 iOS/Android。页面从包内加载(app-www,由 scripts/build-app.mjs 生成,不含 230MB 词块库),
// 接口与词块库走线上 superbrainlab.org(见 src/lib/appEnv.ts)。
const config: CapacitorConfig = {
  appId: "org.superbrainlab.app",
  appName: "珠象",
  webDir: "app-www",
  ios: { contentInset: "always", backgroundColor: "#FBF5E6" }, // always:整页避开状态栏/刘海/Home 条(automatic 时首页顶栏压在时钟下面)
  android: { backgroundColor: "#FBF5E6" },
  server: { androidScheme: "https" },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: "#FBF5E6" },
    StatusBar: { style: "LIGHT", backgroundColor: "#FBF5E6" },
  },
};

export default config;
