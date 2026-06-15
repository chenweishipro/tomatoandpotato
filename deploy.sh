#!/usr/bin/env bash
# 🍅 Tomato 部署脚本
# 用法: ./deploy.sh
# 在本地 mac/linux 跑，会 build 并 scp 到服务器

set -e

# 配置
SERVER="ubuntu@122.51.221.63"
REMOTE_DIR="/opt/tomato"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> 1. 生成 Prisma client"
cd "$LOCAL_DIR"
npx prisma generate

echo "==> 2. 构建"
npm run build

echo "==> 3. 打包"
TARBALL="/tmp/tomato-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$TARBALL" \
  --exclude='node_modules' \
  --exclude='.next/standalone/node_modules' \
  --exclude='.next/cache' \
  --exclude='.git' \
  --exclude='prisma/*.db' \
  .next package.json package-lock.json prisma public

echo "==> 4. 上传到服务器"
scp "$TARBALL" "$SERVER:/tmp/"

echo "==> 5. 服务器端部署"
ssh "$SERVER" << EOF
set -e
cd $REMOTE_DIR

# 备份
if [ -d .next ]; then
  sudo mv .next .next.bak.\$(date +%Y%m%d-%H%M%S) || true
fi

# 解压
tar -xzf /tmp/$(basename $TARBALL)

# 复制静态资源到 standalone
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true

# prisma
npx prisma generate
node node_modules/.prisma/client/index.js || true

# 重启
sudo systemctl restart tomato || true

# 健康检查
sleep 2
curl -sI http://localhost:7893/login | head -1 || echo "check failed"
EOF

echo "==> 部署完成: https://ml.chenweishi.cn/tomato"
