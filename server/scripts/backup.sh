#!/bin/bash
# 每天备份数据库 + 比赛数据,保留 14 天。装到定时任务:
#   echo '30 3 * * * root bash /srv/zhuxiang/app/scripts/backup.sh >> /var/log/zhuxiang-backup.log 2>&1' > /etc/cron.d/zhuxiang-backup
# 备份在本机磁盘;建议再在火山引擎控制台给云盘开「自动快照」,机器坏了也能恢复。
set -euo pipefail
ZX=/srv/zhuxiang; B=$ZX/backups; mkdir -p $B; chmod 700 $B
T=$(date +%Y%m%d-%H%M)
PGPW=$(grep '^POSTGRES_PASSWORD=' $ZX/supabase/docker/.env | cut -d= -f2-)
docker exec -e PGPASSWORD="$PGPW" supabase-db pg_dump -h 127.0.0.1 -U supabase_admin -d postgres --schema=public --schema=auth -Fc > $B/db-$T.dump
tar -czf $B/blobs-$T.tar.gz --exclude blobs/tts-cache -C $ZX blobs
find $B -type f -mtime +14 -delete
echo "$(date '+%F %T') ✓ 备份 db-$T.dump($(du -h $B/db-$T.dump | cut -f1))"
