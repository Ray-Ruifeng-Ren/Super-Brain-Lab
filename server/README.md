# 珠象迁到国内服务器(火山引擎)· 迁移手册

> 现状:网页、云函数在 Netlify,账号和数据在 Supabase 云端(美国)。
> 目标:整套搬到一台国内云服务器,换一个备案好的国内域名;切换前线上服务一直照常运行。

## 一、搬过去之后的样子

```
用户浏览器 / App
      │  https://新域名
      ▼
┌──────────── 一台火山引擎云服务器(建议 4 核 8G)────────────┐
│  web(nginx)  网页 + 报题语音库 + 安装包下载页                 │
│     ├─ /sb-api/auth/v1、/sb-api/rest/v1 → Supabase 自建(登录、数据) │
│     ├─ /sb-api/functions/v1/admin-data → fn                     │
│     └─ /.netlify/functions/*           → fn(比赛、报题语音、注销账号…) │
│  fn          原来的云函数原样运行;比赛数据存本机磁盘            │
│  Supabase    PostgreSQL + 登录服务 + 数据接口(官方自建版)      │
└───────────────────────────────────────────────────────────────┘
```

**为什么前端几乎不用改**:网页现在调用的接口全是同域相对路径(`/sb-api/...`、`/.netlify/functions/...`),新服务器上用 nginx 把同样的路径接住就行。

## 二、这个目录里有什么

| 文件 | 作用 |
|---|---|
| `deploy.sh` | 在本机执行,一键把整套服务传到新服务器并启动 |
| `fn/server.mjs` | 云函数运行器:`netlify/functions` 里的函数不改一行,直接跑 |
| `fn/blobs.mjs` | 替代 Netlify Blobs 的本地存储(比赛数据、语音缓存) |
| `fn/prepare.mjs` | 复制云函数并把写死的云端地址换成服务器内网地址(原文件不动) |
| `fn/extra/admin-data.mjs` | 管理后台接口(替代 Supabase 云端的同名函数) |
| `fn/test.mjs` | 本机自测:存储、比赛全流程、HTTP 转发、管理后台 |
| `nginx/conf.d/` | 网站和接口转发规则(对应现在的 `_redirects` / `_headers`) |
| `docker-compose.zhuxiang.yml` | 在 Supabase 官方栈上加 web、fn 两个服务 |
| `scripts/setup-server.sh` | 服务器上:装 Docker、生成配置、启动、自检 |
| `scripts/migrate-db.sh` | 服务器上:把云端数据库(账号 + 全部数据)搬过来并核对行数 |
| `scripts/export-blobs.mjs` | 本机:导出比赛数据(只读线上) |
| `scripts/backup.sh` | 服务器上:每天备份,保留 14 天 |
| `secrets.env.example` | 服务器密钥配置模板 |

本机自测:`cd ~/Dev/sbl-app/server/fn && node prepare.mjs && node test.mjs`(2026-11-10 全部通过)。

## 三、步骤

### 1. 你来做:买服务器、域名、备案
- 火山引擎企业实名认证。
- 云服务器 ECS:**4 核 8G**、Ubuntu 24.04、系统盘 60GB 以上、公网带宽 5Mbps 起,包年(备案一般要求包年包月)。
- **安全组只开 22、80、443**(数据库、Supabase 网关都只在机器内部用)。
- 新域名(建议 `.cn`),在火山引擎买、做实名,然后提交 ICP 备案。**备案期间老网站照常运行,不受影响。**

### 2. 我来做:部署到新服务器(和线上完全隔离)
1. 服务器上建 `/srv/zhuxiang/secrets.env`(照 `secrets.env.example`;三把 Supabase 密钥在控制台复制)。
2. 本机:`cd ~/Dev/sbl-app && npm run build && bash server/deploy.sh root@服务器IP`。
3. 脚本最后会自检:网页、登录服务、数据接口、云函数各返回什么状态码。

