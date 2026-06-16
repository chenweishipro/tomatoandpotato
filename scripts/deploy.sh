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
  # **关键** — Next.js standalone 不会自动 trace 哪些 app-level deps 被引用
  # (bcryptjs, next-auth, react-markdown, zod, framer-motion 等)
  # 必须在 source 端 npm install (含 dev deps, 因为 next build 需要 tailwindcss/postcss)
  # 然后只复制 app-level deps 到 standalone
  log "1.0 npm install (含 dev deps, 供 build 用)"
  npm install --no-audit --no-fund 2>&1 | tail -3
  log "1. npx next build"
  npx next build 2>&1 | tail -5
  cp -r .next/static .next/standalone/.next/static
else
  log "1. skip build (--skip-build)"
fi

log "1.5 copying app-level deps to standalone"
log "  copying app-level deps to standalone"
mkdir -p .next/standalone/node_modules
for pkg in bcryptjs next-auth zod clsx tailwind-merge framer-motion lucide-react \
           react-markdown rehype-highlight remark-gfm date-fns @auth/prisma-adapter; do
  if [ -d "node_modules/$pkg" ]; then
    cp -r "node_modules/$pkg" ".next/standalone/node_modules/"
  fi
done
# 复制这些 deps 的 transitive deps (Next.js standalone 不会 trace)
for pkg in bail ccount character-entities character-entities-html4 character-entities-legacy \
           character-reference-invalid comma-separated-tokens decode-named-character-reference \
           is-plain-obj property-information remark-parse remark-rehype space-separated-tokens \
           mdast-util-from-markdown mdast-util-to-hast mdast-util-to-string micromark \
           micromark-core-commonmark micromark-factory-destination micromark-factory-label \
           micromark-factory-space micromark-factory-title micromark-factory-whitespace \
           micromark-util-character micromark-util-chunked micromark-util-classify-character \
           micromark-util-combine-extensions micromark-util-decode-numeric-character-reference \
           micromark-util-encode micromark-util-html-tag-name micromark-util-normalize-identifier \
           micromark-util-resolve-all micromark-util-sanitize-uri micromark-util-subtokenize \
           micromark-util-symbol micromark-util-types trim-lines unist-util-position \
           unist-util-stringify-position unist-util-visit unist-util-visit-parents unist-util-is \
           unist-util-generated vfile vfile-message hast-util-whitespace hast-util-to-jsx-runtime \
           html-url-attributes devlop estree-util-is-identifier-name longest-streak \
           escape-string-regexp zwitch style-to-object inline-style-parser; do
  if [ -d "node_modules/$pkg" ]; then
    cp -r "node_modules/$pkg" ".next/standalone/node_modules/"
  fi
done
# copy @types/hast, @types/mdast, @types/unist (类型可能在 dev 但运行时不需要;
# 但 prisma generate 跑过 @prisma/client 也需要; 不复制也不影响运行)
log "  standalone node_modules: $(ls .next/standalone/node_modules | wc -l) packages"

# === 2. Tarball ===
log "2. tarball $TARBALL"
rm -f "$TARBALL"
# **修复关键 bug**: next build 会自动生成 .next/standalone/.env，里面的
# DATABASE_URL=file:./dev.db 是相对路径。prisma client 启动时读它，会在
# prisma client 同级目录创建空 dev.db，覆盖我们用绝对路径配置的真 db。
# 解决: 改写 .env 为绝对路径
# 同时修 NEXTAUTH_URL (next-auth 从这里拿 basePath) 为带 basePath 的 IP URL
# 同时修 HOSTNAME 为 127.0.0.1 (跟 service env 一致)
if [ -f ".next/standalone/.env" ]; then
  sed -i 's|DATABASE_URL=.*|DATABASE_URL="file:'"$APP_DIR"'/prisma/tomato.db"|' .next/standalone/.env
  sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL="http://'"${HOST#*@}"'/tomato"|' .next/standalone/.env
  sed -i 's|HOSTNAME=.*|HOSTNAME="127.0.0.1"|' .next/standalone/.env
  log "  patched .next/standalone/.env:"
  grep -E "DATABASE_URL|NEXTAUTH_URL|HOSTNAME" .next/standalone/.env | sed 's/^/    /'
fi
if [ -f ".next/standalone/.env.production" ]; then
  sed -i 's|DATABASE_URL=.*|DATABASE_URL="file:'"$APP_DIR"'/prisma/tomato.db"|' .next/standalone/.env.production
fi
# 删 prisma client 目录的 dev.db（如果存在）
find .next/standalone -name "dev.db" -delete 2>/dev/null || true
# 关键: 排除 src 顶层的 node_modules, 但保留 .next/standalone/node_modules
tar -czf "$TARBALL" \
  --exclude='./node_modules' \
  --exclude='./node_modules/*' \
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
# 注意: src 顶层 node_modules 不打包 (deploy 时排除), 解压后 $APP_DIR/node_modules 不存在
# 但 standalone 的 node_modules 已经在 tar 里带过来, 所以 standalone 不需要 npm install
# 我们装 src 顶层的是为了 prisma generate 跑通
echo "--- 4.6 npm install (含 dev deps, 供 prisma generate)"
cd $APP_DIR
npm install --no-audit --no-fund 2>&1 | tail -3

# 4.6.1 **关键**：重新生成 prisma client，让 client 匹配最新 schema
# （否则加了字段后 server 报 "Unknown argument 'xxx'"）
echo "--- 4.6.1 prisma generate"
cd $APP_DIR
npx prisma generate 2>&1 | tail -3

# 4.7 复制 .prisma client 到 standalone (覆盖 standalone 已有的 client)
# standalone 自带的 .prisma 是 build 时的快照, deploy 时 prisma generate 重新生成后
# 把更新过的 copy 过去保证 client 跟 schema 匹配
echo "--- 4.7 cp prisma client to standalone"
rm -rf $APP_DIR/.next/standalone/node_modules/.prisma
rm -rf $APP_DIR/.next/standalone/node_modules/@prisma
cp -r $APP_DIR/node_modules/.prisma $APP_DIR/.next/standalone/node_modules/ 2>/dev/null || true
cp -r $APP_DIR/node_modules/@prisma $APP_DIR/.next/standalone/node_modules/ 2>/dev/null || true

# 4.7.1 **关键**：prisma 5 client 启动时读 .next/standalone/.env，里面
# DATABASE_URL=file:./dev.db 相对路径，prisma 5 解析时是相对 **schema.prisma 位置**
# (即 $APP_DIR/prisma/)，会创建 $APP_DIR/prisma/dev.db——跟我们的 tomato.db 不是同一个！
# 修法: 在所有可能位置创建 symlink dev.db -> tomato.db，让 prisma 写的 ./dev.db 实际写到 tomato.db
echo "--- 4.7.1 symlink dev.db -> $APP_DIR/prisma/tomato.db"
for loc in \
  "$APP_DIR/.next/standalone/node_modules/.prisma/client/dev.db" \
  "$APP_DIR/prisma/dev.db" \
  "$APP_DIR/prisma/prisma/dev.db"; do
  if [ -e "$loc" ] || [ -L "$loc" ]; then
    if [ ! -L "$loc" ]; then
      rm -f "$loc"
    fi
  fi
  ln -sf "$APP_DIR/prisma/tomato.db" "$loc"
done
ls -la $APP_DIR/.next/standalone/node_modules/.prisma/client/dev.db $APP_DIR/prisma/dev.db $APP_DIR/prisma/prisma/dev.db 2>&1

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
