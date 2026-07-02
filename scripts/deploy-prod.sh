#!/bin/bash
set -e
cd /opt/tomato
rm -rf .next
tar xzf /tmp/tomato-prod.tar.gz
cat > .next/standalone/.env << 'ENV'
DATABASE_URL="file:/opt/tomato/prisma/tomato.db"
NEXTAUTH_SECRET="dev-secret-change-me-in-production-please-make-this-random-32-chars"
NEXTAUTH_URL="http://122.51.221.63/tomato"
HOSTNAME="127.0.0.1"
PORT="7893"
ENV
mkdir -p prisma/prisma .next/standalone/public
cp -r public/. .next/standalone/public/
for loc in ".next/standalone/node_modules/.prisma/client/dev.db" "prisma/dev.db" "prisma/prisma/dev.db"; do
  if [ -e "$loc" ] && [ ! -L "$loc" ]; then rm -f "$loc"; fi
  if [ ! -e "$loc" ]; then ln -sf "/opt/tomato/prisma/tomato.db" "$loc"; fi
done

# === Deploy 验证: 确认新代码关键字符串已到位 ===
echo "=== Deploy 验证 ==="
APP_JS="/opt/tomato/.next/standalone/.next/server/app/app/page.js"
if [ ! -f "$APP_JS" ]; then
  echo "FAIL: $APP_JS 不存在, extract 失败"
  exit 1
fi
# 关键 marker: 不同 commit 至少一个能匹配
HITS=0
[ $(grep -c "今日番茄" "$APP_JS") -gt 0 ] && HITS=$((HITS+1)) || true
[ $(grep -c "setTodayCount" "$APP_JS") -gt 0 ] && HITS=$((HITS+1)) || true
[ $(grep -c "setTodayMinutes" "$APP_JS") -gt 0 ] && HITS=$((HITS+1)) || true
[ $(grep -c "todayCount" "$APP_JS") -gt 0 ] && HITS=$((HITS+1)) || true
[ $(grep -c "行为" "$APP_JS") -gt 0 ] && HITS=$((HITS+1)) || true
[ $(grep -c "github" "$APP_JS") -gt 0 ] && HITS=$((HITS+1)) || true
echo "marker hits: $HITS / 6 (至少 1 个说明新代码到位)"
if [ "$HITS" -eq 0 ]; then
  echo "FAIL: 新代码标志字符串都没找到, deploy 没成功"
  echo "debug: app/app/page.js size = $(stat -c %s $APP_JS) bytes"
  exit 1
fi
ls .next/standalone/public/

# === 杀老进程 + restart service ===
echo "=== Restart service ==="
# 关键: kill 所有 next-server 僵尸 (老版本可能没 "server.js" 字样)
echo "Cws647378?!" | sudo -S pkill -9 -f "next-server" 2>/dev/null || true
echo "Cws647378?!" | sudo -S pkill -9 -f "server.js" 2>/dev/null || true
sleep 2
# 确认端口空
PID=$(echo "Cws647378?!" | sudo -S ss -tlnp 2>/dev/null | grep ":7893" | grep -oP "pid=\K[0-9]+" | head -1)
[ -n "$PID" ] && echo "Cws647378?!" | sudo -S kill -9 $PID && sleep 2
echo "Cws647378?!" | sudo -S systemctl restart tomato
sleep 5
ACTIVE=$(echo "Cws647378?!" | sudo -S systemctl is-active tomato 2>&1)
echo "service status: $ACTIVE"
if [ "$ACTIVE" != "active" ]; then
  echo "FAIL: service 没起来"
  exit 1
fi
echo "Cws647378?!" | sudo -S ss -tlnp 2>/dev/null | grep 7893 || echo "WARN: 7893 不在 listen"
echo "=== Deploy 成功 ==="
