#!/usr/bin/env bash
# Tomato 部署脚本（云沙盒 → production server）
# 用法：
#   bash scripts/deploy.sh          # 全流程：build + scp + 解压 + install + restart + verify
#   bash scripts/deploy.sh --skip-build  # 跳过 build（用现有 .next/standalone）
#   bash scripts/deploy.sh --reset-db    # 同时清空 db（慎用！）

set -euo pipefail

# === 配置 ===
HOST="ubuntu@122.51.221.63"
SSH_PASS='Cws647378?!'
APP_DIR="/opt/tomato"
APP_PORT="7893"
BASE_PATH="/tomato"
PUBLIC_URL="http://${HOST#*@}/tomato/"
TARBALL="/tmp/tomato-$(date +%Y%m%d-%H%M%S).tar.gz"

# === 解析参数 ===
SKIP_BUILD=0
RESET_DB=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --reset-db) RESET_DB=1 ;;
    *) echo "unknown arg: $arg"; exit 1 ;;
  esac
done

# === 颜色 ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err() { echo -e "${RED}[err]${NC} $*"; }

# === 1. Build ===
if [ "$SKIP_BUILD" -eq 0 ]; then
  log "1. npx next build"
  npx next build 2>&1 | tail -5
  cp -r .next/static .next/standalone/.next/static
else
  log "1. skip build (--skip-build)"
fi

# === 2. Tarball ===
log "2. tarball $TARBALL"
rm -f "$TARBALL"
tar -czf "$TARBALL" \
  --exclude='node_modules' \
  --exclude='.next/cache' \
  --exclude='prisma/*.db' \
  --exclude='prisma/*.db-journal' \
  --exclude='prisma/prisma/' \
  --exclude='screenshots/' \
  --exclude='scripts/deploy.sh' \
  --exclude='.git/' \
  .next/standalone .next/static package.json package-lock.json prisma scripts
log "  size: $(ls -lh $TARBALL | awk '{print $5}')"

# === 3. SCP ===
log "3. scp $TARBALL → $HOST:/tmp/tomato.tar.gz"
sshpass -p "$SSH_PASS" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  "$TARBALL" "$HOST:/tmp/tomato.tar.gz"

# === 4. Server 端部署 ===
log "4. server: stop + 备份 + 解压 + 替换 + install + restart"

sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  "$HOST" bash -s <<REMOTE
set -e
cd ~

# 4.1 停 service
echo "--- 4.1 stop service"
sudo -S systemctl stop tomato <<< "$SSH_PASS" 2>/dev/null || true
sleep 2

# 4.2 备份 db（如果存在且非空）
if [ -f "$APP_DIR/prisma/tomato.db" ] && [ -s "$APP_DIR/prisma/tomato.db" ]; then
  echo "--- 4.2 backup db"
  cp "$APP_DIR/prisma/tomato.db" "/tmp/tomato.db.bak.\$(date +%Y%m%d-%H%M%S)"
  ls -la /tmp/tomato.db.bak.* 2>/dev/null | tail -3
fi

# 4.3 解压到 new
echo "--- 4.3 extract"
rm -rf $APP_DIR.new
mkdir -p $APP_DIR.new
cd $APP_DIR.new
tar -xzf /tmp/tomato.tar.gz
ls -la

# 4.4 恢复 db（如果存在 backup）
LATEST_BAK=\$(ls -t /tmp/tomato.db.bak.* 2>/dev/null | head -1 || true)
if [ -n "\$LATEST_BAK" ] && [ -f "\$LATEST_BAK" ]; then
  echo "--- 4.4 restore db from \$LATEST_BAK"
  cp "\$LATEST_BAK" "$APP_DIR.new/prisma/tomato.db"
fi

# 4.5 替换
echo "--- 4.5 mv new → app"
sudo -S rm -rf $APP_DIR <<< "$SSH_PASS" 2>/dev/null
sudo -S mv $APP_DIR.new $APP_DIR <<< "$SSH_PASS" 2>/dev/null
sudo -S chown -R ubuntu:ubuntu $APP_DIR <<< "$SSH_PASS" 2>/dev/null

# 4.6 装 prod deps（可能没 node_modules）
if [ ! -d "$APP_DIR/node_modules/next" ]; then
  echo "--- 4.6 npm install --omit=dev"
  cd $APP_DIR
  npm install --omit=dev --no-audit --no-fund 2>&1 | tail -3
fi

# 4.7 复制 .prisma client 到 standalone
echo "--- 4.7 cp prisma client"
mkdir -p $APP_DIR/.next/standalone/node_modules
cp -r $APP_DIR/node_modules/.prisma $APP_DIR/.next/standalone/node_modules/ 2>/dev/null || true
cp -r $APP_DIR/node_modules/@prisma $APP_DIR/.next/standalone/node_modules/ 2>/dev/null || true

# 4.8 DB 初始化（如果需要）
if [ ! -s "$APP_DIR/prisma/tomato.db" ] || [ "$RESET_DB" = "1" ]; then
  echo "--- 4.8 init db"
  cd $APP_DIR
  $RESET_DB && RESET_FLAG="--reset" || RESET_FLAG=""
  node scripts/db-init.js \$RESET_FLAG
fi

# 4.9 启动
echo "--- 4.9 start service"
sudo -S systemctl start tomato <<< "$SSH_PASS" 2>/dev/null
sleep 4

# 4.10 验证
echo "--- 4.10 verify"
curl -sI -m 5 http://127.0.0.1:$APP_PORT$BASE_PATH/login/ | head -1

REMOTE

# === 5. 验证 ===
log "5. final verify"
sleep 2
if curl -sI -m 5 "$PUBLIC_URL" | head -1 | grep -q "200"; then
  log "✓ $PUBLIC_URL 200 OK"
else
  err "部署后访问 $PUBLIC_URL 失败"
  exit 1
fi

log "DONE 🎉"
log "URL: $PUBLIC_URL"
