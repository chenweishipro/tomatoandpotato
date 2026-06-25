#!/bin/bash
set -e
cd /opt/tomato-test
rm -rf .next
tar xzf /tmp/tomato-test.tar.gz
cat > .next/standalone/.env << 'ENV'
DATABASE_URL="file:/opt/tomato-test/prisma/tomato-test.db"
NEXTAUTH_SECRET="test-secret-change-me-in-production-please-make-this-random-32-chars"
NEXTAUTH_URL="http://122.51.221.63/tomato-test"
HOSTNAME="127.0.0.1"
PORT="7895"
ENV
mkdir -p prisma/prisma .next/standalone/public
cp -r public/. .next/standalone/public/
for loc in ".next/standalone/node_modules/.prisma/client/dev.db" "prisma/dev.db" "prisma/prisma/dev.db"; do
  if [ -e "$loc" ] && [ ! -L "$loc" ]; then rm -f "$loc"; fi
  if [ ! -e "$loc" ]; then ln -sf "/opt/tomato-test/prisma/tomato-test.db" "$loc"; fi
done

# === Deploy 验证 ===
echo "=== Deploy 验证 (test) ==="
APP_JS="/opt/tomato-test/.next/standalone/.next/server/app/app/page.js"
if [ ! -f "$APP_JS" ]; then
  echo "FAIL: $APP_JS 不存在"
  exit 1
fi
HITS=0
[ $(grep -c "今日番茄" "$APP_JS") -gt 0 ] && HITS=$((HITS+1)) || true
[ $(grep -c "todayCount" "$APP_JS") -gt 0 ] && HITS=$((HITS+1)) || true
[ $(grep -c "行为" "$APP_JS") -gt 0 ] && HITS=$((HITS+1)) || true
echo "marker hits: $HITS / 3 (至少 1 个)"
if [ "$HITS" -eq 0 ]; then
  echo "FAIL: 新代码标志字符串都没找到"
  exit 1
fi

echo "=== Restart test service ==="
echo "Cws647378?!" | sudo -S pkill -9 -f "port.*7895\|tomato-test" 2>/dev/null || true
sleep 2
echo "Cws647378?!" | sudo -S systemctl start tomato-test
sleep 5
ACTIVE=$(echo "Cws647378?!" | sudo -S systemctl is-active tomato-test 2>&1)
echo "service status: $ACTIVE"
if [ "$ACTIVE" != "active" ]; then
  echo "FAIL: test service 没起来"
  exit 1
fi
echo "=== Test deploy 成功 ==="
