#!/bin/bash
# 在新服务器上执行(root,Ubuntu 22.04 / 24.04):安装 Docker、生成 Supabase 配置、启动全部服务。
# 可以重复执行:已经生成过的配置和数据不会被覆盖。
# 前提:本机已经用 deploy.sh 把 app/、supabase/docker/、www/ 传上来,并且 /srv/zhuxiang/secrets.env 已填好。
set -euo pipefail
ZX=/srv/zhuxiang
SB=$ZX/supabase/docker
die() { echo "✗ $*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "请用 root 执行"
[ -f $ZX/secrets.env ] || die "缺 $ZX/secrets.env(照 app/secrets.env.example 填)"
[ -f $SB/docker-compose.yml ] || die "缺 $SB/docker-compose.yml(先在本机跑 deploy.sh)"
set -a; . $ZX/secrets.env; set +a
for v in JWT_SECRET ANON_KEY SERVICE_ROLE_KEY PUBLIC_URL; do [ -n "${!v:-}" ] || die "secrets.env 里缺 $v"; done

# 1. Docker(用系统源,不连 Docker 官网)
if ! command -v docker >/dev/null; then
  apt-get update -y
  apt-get install -y docker.io docker-compose-v2 rsync curl openssl
fi
# 国内拉不到 Docker Hub:配镜像加速。火山引擎控制台「容器镜像服务」里有官方加速地址的话,放到 DOCKER_MIRRORS 第一个
if [ ! -f /etc/docker/daemon.json ]; then
  MIRRORS=${DOCKER_MIRRORS:-"https://docker.m.daocloud.io https://docker.1ms.run https://mirror.gcr.io"}
  printf '{ "registry-mirrors": [%s], "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "3" } }\n' \
    "$(for m in $MIRRORS; do printf '"%s",' "$m"; done | sed 's/,$//')" > /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker

mkdir -p $ZX/www $ZX/blobs $ZX/certs $ZX/acme

# 2. Supabase 配置(.env):只在第一次生成;数据库密码等随机生成后保存在 .env 里,别删
if [ ! -f $SB/.env ]; then
  cp $SB/.env.example $SB/.env
  rnd() { openssl rand -hex "${1:-24}"; }
  setenv() { if grep -q "^$1=" $SB/.env; then sed -i "s|^$1=.*|$1=$2|" $SB/.env; else echo "$1=$2" >> $SB/.env; fi; }
  # 沿用原 Supabase 项目的 JWT 密钥和两把 API 密钥 → 网页和 App 里的 anon key 不用换,老用户的登录状态在刷新后继续有效
  setenv JWT_SECRET "$JWT_SECRET"
  setenv ANON_KEY "$ANON_KEY"
  setenv SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
  setenv POSTGRES_PASSWORD "$(rnd 24)"
  setenv DASHBOARD_USERNAME admin
  setenv DASHBOARD_PASSWORD "$(rnd 16)"
  setenv SECRET_KEY_BASE "$(rnd 32)"
  setenv VAULT_ENC_KEY "$(rnd 16)"
  setenv PG_META_CRYPTO_KEY "$(rnd 16)"
  setenv LOGFLARE_PUBLIC_ACCESS_TOKEN "$(rnd 24)"
  setenv LOGFLARE_PRIVATE_ACCESS_TOKEN "$(rnd 24)"
  setenv SITE_URL "$PUBLIC_URL"
  setenv API_EXTERNAL_URL "$PUBLIC_URL/sb-api"
  setenv SUPABASE_PUBLIC_URL "$PUBLIC_URL/sb-api"
  setenv ADDITIONAL_REDIRECT_URLS "$PUBLIC_URL"
  # 和线上一致:注册即可登录(手机号、登录名在底层是内部邮箱,不发验证邮件)
  setenv ENABLE_EMAIL_SIGNUP true
  setenv ENABLE_EMAIL_AUTOCONFIRM true
  setenv DISABLE_SIGNUP false
  # Supabase 网关只给本机用(网页经 nginx 转发),不对公网开放
  setenv KONG_HTTP_PORT 127.0.0.1:8000
  setenv KONG_HTTPS_PORT 127.0.0.1:8443
  chmod 600 $SB/.env
  left=$(grep -nE 'your-|this_password_is_insecure|super-secret' $SB/.env || true)
  [ -z "$left" ] || { echo "⚠ .env 里还有占位值,请检查:"; echo "$left"; }
  echo "✓ 已生成 $SB/.env(数据库密码、管理台密码都在里面)"
fi

# 3. 启动:Supabase 官方栈 + 珠象的 web(nginx)和 fn(云函数)
cd $SB
COMPOSE="docker compose -f docker-compose.yml -f $ZX/app/docker-compose.zhuxiang.yml"
$COMPOSE pull --ignore-buildable
$COMPOSE up -d --build
sleep 5
docker exec zhuxiang-web nginx -t
$COMPOSE ps
echo
echo "—— 自检 ——"
chk() { printf '%-28s %s\n' "$1" "$2"; }
chk "网页首页" "$(curl -s -o /dev/null -w '%{http_code}' localhost/)"
chk "登录服务 /auth/v1/health" "$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" localhost/sb-api/auth/v1/health)"
chk "数据接口 /rest/v1/" "$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" "localhost/sb-api/rest/v1/profiles?select=id&limit=1")"
chk "云函数 contest(应为 404)" "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{"action":"contestInfo","cid":"x"}' localhost/.netlify/functions/contest)"
echo "管理台(Studio)只对本机开放:在你电脑上 ssh -L 8000:127.0.0.1:8000 root@服务器IP,再打开 http://localhost:8000"