### 3. 演练数据迁移(随时可做,只读线上)
```bash
# 服务器上(数据库密码你自己填)
SRC_DB_URL='postgresql://postgres.<项目id>:<密码>@<区域>.pooler.supabase.com:5432/postgres' bash /srv/zhuxiang/app/scripts/migrate-db.sh
# 本机:比赛数据
node server/scripts/export-blobs.mjs /tmp/zx-blobs && rsync -a /tmp/zx-blobs/ root@服务器IP:/srv/zhuxiang/blobs/
```
然后用电脑 hosts 把新域名指到服务器 IP,把下面「验收清单」走一遍。演练可以重复做(再导时加 `--reset`)。

### 4. 验收清单(全部通过才切换)
- [ ] 老账号(手机号、登录名、邮箱各一个)用原密码登录
- [ ] 新注册、修改昵称和密码
- [ ] 闪算 / 听算(报题语音)/ 看算 / 数珠互译 / 马拉松 / 障碍算 各做一轮,成绩上榜
- [ ] 教练端:布置作业、学生完成、完成情况、重置学生密码
- [ ] 等级鉴定、出题系统(打印、扫码看答案)
- [ ] 比赛:报名(身份证、照片)、平板作答、大屏、导出
- [ ] 管理后台 /admin 数据正常
- [ ] 注销账号
- [ ] 手机 4G 和家里 WiFi 都打开测一遍速度

### 5. 切换当天(建议晚上,停机约 30 分钟)
1. 提前一天通知老师:今晚 X 点到 X 点维护。
2. 停写:线上挂维护提示(或直接在这个时段不用)。
3. 服务器上跑 `migrate-db.sh --reset` + 本机重新导比赛数据,核对行数全部一致。
4. 前端改地址(见下文「切换时要改的代码」),构建,`deploy.sh --web-only`。
5. 新域名解析到服务器;superbrainlab.org 在 Netlify 上改成跳转到新域名(海外用户、老链接、已打印的二维码都还能用)。
6. 发新版 App(iOS / 安卓)。旧版 App 仍指向 superbrainlab.org,所以 **Netlify 上的 `/sb-api/*`、`/.netlify/functions/*` 要改成转发到新服务器**,而不是直接停掉,等大家都更新后再关。
7. Supabase 云端项目保留至少 1 个月不删,作为回滚备份。

**回滚**:新服务器有问题时,把域名和 Netlify 的转发改回去即可(切换后新产生的数据需要再反向导一次)。

## 四、切换时要改的代码(现在不改,切换当天一起改)
- `src/integrations/supabase/client.ts`:`onProd` 的域名判断加上新域名;App 里写死的 `https://superbrainlab.org/sb-api` 改成新域名。
- `src/lib/appEnv.ts`:App 的 `ORIGIN` 默认值改成新域名。
- `src/lib/paper.ts`(试卷二维码 `KEY_ORIGIN`)、`src/components/CertDiploma.tsx`(证书二维码)、`src/pages/contest/Admin.tsx`(报名链接)。
- `src/lib/legal.ts`、`scripts/download-page.html`、`index.html`、`src/pages/site/SiteShell.tsx` 里显示的网址。
- **不要改** `phone.superbrainlab.org`、`stu.superbrainlab.org`:那是账号在底层的内部邮箱后缀,改了老账号就登不上了。

## 五、已知要另外处理的
- **语音作答识别**(`transcribe`)现在用的是 OpenAI 的语音识别,国内服务器连不上。切换前要换成火山引擎的语音识别,否则「语音作答」不能用(其他功能不受影响)。
- **报题语音**主力是火山引擎,不受影响;它失败时的备用方案(OpenAI)在国内会失效,影响很小。
- 登录状态按域名保存,用户第一次打开新域名需要重新登录一次(账号密码不变)。
- 用户量上来后:数据库可以换成火山引擎托管的 PostgreSQL(主备、自动备份),静态文件放对象存储 + CDN。
