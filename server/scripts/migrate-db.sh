#!/bin/bash
# 把 Supabase 云端数据库(账号 + 全部业务数据)搬到新服务器。在新服务器上以 root 执行。
#
#   SRC_DB_URL='postgresql://postgres.<项目id>:<数据库密码>@<区域>.pooler.supabase.com:5432/postgres' \
#     bash migrate-db.sh [--reset]
#
# SRC_DB_URL:Supabase 控制台 → 项目 → Connect → Session pooler(IPv4 能连,5432 端口)。密码由你在服务器上自己填,不要发给别人。
# --reset:先清空新服务器上的业务数据和账号再导入(演练过一次之后再导,必须加)。
#
# 对线上只做读取(pg_dump),不写任何东西,可以随时拿来演练。正式切换时在停机窗口里再跑一次,保证数据最新。
# 用户密码在库里是 bcrypt 密文,原样搬过去,所有人用原来的账号密码就能登录。
set -euo pipefail
ZX=/srv/zhuxiang
SB=$ZX/supabase/docker
SRC="${SRC_DB_URL:?请先设置 SRC_DB_URL}"
RESET=${1:-}
PGPW=$(grep '^POSTGRES_PASSWORD=' $SB/.env | cut -d= -f2-)
D=$ZX/migrate/$(date +%Y%m%d-%H%M%S); mkdir -p "$D"; chmod 700 $ZX/migrate
db() { docker exec -i -e PGPASSWORD="$PGPW" supabase-db "$@"; }
dst() { db psql -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -U supabase_admin -d postgres "$@"; }
src() { docker exec -i supabase-db psql "$SRC" -v ON_ERROR_STOP=1 -At "$@"; }
# 登录相关的表:账号、第三方身份、登录会话(带上会话,老用户刷新令牌后不用重新登录)
AUTH_TABLES="auth.users auth.identities auth.sessions auth.refresh_tokens"

echo "1/5 导出云端数据(只读)→ $D"
docker exec -i supabase-db pg_dump "$SRC" --schema=public --schema-only --no-owner > "$D/public-schema.sql"
docker exec -i supabase-db pg_dump "$SRC" --schema=public --data-only --no-owner > "$D/public-data.sql"
docker exec -i supabase-db pg_dump "$SRC" --data-only --no-owner $(for t in $AUTH_TABLES; do printf -- '--table=%s ' "$t"; done) > "$D/auth-data.sql"
# auth.users 上的触发器(注册时自动建 profiles 等),定义在 auth 表上,上面的 public 导出里没有
src -c "select format('drop trigger if exists %I on auth.users; %s;', t.tgname, pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal" > "$D/auth-triggers.sql"
TABLES=$(src -c "select tablename from pg_tables where schemaname = 'public' order by 1")
for t in $TABLES; do echo "public.$t $(src -c "select count(*) from public.\"$t\"")"; done > "$D/count-src.txt"
for t in $AUTH_TABLES; do echo "$t $(src -c "select count(*) from $t")"; done >> "$D/count-src.txt"
ls -lh "$D"

if [ "$RESET" = "--reset" ]; then
  echo "2/5 清空新服务器上的旧数据(--reset)"
  dst <<'SQL'
truncate auth.users cascade;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
SQL
else
  echo "2/5 (首次导入,不清空)"
  n=$(dst -At -c "select count(*) from auth.users")
  [ "$n" = 0 ] || { echo "✗ 新服务器上已经有 $n 个账号,再导一次请加 --reset"; exit 1; }
fi

echo "3/5 导入表结构、权限、行级安全策略"
dst < "$D/public-schema.sql"

echo "4/5 导入账号和业务数据(导入期间暂停触发器,避免重复建 profiles)"
{ echo "set session_replication_role = replica;"; cat "$D/auth-data.sql"; } | dst
{ echo "set session_replication_role = replica;"; cat "$D/public-data.sql"; } | dst
dst < "$D/auth-triggers.sql"
dst -c "notify pgrst, 'reload schema';"   # 让数据接口立刻认出新表

echo "5/5 核对行数(云端 vs 新服务器)"
bad=0
while read -r t n; do
  m=$(dst -At -c "select count(*) from $(echo "$t" | sed 's/^public\.\(.*\)$/public."\1"/')")
  flag="✓"; [ "$n" = "$m" ] || { flag="✗"; bad=1; }
  printf '%s %-32s 云端 %-8s 新服务器 %s\n' "$flag" "$t" "$n" "$m"
done < "$D/count-src.txt"
[ $bad = 0 ] && echo "✓ 全部一致" || { echo "✗ 有表行数不一致,先别切换"; exit 1; }
