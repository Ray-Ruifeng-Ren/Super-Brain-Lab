import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// 构建号:写进 JS(__BUILD_ID__)并输出 dist/version.json,页面定期比对,发现新版且不在做题中就自动刷新
// (2026-10-17 付海东的页面开了一天没刷新,测到的还是旧逻辑)
const BUILD_ID = String(Date.now());
const versionFile = () => ({ name: "sbl-version-json", generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD_ID }) }); } });

// 本地开发:比赛系统接口(/.netlify/functions/contest)用内存存储跑同一套业务;authToken === "dev" 当管理员(只在 vite dev 里)
const contestDev = () => ({
  name: "contest-dev-api",
  apply: "serve" as const,
  async configureServer(server: import("vite").ViteDevServer) {
    const { makeCore } = await import("./netlify/functions/_contest-core.mjs");
    const mem = new Map<string, unknown>();
    const handle = makeCore({ get: async (k: string) => (mem.has(k) ? structuredClone(mem.get(k)) : null), set: async (k: string, v: unknown) => { mem.set(k, structuredClone(v)); }, list: async (p: string) => [...mem.keys()].filter((k) => k.startsWith(p)) });
    server.middlewares.use("/.netlify/functions/contest", (req, res) => {
      let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", async () => {
        res.setHeader("content-type", "application/json");
        try { const { action, authToken, ...b } = JSON.parse(raw || "{}"); res.end(JSON.stringify(await handle(action, b, authToken ? { id: "dev-admin", admin: true } : null))); }
        catch (e) { const x = e as { status?: number; message?: string }; res.statusCode = x.status || 500; res.end(JSON.stringify({ error: x.message })); }
      });
    });
  },
});

// 本地开发:官网演示视频在 ~/Dev/zhuxiang-release/site(不放 public,免得打进 App 包;发布时由 netlify-deploy-api 一起传)
const siteMediaDev = () => ({
  name: "site-media-dev",
  apply: "serve" as const,
  configureServer(server: import("vite").ViteDevServer) {
    server.middlewares.use("/site/", async (req, res, next) => {
      const fs = await import("node:fs"), p = await import("node:path");
      const f = p.join(process.env.HOME || "", "Dev/zhuxiang-release/site", decodeURIComponent((req.url || "").split("?")[0]));
      if (!fs.existsSync(f)) return next();
      res.setHeader("content-type", f.endsWith(".mp4") ? "video/mp4" : f.endsWith(".jpg") ? "image/jpeg" : f.endsWith(".png") ? "image/png" : "application/octet-stream");
      fs.createReadStream(f).pipe(res);
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // FAST_BUILD=1 复用已存在的 dist(含大视频),只重写 JS/CSS,不清空、不复制 public 大文件
  build: process.env.FAST_BUILD ? { emptyOutDir: false, copyPublicDir: false } : {},
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // 本地开发:词块音频库太大(236MB)不在本机 public 里(只有尾音 f 文件),听算请求转到线上拿(2026-11-24)
    proxy: Object.fromEntries(["/tts-bank", "/tts-bank2", "/tts-bank3", "/tts-bank4", "/tts-bank5", "/tts-bank6"].map((k) => [k, { target: "https://superbrainlab.org", changeOrigin: true }])),
  },
  plugins: [react(), versionFile(), contestDev(), siteMediaDev(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
