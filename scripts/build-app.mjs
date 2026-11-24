// 生成 App 壳用的静态包 app-www:vite 产物 + public(不含词块库/试听/Netlify 专用文件)。用法:npm run build:app
import { execSync } from "node:child_process";
import { rmSync, mkdirSync } from "node:fs";
rmSync("app-www", { recursive: true, force: true }); mkdirSync("app-www");
execSync("npx vite build --outDir app-www", { stdio: "inherit", env: { ...process.env, FAST_BUILD: "1" } }); // FAST_BUILD=不复制 public
execSync("rsync -a --exclude 'tts-bank*' --exclude 'tts-audition' --exclude '_headers' --exclude '_redirects' public/ app-www/", { stdio: "inherit" });
console.log("app-www ready");
